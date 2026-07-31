"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Props {
  data: { month: string; count: number }[];
}

export default function IncidentsOverTimeChart({ data }: Props) {
  if (data.length === 0) {
    return <EmptyState label="No dated incidents to chart yet." />;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="#2A2A2C" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: "#6A6A6E", fontSize: 11, fontFamily: "monospace" }}
          axisLine={{ stroke: "#2A2A2C" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#6A6A6E", fontSize: 11, fontFamily: "monospace" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "#F5751E", fillOpacity: 0.08 }}
          contentStyle={{
            background: "#141415",
            border: "1px solid #2A2A2C",
            fontSize: 12,
            fontFamily: "monospace",
          }}
          labelStyle={{ color: "#8A8A8E" }}
        />
        <Bar dataKey="count" fill="#F5751E" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center font-mono text-xs text-[#5A5A5E]">
      {label}
    </div>
  );
}