"use client";

import { useRef, useState } from "react";

interface Message {
  role: "officer" | "assistant";
  text: string;
  rowCount?: number;
  cached?: boolean;
  isError?: boolean;
}

const SUGGESTED = [
  "What are the most common causes of fire this year?",
  "Which station had the most incidents in June?",
  "What's the average response time?",
];

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const ask = async (question: string) => {
    if (!question.trim() || pending) return;

    // Build history from the current message list BEFORE adding this new
    // question — pairs of (officer question -> assistant answer), most
    // recent last. Error responses aren't included since they're not
    // useful conversational context.
    const history = [];
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role === "officer" && messages[i + 1]?.role === "assistant" && !messages[i + 1].isError) {
        history.push({ question: messages[i].text, answer: messages[i + 1].text });
      }
    }

    setMessages((prev) => [...prev, { role: "officer", text: question }]);
    setInput("");
    setPending(true);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.error ?? "Something went wrong.", isError: true },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.answer, rowCount: data.rowCount, cached: data.cached },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Connection lost before an answer came back.", isError: true },
      ]);
    } finally {
      setPending(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  };

  return (
    <div className="flex h-[70vh] w-full max-w-2xl flex-col border border-[#2A2A2C] bg-[#0E0E0F]">
      {/* Header strip, matching UploadZone's console styling */}
      <div className="flex items-center justify-between border-b border-[#2A2A2C] bg-[#141415] px-4 py-2 font-mono text-[11px] tracking-wide text-[#8A8A8E]">
        <span>QUERY&nbsp;/&nbsp;02</span>
        <span className={pending ? "text-[#F5751E]" : "text-[#5A5A5E]"}>
          {pending ? "SEARCHING…" : "STANDBY"}
        </span>
      </div>

      {/* Message list */}
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-[#6A6A6E]">
              Ask about incidents, causes, response times, or station activity.
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="border border-[#2A2A2C] px-3 py-1.5 font-mono text-xs text-[#8A8A8E] transition-colors hover:border-[#F5751E] hover:text-[#EDEDEC]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "officer" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap px-3 py-2 text-sm leading-relaxed ${
                m.role === "officer"
                  ? "bg-[#F5751E] text-[#0A0A0B]"
                  : m.isError
                  ? "border border-[#E5484D]/40 bg-[#1A1213] text-[#E5A6A8]"
                  : "border border-[#2A2A2C] bg-[#141415] text-[#EDEDEC]"
              }`}
            >
              {m.text}
              {m.role === "assistant" && !m.isError && typeof m.rowCount === "number" && (
                <p className="mt-1.5 font-mono text-[10px] text-[#5A5A5E]">
                  {m.rowCount} record{m.rowCount === 1 ? "" : "s"} matched
                  {m.cached && <span className="text-[#F5751E]"> · cached</span>}
                </p>
              )}
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 border border-[#2A2A2C] bg-[#141415] px-3 py-2">
              <span className="h-1.5 w-1.5 animate-pulse bg-[#F5751E]" />
              <span className="h-1.5 w-1.5 animate-pulse bg-[#F5751E] [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse bg-[#F5751E] [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2 border-t border-[#2A2A2C] bg-[#141415] p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about incident data…"
          disabled={pending}
          className="flex-1 border border-[#2A2A2C] bg-[#0E0E0F] px-3 py-2 text-sm text-[#EDEDEC] outline-none placeholder:text-[#5A5A5E] focus:border-[#F5751E] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="border border-[#F5751E] px-4 py-2 text-sm font-medium text-[#F5751E] transition-colors hover:bg-[#F5751E] hover:text-[#0A0A0B] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#F5751E]"
        >
          Ask
        </button>
      </form>
    </div>
  );
}