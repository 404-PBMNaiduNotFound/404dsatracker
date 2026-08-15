import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import { SECTIONS } from "@/lib/a2z-data";
import { EXTRA_PROBLEMS, type Sheet } from "@/lib/extra-problems-data";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExternalLink, Search, X, ArrowUpDown, Filter, ChevronLeft, ChevronRight, Sparkles, Link2, Video, ChevronDown, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/lib/types";
import { useProblemCompletions } from "@/hooks/useProblemCompletions";
import { getChatGPTAiPromptUrl } from "@/lib/aiTutorPrompt";
import { CodeModal } from "@/components/CodeModal";
import type { CodeSubmission } from "@/lib/db";

function googleSearchUrl(problemName: string) {
  const query = `${problemName} DSA solution explanation site:leetcode.com OR site:geeksforgeeks.org OR site:takeuforward.org`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function youtubeSearchUrl(problemName: string) {
  const query = `${problemName} solution intuition explained NeetCode OR Striver`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type Platform =
  | "All"
  | "LeetCode"
  | "CodeStudio"
  | "GFG"
  | "CodeChef"
  | "HackerRank"
  | "AtCoder"
  | "Codeforces"
  | "TUF"
  | "Other";

export type SheetFilter = "All" | "Core 404" | Sheet;

export type StatusFilter =
  | "All"
  | "Completed"
  | "Incomplete"
  | "Attempted"
  | "Not Attempted"
  | "Revision Needed";

export type SortOption =
  | "Default Order"
  | "Problem Number"
  | "Problem Name"
  | "Recently Completed";

const PLATFORMS: Platform[] = [
  "All",
  "LeetCode",
  "CodeStudio",
  "GFG",
  "CodeChef",
  "HackerRank",
  "AtCoder",
  "Codeforces",
  "TUF",
  "Other",
];

const SHEET_FILTERS: SheetFilter[] = [
  "All",
  "Core 404",
  "DSA 500 Practice",
];

const STATUS_FILTERS: StatusFilter[] = [
  "Incomplete",
  "Completed",
  "All",
  "Attempted",
  "Not Attempted",
  "Revision Needed",
];

const SORT_OPTIONS: SortOption[] = [
  "Default Order",
  "Problem Number",
  "Problem Name",
  "Recently Completed",
];

// ─── Route Definition ────────────────────────────────────────────────────────

interface ProblemsSearch {
  page?: number;
  status?: StatusFilter;
  platform?: Platform;
  difficulty?: "All" | Difficulty;
  topic?: string;
  sheet?: SheetFilter;
  sort?: SortOption;
  q?: string;
}

export const Route = createFileRoute("/_authenticated/problems")({
  validateSearch: (search: Record<string, unknown>): ProblemsSearch => {
    return {
      page: search.page ? Number(search.page) : undefined,
      status: (search.status as StatusFilter) || undefined,
      platform: (search.platform as Platform) || undefined,
      difficulty: (search.difficulty as "All" | Difficulty) || undefined,
      topic: search.topic ? String(search.topic) : undefined,
      sheet: (search.sheet as SheetFilter) || undefined,
      sort: (search.sort as SortOption) || undefined,
      q: search.q ? String(search.q) : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Problems — DSA⁴⁰⁴" },
      {
        name: "description",
        content: "Browse 838+ verified problems from the Core 404 roadmap and the DSA 500 practice set.",
      },
    ],
  }),
  component: ProblemsPage,
});

export default ProblemsPage;

// ─── Platform helpers ────────────────────────────────────────────────────────

function canonicalPlatform(raw: string): Platform {
  const r = raw.toLowerCase();
  if (r.includes("leetcode")) return "LeetCode";
  if (r.includes("gfg") || r.includes("geeks")) return "GFG";
  if (r.includes("hacker")) return "HackerRank";
  if (r.includes("code") && r.includes("studio")) return "CodeStudio";
  if (r.includes("chef")) return "CodeChef";
  if (r.includes("atcoder")) return "AtCoder";
  if (r.includes("forces")) return "Codeforces";
  if (r.includes("tuf") || r.includes("striver") || r.includes("takeuforward")) return "TUF";
  return "Other";
}

function platformSearchLink(name: string, platform: Platform): string {
  const q = encodeURIComponent(name);
  switch (platform) {
    case "LeetCode": return `https://leetcode.com/problemset/?search=${q}`;
    case "GFG": return `https://www.geeksforgeeks.org/explore?search=${q}`;
    case "HackerRank": return `https://www.hackerrank.com/domains/data-structures`;
    case "CodeStudio": return `https://www.naukri.com/code360/search?q=${q}`;
    case "CodeChef": return `https://www.codechef.com/practice?search=${q}`;
    case "AtCoder": return `https://atcoder.jp/tasks?keyword=${q}`;
    case "Codeforces": return `https://codeforces.com/problemset?query=${q}`;
    case "TUF": return `https://takeuforward.org/?s=${q}`;
    default: return `https://leetcode.com/problemset/?search=${q}`;
  }
}

export const PLATFORM_META: Record<Platform, { label: string; color: string; bg: string; dot: string }> = {
  All: { label: "All", color: "text-foreground", bg: "bg-secondary", dot: "bg-muted-foreground" },
  LeetCode: { label: "LeetCode", color: "text-[#FFA116]", bg: "bg-[#FFA116]/10", dot: "bg-[#FFA116]" },
  CodeStudio: { label: "CodeStudio", color: "text-[#F97316]", bg: "bg-[#F97316]/10", dot: "bg-[#F97316]" },
  GFG: { label: "GeeksforGeeks", color: "text-[#2F8D46]", bg: "bg-[#2F8D46]/10", dot: "bg-[#2F8D46]" },
  CodeChef: { label: "CodeChef", color: "text-[#5B4638]", bg: "bg-[#5B4638]/10", dot: "bg-[#5B4638]" },
  HackerRank: { label: "HackerRank", color: "text-[#2EC866]", bg: "bg-[#2EC866]/10", dot: "bg-[#2EC866]" },
  AtCoder: { label: "AtCoder", color: "text-[#333333]", bg: "bg-muted", dot: "bg-foreground" },
  Codeforces: { label: "Codeforces", color: "text-[#1F8ACB]", bg: "bg-[#1F8ACB]/10", dot: "bg-[#1F8ACB]" },
  TUF: { label: "TUF", color: "text-primary", bg: "bg-primary/10", dot: "bg-primary" },
  Other: { label: "Other", color: "text-muted-foreground", bg: "bg-secondary", dot: "bg-muted-foreground" },
};

const DIFF_META: Record<string, { label: string; color: string; bg: string }> = {
  Easy: { label: "Easy", color: "text-easy", bg: "bg-easy/10" },
  Medium: { label: "Medium", color: "text-medium", bg: "bg-medium/10" },
  Hard: { label: "Hard", color: "text-hard", bg: "bg-hard/10" },
  Advanced: { label: "Advanced", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" },
  Expert: { label: "Expert", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
  "Multiple Choice": { label: "MCQ", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
};

const SHEET_META: Record<SheetFilter, { color: string; bg: string }> = {
  "All": { color: "text-foreground", bg: "bg-secondary" },
  "Core 404": { color: "text-primary", bg: "bg-primary/10" },
  "DSA 500 Practice": { color: "text-[#00B8A3]", bg: "bg-[#00B8A3]/10" },
};

// ─── Unified flat problem type ───────────────────────────────────────────────

interface FlatProblem {
  id: number;
  name: string;
  difficulty: Difficulty;
  platform: Platform;
  topic: string;
  sheet: SheetFilter;
  link: string;
}

function buildAllProblems(): FlatProblem[] {
  let globalId = 1;
  const a2z: FlatProblem[] = SECTIONS.flatMap((sec) =>
    sec.problems
      .map((p) => {
        const plat = canonicalPlatform(p.p);
        const link = p.l!; // every core problem now carries a verified link (see master-problems.ts)
        return {
          id: globalId++,
          name: p.n,
          difficulty: p.d,
          platform: plat,
          topic: sec.section,
          sheet: "Core 404" as SheetFilter,
          link,
        };
      }),
  );

  const extra: FlatProblem[] = EXTRA_PROBLEMS.map((p) => ({
    id: globalId++,
    name: p.name,
    difficulty: p.difficulty,
    platform: canonicalPlatform(p.platform),
    topic: p.topic,
    sheet: p.sheet as SheetFilter,
    link: p.link,
  }));

  const seen = new Set<string>();
  return [...a2z, ...extra].filter((p) => {
    const key = `${p.name.toLowerCase()}|${p.link}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const ALL_PROBLEMS = buildAllProblems();

function countBy<T>(arr: T[], key: (x: T) => string): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, x) => {
    const k = key(x);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

// ─── Problem row ─────────────────────────────────────────────────────────────

function ProblemItem({
  problem,
  done,
  onToggle,
  readOnly = false,
  submission,
  submitCode,
}: {
  problem: FlatProblem;
  done: boolean;
  onToggle: () => void;
  readOnly?: boolean;
  submission?: CodeSubmission;
  submitCode?: (name: string, code: string, link?: string) => Promise<void>;
}) {
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const hasSubmission = !!submission?.code;

  const diff = DIFF_META[problem.difficulty] ?? {
    label: problem.difficulty || "Medium",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
  };
  const pm = PLATFORM_META[problem.platform] ?? PLATFORM_META["Other"];
  const sm = SHEET_META[problem.sheet] ?? SHEET_META["All"];
  const checkId = `pb-${problem.id}-${problem.name.replace(/\W+/g, "-")}`;

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:bg-secondary/40",
        done && "border-green-500/30 bg-green-500/5",
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Checkbox
              id={checkId}
              checked={done}
              disabled={readOnly}
              onCheckedChange={readOnly ? undefined : onToggle}
              aria-label={readOnly ? `${problem.name} — mark complete from Today or Backlog tab` : `Mark ${problem.name} as ${done ? "incomplete" : "complete"}`}
              className="size-4 shrink-0"
            />
          </span>
        </TooltipTrigger>
        {readOnly && (
          <TooltipContent side="right">
            Mark complete from the Today or Backlog tab
          </TooltipContent>
        )}
      </Tooltip>

      <span className="w-8 shrink-0 text-xs text-muted-foreground font-mono">
        #{problem.id}
      </span>

      <label
        htmlFor={checkId}
        className={cn(
          "min-w-0 flex-1 cursor-pointer text-sm font-medium",
          done && "text-muted-foreground line-through",
        )}
      >
        {problem.name}
      </label>

      <span
        className={cn(
          "hidden rounded-full border border-border px-2 py-0.5 text-[10px] font-medium sm:inline",
          sm.bg,
          sm.color,
        )}
      >
        {problem.sheet}
      </span>

      <span className="hidden rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground lg:inline">
        {problem.topic}
      </span>

      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", diff.bg, diff.color)}>
        {problem.difficulty}
      </span>

      <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", pm.bg, pm.color)}>
        <span className={cn("size-1.5 rounded-full", pm.dot)} />
        {pm.label}
      </span>

      <div className="flex items-center gap-1.5 shrink-0">
        {/* Direct Link to Official Platform */}
        {problem.link && (
          <a
            href={problem.link}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-1 text-xs font-semibold text-foreground transition-colors"
            title={`Open official page on ${problem.platform}`}
          >
            <span className="hidden xs:inline">{problem.platform}</span>
            <ExternalLink className="size-3 text-muted-foreground" />
          </a>
        )}

        {/* Links Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-1 text-xs font-semibold text-foreground transition-colors"
              title="All problem links & resources"
            >
              <Link2 className="size-3.5 text-sky-400" />
              <span>Links</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl border border-white/15 bg-card/95 backdrop-blur-2xl p-1 shadow-2xl">
            {problem.link && (
              <DropdownMenuItem asChild>
                <a href={problem.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <ExternalLink className="size-3.5 text-sky-400" />
                  <span>{problem.platform} Official Page</span>
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <a href={getChatGPTAiPromptUrl(problem.name)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <Sparkles className="size-3.5 text-emerald-400" />
                <span>ChatGPT AI Tutor & Prompt</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={youtubeSearchUrl(problem.name)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Video className="size-3.5 text-rose-500" />
                <span>YouTube Solution Video</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={googleSearchUrl(problem.name)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Search className="size-3.5 text-sky-400" />
                <span>Google Search Solution</span>
              </a>
            </DropdownMenuItem>
            {hasSubmission && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setCodeModalOpen(true)} className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                  <Code2 className="size-3.5 text-emerald-400" />
                  <span>View Submitted Code</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Solve Button */}
        <a
          href={getChatGPTAiPromptUrl(problem.name)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
          title="Solve with Interactive ChatGPT DSA AI Tutor"
        >
          <Sparkles className="size-3 text-emerald-400" />
          Solve
        </a>

        {/* Code Button */}
        <button
          onClick={() => setCodeModalOpen(true)}
          className={cn(
            "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
            hasSubmission
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
              : "border border-border text-muted-foreground hover:border-primary hover:text-primary",
          )}
        >
          <Code2 className="size-3" />
          <span>{hasSubmission ? "Code" : "Add Code"}</span>
        </button>
      </div>

      <CodeModal
        open={codeModalOpen}
        onOpenChange={setCodeModalOpen}
        problemName={problem.name}
        existingSubmission={submission}
        onSave={async (code, link) => {
          if (submitCode) {
            await submitCode(problem.name, code, link);
          }
          if (!done && !readOnly) {
            onToggle();
          }
        }}
      />
    </li>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

function ProblemsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { completed, submissions, submitCode, toggle, loading } = useProblemCompletions();

  // Read search params from TanStack Router
  const paramQuery = search.q ?? "";
  const paramStatus = search.status ?? (paramQuery ? "All" : "Incomplete");

  const [pageSize, setPageSize] = useState<number>(10);
  const [initialJumpDone, setInitialJumpDone] = useState(false);

  // All topics list for topic selector
  const topicsList = useMemo(() => {
    const set = new Set<string>();
    ALL_PROBLEMS.forEach((p) => set.add(p.topic));
    return ["All", ...Array.from(set).sort()];
  }, []);

  // Update URL helper via TanStack Router navigate
  const updateUrl = useCallback(
    (params: Record<string, string | number | null | undefined>) => {
      navigate({
        search: (old: any) => {
          const next = { ...old, ...params };
          Object.keys(next).forEach((key) => {
            const val = next[key];
            if (
              val === null ||
              val === undefined ||
              val === "" ||
              val === "All" ||
              val === "Default Order" ||
              (key === "page" && val === 1)
            ) {
              delete next[key];
            }
          });
          return next;
        },
        replace: true,
      });
    },
    [navigate],
  );

  // Filtered dataset
  const filtered = useMemo(() => {
    return ALL_PROBLEMS.filter((p) => {
      const isDone = completed.has(p.name);
      const hasSubmission = Boolean(submissions[p.name]);

      if (paramStatus === "Completed" && !isDone) return false;
      if (paramStatus === "Incomplete" && isDone) return false;
      if (paramStatus === "Attempted" && !hasSubmission) return false;
      if (paramStatus === "Not Attempted" && hasSubmission) return false;
      if (paramStatus === "Revision Needed" && !hasSubmission) return false;

      if (paramDiff !== "All" && p.difficulty !== paramDiff) return false;
      if (paramPlat !== "All" && p.platform !== paramPlat) return false;
      if (paramSheet !== "All" && p.sheet !== paramSheet) return false;
      if (paramTopic !== "All" && p.topic !== paramTopic) return false;

      if (paramQuery.trim()) {
        const q = paramQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.topic.toLowerCase().includes(q) ||
          p.sheet.toLowerCase().includes(q) ||
          p.platform.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [paramStatus, paramDiff, paramPlat, paramSheet, paramTopic, paramQuery, completed, submissions]);

  // Sorted dataset
  const sortedAndFiltered = useMemo(() => {
    const list = [...filtered];
    switch (paramSort) {
      case "Problem Number":
        return list.sort((a, b) => a.id - b.id);
      case "Problem Name":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "Recently Completed":
        return list.sort((a, b) => {
          const aDone = completed.has(a.name);
          const bDone = completed.has(b.name);
          if (aDone && !bDone) return -1;
          if (!aDone && bDone) return 1;
          return a.id - b.id;
        });
      default:
        return list;
    }
  }, [filtered, paramSort, completed]);

  const totalPages = Math.max(1, Math.ceil(sortedAndFiltered.length / pageSize));
  const currentPage = isNaN(paramPage) || paramPage < 1 ? 1 : Math.min(paramPage, totalPages);

  // Auto-jump to the user's active/last solved page if no ?page= param was specified
  useEffect(() => {
    if (loading || initialJumpDone || search.page !== undefined) return;

    if (sortedAndFiltered.length > 0) {
      let targetIndex = -1;
      for (let i = sortedAndFiltered.length - 1; i >= 0; i--) {
        if (completed.has(sortedAndFiltered[i].name)) {
          targetIndex = i;
          break;
        }
      }
      if (targetIndex === -1) targetIndex = 0;

      const targetPage = Math.floor(targetIndex / pageSize) + 1;
      if (targetPage !== currentPage) {
        updateUrl({ page: targetPage });
      }
    }
    setInitialJumpDone(true);
  }, [loading, initialJumpDone, search.page, sortedAndFiltered, completed, pageSize, currentPage, updateUrl]);

  // Handle page change with auto scroll-to-top
  const setPage = (p: number) => {
    const nextP = Math.max(1, Math.min(p, totalPages));
    updateUrl({ page: nextP });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const setFilterState = (updates: Record<string, string | number | null | undefined>) => {
    updateUrl({ ...updates, page: 1 });
  };

  // Paginated items
  const paginatedProblems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedAndFiltered.slice(start, start + pageSize);
  }, [sortedAndFiltered, currentPage, pageSize]);

  const diffCounts = useMemo(() => countBy(ALL_PROBLEMS, (p) => p.difficulty), []);
  const totalDone = completed.size;
  const filteredDone = useMemo(
    () => sortedAndFiltered.filter((p) => completed.has(p.name)).length,
    [sortedAndFiltered, completed],
  );

  const hasActiveFilter =
    paramDiff !== "All" ||
    paramPlat !== "All" ||
    paramSheet !== "All" ||
    paramTopic !== "All" ||
    paramStatus !== "Incomplete" ||
    paramSort !== "Default Order" ||
    paramQuery.trim() !== "";

  function clearFilters() {
    updateUrl({
      page: 1,
      status: "All",
      platform: "All",
      difficulty: "All",
      topic: "All",
      sheet: "All",
      sort: "Default Order",
      q: "",
    });
  }

  const startItem = sortedAndFiltered.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, sortedAndFiltered.length);

  return (
    <>
      {/* Page Header */}
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Problems</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {ALL_PROBLEMS.length} verified problems from 6 sheets —{" "}
            <span className="font-medium text-green-600 dark:text-green-400">
              {totalDone} completed
            </span>
            {" • "}
            <span className="font-medium text-amber-600 dark:text-amber-400">
              {ALL_PROBLEMS.length - totalDone} remaining
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["Easy", "Medium", "Hard"] as Difficulty[]).map((d) => {
            const m = DIFF_META[d];
            return (
              <span key={d} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", m.bg, m.color)}>
                {diffCounts[d] ?? 0} {d}
              </span>
            );
          })}
        </div>
      </div>

      {/* Sticky Advanced Filter Bar */}
      <div className="sticky top-0 z-20 mb-4 rounded-xl border border-border bg-background/95 p-3 backdrop-blur shadow-sm space-y-3">
        {/* Search + Sort Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by problem name, topic, or sheet…"
              value={paramQuery}
              onChange={(e) => setFilterState({ q: e.target.value })}
              className="pl-9 pr-9 h-9 text-xs"
            />
            {paramQuery && (
              <button
                type="button"
                onClick={() => setFilterState({ q: "" })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="size-3.5 text-muted-foreground hidden sm:inline" />
            <select
              value={paramSort}
              onChange={(e) => setFilterState({ sort: e.target.value })}
              className="h-9 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Sort Order"
            >
              {SORT_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  Sort: {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Pills */}
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">Status:</span>
            {STATUS_FILTERS.map((st) => {
              const active = paramStatus === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterState({ status: st })}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all",
                    active
                      ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Filter Dropdowns & Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Difficulty Tabs */}
            <Tabs value={paramDiff} onValueChange={(v) => setFilterState({ difficulty: v })}>
              <TabsList className="h-8 bg-muted/60 p-0.5">
                {(["All", "Easy", "Medium", "Hard"] as const).map((d) => (
                  <TabsTrigger key={d} value={d} className="h-7 px-2.5 text-xs font-medium">
                    {d}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Platform Selector */}
            <select
              value={paramPlat}
              onChange={(e) => setFilterState({ platform: e.target.value })}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground focus:outline-none"
              aria-label="Platform Filter"
            >
              <option value="All">All Platforms</option>
              {PLATFORMS.filter((p) => p !== "All").map((pl) => (
                <option key={pl} value={pl}>
                  {PLATFORM_META[pl].label}
                </option>
              ))}
            </select>

            {/* Sheet Selector */}
            <select
              value={paramSheet}
              onChange={(e) => setFilterState({ sheet: e.target.value })}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground focus:outline-none"
              aria-label="Sheet Filter"
            >
              <option value="All">All Sheets</option>
              {SHEET_FILTERS.filter((s) => s !== "All").map((sf) => (
                <option key={sf} value={sf}>
                  {sf}
                </option>
              ))}
            </select>

            {/* Topic Selector */}
            <select
              value={paramTopic}
              onChange={(e) => setFilterState({ topic: e.target.value })}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground focus:outline-none max-w-[180px] truncate"
              aria-label="Topic Filter"
            >
              <option value="All">All Topics ({topicsList.length - 1})</option>
              {topicsList.filter((t) => t !== "All").map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              <X className="size-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Live Results Bar Summary (FEATURE 4) */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{startItem} - {endItem}</strong> of <strong className="text-foreground">{sortedAndFiltered.length}</strong> Problems
          </span>
          <span>•</span>
          <span className="text-green-600 dark:text-green-400 font-medium">
            Completed: {filteredDone}
          </span>
          <span>•</span>
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            Remaining: {sortedAndFiltered.length - filteredDone}
          </span>
          <span>•</span>
          <span>
            Current Page: <strong className="text-foreground">{currentPage} / {totalPages}</strong>
          </span>
        </div>

        {/* Per page size selector */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Per page:</span>
          {[10, 20, 50, 100].map((sz) => (
            <button
              key={sz}
              type="button"
              onClick={() => {
                setPageSize(sz);
                setPage(1);
              }}
              className={cn(
                "rounded px-2 py-0.5 font-medium transition-colors text-xs",
                pageSize === sz
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {sz}
            </button>
          ))}
        </div>
      </div>

      {/* Problem List */}
      {sortedAndFiltered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <Filter className="mx-auto size-8 mb-2 opacity-40" />
          <p>No problems match your selected filters.</p>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-primary underline underline-offset-2"
            onClick={clearFilters}
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {paginatedProblems.map((p) => (
            <ProblemItem
              key={`${p.sheet}|${p.id}|${p.name}`}
              problem={p}
              done={completed.has(p.name)}
              onToggle={() => void toggle(p.name)}
              submission={submissions[p.name]}
              submitCode={submitCode}
              readOnly
            />
          ))}
        </ul>
      )}

      {/* Pagination Footer Controls (FEATURE 1) */}
      {totalPages > 1 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
            <span className="font-semibold text-foreground">{totalPages}</span>
          </p>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
              aria-label="Previous Page"
            >
              <ChevronLeft className="size-3.5" /> Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => {
                if (totalPages <= 7) return true;
                return p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2;
              })
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;
                return (
                  <div key={p} className="flex items-center gap-1">
                    {showEllipsis && (
                      <span className="px-1.5 text-xs text-muted-foreground select-none">...</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setPage(p)}
                      aria-current={currentPage === p ? "page" : undefined}
                      className={cn(
                        "min-w-8 h-8 rounded-md border text-xs font-medium transition-colors",
                        currentPage === p
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      {p}
                    </button>
                  </div>
                );
              })}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
              aria-label="Next Page"
            >
              Next <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

