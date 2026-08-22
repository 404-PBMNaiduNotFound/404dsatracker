"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ALL_PROBLEMS } from "@/lib/problems";
import { SECTIONS } from "@/lib/a2z-data";
import {
  Search,
  Sparkles,
  Code2,
  LayoutGrid,
  CalendarRange,
  BookmarkCheck,
  CalendarDays,
  Trophy,
  Flame,
  Settings,
  ExternalLink,
  ChevronRight,
  Ban,
  UserCircle2,
  Palette,
  Camera,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getChatGPTAiPromptUrl } from "@/lib/aiTutorPrompt";

interface GlobalSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenColorPanel?: () => void;
}

interface DeepNavItem {
  label: string;
  href?: string;
  action?: "color-panel";
  icon: any;
  desc: string;
  keywords: string[];
}

const FEATURE_ITEMS: DeepNavItem[] = [
  {
    label: "Developer Profile & Handles",
    href: "/today?tab=profile",
    icon: UserCircle2,
    desc: "View and edit coding handles (LeetCode, Codeforces, GFG) and custom links",
    keywords: ["profile", "handles", "bio", "user", "leetcode profile", "codeforces", "github"],
  },
  {
    label: "Edit Cover Banner & Avatar",
    href: "/today?tab=profile",
    icon: Camera,
    desc: "Upload or change your profile picture avatar and cover banner backdrop",
    keywords: ["banner", "photo", "avatar", "image", "upload", "cover"],
  },
  {
    label: "Customize Theme, Colors & Fonts",
    action: "color-panel",
    icon: Palette,
    desc: "Open color panel to customize app colors, theme mode, and fonts",
    keywords: ["theme", "color", "colors", "font", "customize", "palette", "dark mode", "light mode"],
  },
  {
    label: "Solved Days & Heatmap Archive",
    href: "/today?tab=calendar",
    icon: CheckCircle2,
    desc: "View activity heatmap and all solved problem code solutions",
    keywords: ["solved", "heatmap", "activity", "calendar", "green days", "solutions"],
  },
  {
    label: "Today's Workspace",
    href: "/today?tab=today",
    icon: Sparkles,
    desc: "Daily topic, core problems, streak, and schedule controls",
    keywords: ["workspace", "today", "topic", "streak", "postpone", "merge"],
  },
  {
    label: "All Problems List",
    href: "/problems",
    icon: Code2,
    desc: "Filter 838+ problems by platform, difficulty, or problem sheet",
    keywords: ["problems", "sheet", "a2z", "practice", "questions"],
  },
  {
    label: "Topic View & Skipped Topics",
    href: "/topics",
    icon: LayoutGrid,
    desc: "All 42 Core topics, section progress, and skipped topics section",
    keywords: ["topics", "sections", "skipped", "restore"],
  },
  {
    label: "Week View Roadmap",
    href: "/weeks",
    icon: CalendarRange,
    desc: "17-week roadmap with per-day status",
    keywords: ["weeks", "roadmap", "schedule", "plan"],
  },
  {
    label: "Live & Upcoming Contests",
    href: "/contests",
    icon: Trophy,
    desc: "Live CP contest schedules for LeetCode, Codeforces, CodeChef & AtCoder",
    keywords: ["contests", "competition", "codeforces", "leetcode contest", "cp"],
  },
  {
    label: "Progress & Streak Badges",
    href: "/progress",
    icon: Flame,
    desc: "Streaks, badges, weekly charts, and overall solving progress",
    keywords: ["progress", "streak", "badges", "stats", "analytics"],
  },
  {
    label: "Bookmarked Review Problems",
    href: "/review",
    icon: BookmarkCheck,
    desc: "Problems bookmarked for a second look",
    keywords: ["review", "bookmark", "saved"],
  },
  {
    label: "Backlog & Past Days",
    href: "/backlog",
    icon: CalendarDays,
    desc: "Past days you haven't fully completed",
    keywords: ["backlog", "catchup", "past days"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    desc: "Adjust pace, shift schedule, pause plan, or change password",
    keywords: ["settings", "pause", "password", "reset", "shift"],
  },
];

export function GlobalSearchModal({ open, onOpenChange, onOpenColorPanel }: GlobalSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  // Clear query on close
  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  // Filter Search Results
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        features: FEATURE_ITEMS.slice(0, 5),
        sections: SECTIONS.slice(0, 4).map((s) => ({ section: s.section, problemCount: s.problems.length })),
        problems: ALL_PROBLEMS.slice(0, 6),
      };
    }

    const matchedFeatures = FEATURE_ITEMS.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.desc.toLowerCase().includes(q) ||
        f.keywords.some((k) => k.includes(q))
    );

    const matchedSections = SECTIONS.filter((s) => s.section.toLowerCase().includes(q)).map((s) => ({
      section: s.section,
      problemCount: s.problems.length,
    }));

    const matchedProblems = ALL_PROBLEMS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.topic.toLowerCase().includes(q) ||
        p.platform.toLowerCase().includes(q) ||
        p.difficulty.toLowerCase().includes(q)
    ).slice(0, 20);

    return {
      features: matchedFeatures,
      sections: matchedSections.slice(0, 6),
      problems: matchedProblems,
    };
  }, [query]);

  const handleSelectFeature = (item: DeepNavItem) => {
    onOpenChange(false);
    if (item.action === "color-panel") {
      if (onOpenColorPanel) {
        onOpenColorPanel();
      }
    } else if (item.href) {
      router.push(item.href);
    }
  };

  const handleSelectProblem = (problemName: string) => {
    onOpenChange(false);
    router.push(`/problems?q=${encodeURIComponent(problemName)}`);
  };

  const handleSelectSection = (sectionName: string) => {
    onOpenChange(false);
    router.push(`/problems?topic=${encodeURIComponent(sectionName)}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden rounded-3xl border border-white/15 bg-card/95 backdrop-blur-2xl shadow-2xl">
        <DialogTitle className="sr-only">Search Website</DialogTitle>

        {/* Search Input Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-background/50">
          <Search className="size-5 text-primary shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anything (e.g. Banner, Colors, Profile, Binary Search, Two Sum)..."
            className="border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-8 font-medium text-foreground placeholder:text-muted-foreground"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg bg-white/5"
            >
              Clear
            </button>
          )}
        </div>

        {/* Results Container */}
        <div className="max-h-[65vh] overflow-y-auto p-4 space-y-4">
          {/* Features, Tabs & Controls */}
          {results.features.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2">
                Features & Tabs ({results.features.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {results.features.map((f) => (
                  <button
                    key={f.label}
                    onClick={() => handleSelectFeature(f)}
                    className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-background/40 hover:bg-white/10 p-2.5 text-left transition-all group"
                  >
                    <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <f.icon className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{f.label}</h4>
                      <p className="text-[10px] text-muted-foreground truncate">{f.desc}</p>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Topics & Sections Category */}
          {results.sections.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2">
                Topics & Sections ({results.sections.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {results.sections.map((s) => (
                  <button
                    key={s.section}
                    onClick={() => handleSelectSection(s.section)}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-background/40 hover:bg-white/10 p-2.5 text-left transition-all group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <LayoutGrid className="size-3.5 text-sky-400 shrink-0" />
                      <span className="text-xs font-bold text-foreground truncate group-hover:text-sky-400 transition-colors">
                        {s.section}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground shrink-0 bg-white/5 px-2 py-0.5 rounded-full">
                      {s.problemCount} problems
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Problems Category */}
          {results.problems.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2">
                Problems ({results.problems.length})
              </span>
              <div className="space-y-1.5">
                {results.problems.map((p, idx) => (
                  <div
                    key={`${p.name}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-background/40 hover:bg-white/10 p-2.5 text-left transition-all group"
                  >
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleSelectProblem(p.name)}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-muted-foreground">
                          {p.platform}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-muted-foreground">
                          {p.difficulty}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate font-medium">
                          · {p.topic}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">{p.name}</h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleSelectProblem(p.name)}
                        className="rounded-lg bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary px-2.5 py-1 text-[11px] font-bold transition-colors"
                      >
                        View & Highlight
                      </button>
                      <a
                        href={getChatGPTAiPromptUrl(p.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 text-[11px] font-bold transition-colors flex items-center gap-1"
                        title="Solve with Interactive ChatGPT DSA AI Tutor"
                      >
                        <Sparkles className="size-3 text-emerald-400" />
                        <span>Solve</span>
                      </a>
                      {p.link && (
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-white/10 hover:bg-white/20 text-foreground px-2 py-1 text-[11px] font-bold transition-colors"
                          title="Open official page"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {results.features.length === 0 && results.sections.length === 0 && results.problems.length === 0 && (
            <div className="p-8 text-center space-y-2">
              <Ban className="size-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-bold text-foreground">No matching results found</p>
              <p className="text-xs text-muted-foreground">Try searching for keywords like "Banner", "Colors", "Arrays", "Two Sum", or "Codeforces"</p>
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2 border-t border-white/10 bg-background/50 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Searches all features, topics & 838+ problems</span>
          <span className="font-mono">Press ESC to close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
