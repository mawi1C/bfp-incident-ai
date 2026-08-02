import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateSQL, generateAnswer, type CitedRow, type ConversationTurn } from "@/lib/gemini";
import { getCachedAnswer, saveCachedAnswer } from "@/lib/queryCache";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { question, history } = (await req.json()) as {
      question?: string;
      history?: ConversationTurn[];
    };

    if (!question || !question.trim()) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }

    const conversationHistory = history?.slice(-4) ?? []; // last 4 turns is plenty of context

    // Cache lookup ALWAYS runs, regardless of conversation position. A
    // fully self-contained question ("how many incidents in June") means
    // the same thing whether it's the 1st or 5th message in a chat, so a
    // repeat of it should still hit the cache instantly. Only the SAVE
    // step below stays restricted to history-free questions — that's the
    // part that's actually unsafe to cache under ambiguous phrasing (a
    // follow-up like "what about May" means something different depending
    // on what preceded it, so its answer shouldn't be cached under that
    // literal text for reuse in an unrelated future conversation).
    const cached = await getCachedAnswer(question);
    if (cached) {
      return NextResponse.json({
        answer: cached.answer,
        rowCount: cached.row_count,
        cached: true,
        sql: process.env.NODE_ENV === "development" ? cached.sql_generated : undefined,
      });
    }

    // 1. Officer's plain-English question -> SQL
    let sql: string;
    try {
      sql = await generateSQL(question, conversationHistory);
    } catch (err) {
      return NextResponse.json(
        { error: "Couldn't turn that into a database query. Try rephrasing it." },
        { status: 422 }
      );
    }

    // 2. Run the generated SQL through the read-only RPC.
    const { data, error: sqlError } = await supabaseAdmin.rpc("execute_sql", { query: sql });

    if (sqlError) {
      // Most likely the generated SQL referenced a nonexistent column, or
      // tripped the execute_sql guardrail. Surface the SQL for debugging
      // but keep the officer-facing message simple.
      console.error("execute_sql error:", sqlError, "\nGenerated SQL:", sql);
      return NextResponse.json(
        {
          error: "That query didn't run cleanly against the database. Try asking it a different way.",
          debugSql: process.env.NODE_ENV === "development" ? sql : undefined,
        },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as CitedRow[];

    // 3. Rows -> natural-language answer with citations.
    const answer = await generateAnswer(question, sql, rows);

    // Best-effort cache write — only for standalone questions, matching the
    // read-side skip above (a follow-up's answer isn't valid outside its
    // original conversation context).
    if (conversationHistory.length === 0) {
      await saveCachedAnswer(question, sql, answer, rows.length);
    }

    return NextResponse.json({
      answer,
      rowCount: rows.length,
      cached: false,
      sql: process.env.NODE_ENV === "development" ? sql : undefined,
    });
  } catch (err) {
    console.error("Query route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error answering that question." },
      { status: 500 }
    );
  }
}