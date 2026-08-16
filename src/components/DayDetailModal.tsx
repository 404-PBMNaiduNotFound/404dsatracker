"use client";

import { X } from "lucide-react";

/**
 * Props for the day detail modal.
 */
interface DayDetailModalProps {
  date: string;
  problems: any[]; // Replace `any` with appropriate problem type if available
  onClose: () => void;
}

export function DayDetailModal({ date, problems, onClose }: DayDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
        <button
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted/50"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
        <h2 className="mb-4 text-xl font-semibold">{new Date(date).toLocaleDateString(undefined, { dateStyle: "medium" })}</h2>
        {problems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submissions for this day.</p>
        ) : (
          <ul className="space-y-2">
            {problems.map((p, i) => (
              <li key={i} className="flex flex-col rounded border border-border bg-muted p-2">
                <span className="font-medium">{p.name ?? "Problem"}</span>
                {p.platform && <span className="text-xs text-muted-foreground">{p.platform}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
