"use client";

import { useMemo, useState } from "react";
import { format, parseISO, startOfWeek, addDays, getMonth, getYear } from "date-fns";
import { DayDetailModal } from "./DayDetailModal";
import { Flame, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

export interface SubmissionHeatmapProps {
  data: { date: string; solved: number }[];
  detailMap: Record<string, any[]>;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

// GitHub/LeetCode style color levels
function getHeatmapLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

const LEVEL_CLASSES: Record<number, string> = {
  0: "bg-muted/40 dark:bg-[#161b22] border border-border/20 hover:border-border",
  1: "bg-[#9be9a8] dark:bg-[#0e4429] border border-[#7bc98a]/30 dark:border-[#0e4429]",
  2: "bg-[#40c463] dark:bg-[#006d32] border border-[#34a853]/30 dark:border-[#006d32]",
  3: "bg-[#30a14e] dark:bg-[#26a641] border border-[#238636]/30 dark:border-[#26a641]",
  4: "bg-[#216e39] dark:bg-[#39d353] border border-[#1b5e20]/30 dark:border-[#39d353]",
};

export function SubmissionHeatmap({ data, detailMap }: SubmissionHeatmapProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("All");
  const [windowOffset, setWindowOffset] = useState<number>(0);

  // Available years in data
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    data.forEach((d) => {
      if (d.date && d.date.length >= 4) {
        years.add(d.date.slice(0, 4));
      }
    });
    const currentYr = new Date().getFullYear().toString();
    years.add(currentYr);
    return ["All", ...Array.from(years).sort().reverse()];
  }, [data]);

  // Filter data by selected year
  const filteredData = useMemo(() => {
    if (selectedYear === "All") return data;
    return data.filter((d) => d.date.startsWith(selectedYear));
  }, [data, selectedYear]);

  // Total solved count across filtered dates
  const totalSubmissions = useMemo(
    () => filteredData.reduce((acc, d) => acc + d.solved, 0),
    [filteredData]
  );

  // Map date -> solved count for O(1) lookup
  const countMap = useMemo(() => {
    const map = new Map<string, number>();
    filteredData.forEach((d) => map.set(d.date, d.solved));
    return map;
  }, [filteredData]);

  // Construct calendar weeks grid
  const allWeeksData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return { weeks: [], monthHeaders: [] };
    }

    const sortedDates = filteredData.map((d) => d.date).sort();
    const firstDate = parseISO(sortedDates[0]);
    const lastDate = parseISO(sortedDates[sortedDates.length - 1]);

    let curr = startOfWeek(firstDate, { weekStartsOn: 1 });
    const weeksList: { dateStr: string; dayIndex: number; month: number }[][] = [];
    const months: { name: string; weekIndex: number; year: number }[] = [];

    let lastMonth = -1;
    let weekIdx = 0;

    while (curr <= lastDate || weeksList.length < 24) {
      const week: { dateStr: string; dayIndex: number; month: number }[] = [];
      const monthOfFirstDay = getMonth(curr);
      const yearOfFirstDay = getYear(curr);

      if (monthOfFirstDay !== lastMonth) {
        months.push({ name: MONTH_NAMES[monthOfFirstDay], weekIndex: weekIdx, year: yearOfFirstDay });
        lastMonth = monthOfFirstDay;
      }

      for (let day = 0; day < 7; day++) {
        const dateStr = format(curr, "yyyy-MM-dd");
        week.push({ dateStr, dayIndex: day, month: getMonth(curr) });
        curr = addDays(curr, 1);
      }
      weeksList.push(week);
      weekIdx++;
      if (weeksList.length >= 104) break;
    }

    return { weeks: weeksList, monthHeaders: months };
  }, [filteredData]);

  // Month chunks / sliding window (12 months desktop, 3 months mobile)
  const isMobile = useIsMobile();
  const visibleWeeksWindow = isMobile ? 13 : 52;
  const maxOffset = Math.max(0, Math.ceil((allWeeksData.weeks.length - visibleWeeksWindow) / 4));

  const currentWindowStartWeek = Math.max(0, windowOffset * 4);
  const currentWindowEndWeek = currentWindowStartWeek + visibleWeeksWindow;

  const visibleWeeks = useMemo(() => {
    return allWeeksData.weeks.slice(currentWindowStartWeek, currentWindowEndWeek);
  }, [allWeeksData.weeks, currentWindowStartWeek, currentWindowEndWeek]);

  const visibleMonthHeaders = useMemo(() => {
    return allWeeksData.monthHeaders
      .filter(
        (m) =>
          m.weekIndex >= currentWindowStartWeek &&
          m.weekIndex < currentWindowEndWeek
      )
      .map((m) => ({
        ...m,
        relWeekIndex: m.weekIndex - currentWindowStartWeek,
      }));
  }, [allWeeksData.monthHeaders, currentWindowStartWeek, currentWindowEndWeek]);

  if (allWeeksData.weeks.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No submission data recorded for this period.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Submissions Summary & Controls Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Flame className="size-4 text-orange-500 animate-pulse shrink-0" />
          <span>
            <strong className="text-foreground text-base tabular-nums">{totalSubmissions}</strong> submissions
            {selectedYear !== "All" ? ` in ${selectedYear}` : " in overall schedule"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Year Filter Dropdown / Pills */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            <Calendar className="size-3.5 ml-2 text-muted-foreground shrink-0" />
            {availableYears.map((yr) => (
              <button
                key={yr}
                onClick={() => {
                  setSelectedYear(yr);
                  setWindowOffset(0);
                }}
                className={`rounded-md px-2 py-1 font-medium transition-all ${
                  selectedYear === yr
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          {/* Month Slider Navigation Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setWindowOffset((prev) => Math.max(0, prev - 1))}
              disabled={windowOffset <= 0}
              title="Previous months"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setWindowOffset((prev) => Math.min(maxOffset, prev + 1))}
              disabled={currentWindowEndWeek >= allWeeksData.weeks.length}
              title="Next months"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Larger GitHub / LeetCode Heatmap Grid ── */}
      <div className="overflow-x-auto pb-2 scrollbar-thin">
        <div className="inline-block min-w-full align-middle">
          {/* Month headers row */}
          <div className="flex text-[11px] font-medium text-muted-foreground mb-1.5 pl-8">
            {visibleMonthHeaders.map((m, i) => {
              const nextCol =
                visibleMonthHeaders[i + 1]?.relWeekIndex ?? visibleWeeks.length;
              const span = Math.max(1, nextCol - m.relWeekIndex);
              return (
                <span
                  key={`${m.name}-${m.relWeekIndex}`}
                  style={{ width: `${span * 20}px` }}
                  className="truncate font-mono"
                >
                  {m.name}
                </span>
              );
            })}
          </div>

          {/* Grid rows (Days x Weeks) */}
          <div className="flex items-start gap-1.5">
            {/* Day of week labels (Mon, Wed, Fri) */}
            <div className="grid grid-rows-7 gap-1 pr-1.5 text-[11px] font-mono text-muted-foreground select-none shrink-0 pt-[2px]">
              {DAY_LABELS.map((lbl, idx) => (
                <span key={idx} className="h-4 leading-4 flex items-center">
                  {lbl}
                </span>
              ))}
            </div>

            {/* Weeks columns (larger squares: size-4 sm:size-4.5) */}
            <div className="flex gap-1">
              {visibleWeeks.map((week, wi) => (
                <div key={wi} className="grid grid-rows-7 gap-1 shrink-0">
                  {week.map(({ dateStr }) => {
                    const count = countMap.get(dateStr) ?? 0;
                    const level = getHeatmapLevel(count);
                    const formattedDate = format(parseISO(dateStr), "MMM d, yyyy");
                    return (
                      <button
                        key={dateStr}
                        onClick={() => setSelectedDate(dateStr)}
                        className={`size-4 sm:size-4.5 rounded-[3px] transition-all hover:scale-125 hover:z-10 focus:outline-none focus:ring-2 focus:ring-ring ${LEVEL_CLASSES[level]}`}
                        title={`${formattedDate}: ${count} problem${count === 1 ? "" : "s"} solved`}
                        aria-label={`${formattedDate}: ${count} solved`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Heatmap Footer / Legend ── */}
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground pt-1">
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((lvl) => (
            <span
              key={lvl}
              className={`size-3.5 rounded-[3px] ${LEVEL_CLASSES[lvl]}`}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* ── Day Details Modal on Click ── */}
      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          problems={detailMap[selectedDate] ?? []}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
