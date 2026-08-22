"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid } from "recharts";

/**
 * Props for the progress chart.
 * `data` should be an array of objects with `date` (string) and `solved` (number).
 */
export interface UserProgressChartProps {
  data: { date: string; solved: number }[];
}

export function UserProgressChart({ data }: UserProgressChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.2} />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <ReTooltip
          contentStyle={{ background: "var(--card)", borderColor: "var(--border)" }}
          formatter={(value: number) => [value, "Solved"]}
        />
        <Line type="monotone" dataKey="solved" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
