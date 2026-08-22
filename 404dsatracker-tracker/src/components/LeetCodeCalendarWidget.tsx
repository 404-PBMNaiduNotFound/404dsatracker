"use client";

import { useMemo } from "react";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import { Flame, Calendar as CalendarIcon, CheckCircle2 } from "lucide-react";
import { todayIso } from "@/lib/plan";

interface LeetCodeCalendarWidgetProps {
  heatmapData: { date: string; solved: number }[];
  streakCount: number;
  selectedDate?: string | null;
  onSelectDate?: (dateStr: string) => void;
}

const WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function LeetCodeCalendarWidget({
  heatmapData,
  streakCount,
  selectedDate,
  onSelectDate,
}: LeetCodeCalendarWidgetProps) {
  const todayDate = useMemo(() => new Date(), []);
  const todayStr = todayIso();

  // Create count map: dateStr -> solved count
  const countMap = useMemo(() => {
    const map = new Map<string, number>();
    heatmapData.forEach((d) => {
      if (d.solved > 0) {
        map.set(d.date, d.solved);
      }
    });
    return map;
  }, [heatmapData]);

  // Month days range
  const { daysInMonth, monthLabel, leadingPaddingDays, activeDaysInMonth } = useMemo(() => {
    const start = startOfMonth(todayDate);
    const end = endOfMonth(todayDate);
    const days = eachDayOfInterval({ start, end });
    const padding = getDay(start); // 0 (Sun) to 6 (Sat)
    const mLabel = format(todayDate, "MMMM yyyy");

    let activeCount = 0;
    days.forEach((d) => {
      const dStr = format(d, "yyyy-MM-dd");
      if ((countMap.get(dStr) ?? 0) > 0) {
        activeCount++;
      }
    });

    return {
      daysInMonth: days,
      monthLabel: mLabel,
      leadingPaddingDays: padding,
      activeDaysInMonth: activeCount,
    };
  }, [todayDate, countMap]);

  return (
    <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-xl p-4 sm:p-5 shadow-xl flex flex-col justify-between h-full space-y-3">
      {/* Widget Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-4 text-emerald-400" />
          <h4 className="text-sm font-bold tracking-tight text-foreground">{monthLabel}</h4>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-xs font-bold text-orange-400">
          <Flame className="size-3.5 text-orange-500" />
          <span>{streakCount} Active</span>
        </div>
      </div>

      {/* Days Grid Header (S M T W T F S) */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted-foreground select-none">
        {WEEK_DAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty padding cells for start of month */}
        {Array.from({ length: leadingPaddingDays }).map((_, i) => (
          <div key={`pad-${i}`} className="size-7 sm:size-7.5" />
        ))}

        {/* Month Day Cells */}
        {daysInMonth.map((dayDate) => {
          const dateStr = format(dayDate, "yyyy-MM-dd");
          const dayNum = format(dayDate, "d");
          const count = countMap.get(dateStr) ?? 0;
          const isToday = dateStr === todayStr;
          const isSelected = selectedDate === dateStr;
          const isSolved = count > 0;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate?.(dateStr)}
              className={`group relative flex size-7 sm:size-7.5 items-center justify-center rounded-xl text-xs font-semibold transition-all duration-200 select-none cursor-pointer ${
                isSelected
                  ? "bg-primary text-white font-extrabold shadow-lg ring-2 ring-primary/60 scale-105 z-10"
                  : isSolved
                  ? "bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/30 hover:scale-110"
                  : isToday
                  ? "border border-primary/60 bg-primary/10 text-primary font-bold"
                  : "bg-white/5 text-muted-foreground/80 hover:bg-white/10 hover:text-foreground"
              }`}
              title={`${format(dayDate, "MMM d, yyyy")}: ${count} problem${count === 1 ? "" : "s"} solved. Click to view!`}
            >
              <span>{dayNum}</span>

              {/* Tooltip on Hover */}
              <div className="absolute bottom-full mb-1.5 hidden group-hover:flex flex-col items-center z-30 pointer-events-none">
                <div className="rounded-lg bg-popover border border-white/10 px-2 py-1 text-[10px] text-popover-foreground shadow-xl whitespace-nowrap font-medium">
                  {format(dayDate, "MMM d")}: {count} solved (Click)
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Widget Footer */}
      <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-muted-foreground pt-2 border-t border-white/10">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="size-3 text-emerald-400" />
          <strong className="text-foreground">{activeDaysInMonth}</strong> active days
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-emerald-500 inline-block" /> Solved
        </span>
      </div>
    </div>
  );
}
