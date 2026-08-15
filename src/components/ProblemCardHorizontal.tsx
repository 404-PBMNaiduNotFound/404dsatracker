"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ExternalLink,
  BookmarkPlus,
  BookmarkCheck,
  Sparkles,
  Search,
  Code2,
  CheckCircle2,
  Video,
  Link2,
  SkipForward,
} from "lucide-react";
import type { Problem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CodeModal } from "@/components/CodeModal";
import { useProblemCompletions } from "@/hooks/useProblemCompletions";

const diffClass: Record<string, string> = {
  Easy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Hard: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

const platformColors: Record<string, string> = {
  LeetCode: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Codeforces: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  GeeksforGeeks: "bg-emerald-600/15 text-emerald-400 border-emerald-600/30",
  HackerRank: "bg-green-500/15 text-green-400 border-green-500/30",
  AtCoder: "bg-blue-400/15 text-blue-300 border-blue-400/30",
  CodeChef: "bg-amber-700/15 text-amber-300 border-amber-700/30",
};

function googleSearchUrl(problemName: string) {
  const query = `${problemName} DSA solution explanation site:leetcode.com OR site:geeksforgeeks.org OR site:takeuforward.org`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function youtubeSearchUrl(problemName: string) {
  const query = `${problemName} solution intuition explained NeetCode OR Striver`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

import { getChatGPTAiPromptUrl } from "@/lib/aiTutorPrompt";

function chatGptProblemUrl(problemName: string) {
  return getChatGPTAiPromptUrl(problemName);
}

function ThemedTooltip({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs rounded-xl border border-white/15 bg-popover/95 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-2xl">
          {hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ProblemCardHorizontalProps {
  problem: Problem;
  onToggle: () => void;
  onToggleReview?: () => void;
  onSkip?: () => void;
  readOnly?: boolean;
}

export function ProblemCardHorizontal({
  problem,
  onToggle,
  onToggleReview,
  onSkip,
  readOnly = false,
}: ProblemCardHorizontalProps) {
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const { submissions, submitCode, removeCode } = useProblemCompletions();
  const submission = submissions[problem.name];
  const hasSubmission = !!submission;

  return (
    <>
      <div
        className={cn(
          "group relative flex flex-col justify-between rounded-2xl border bg-card/80 backdrop-blur-md p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl w-full select-none min-h-[170px]",
          problem.done
            ? "border-emerald-500/40 bg-emerald-500/5 shadow-md shadow-emerald-500/5"
            : "border-white/10 hover:border-primary/40"
        )}
      >

        {/* Card Header: Badges & Actions */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                platformColors[problem.platform] ?? "bg-white/10 text-muted-foreground border-white/10"
              )}
            >
              {problem.platform}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
                diffClass[problem.difficulty] ?? "bg-white/10 text-muted-foreground border-white/10"
              )}
            >
              {problem.difficulty}
            </span>
            {hasSubmission && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                <CheckCircle2 className="size-3 text-emerald-400" /> Submitted
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onSkip && !readOnly && (
              <ThemedTooltip hint="Skip problem — moves this problem to tomorrow's plan">
                <button
                  onClick={onSkip}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-white/10 hover:text-amber-400 transition-colors"
                >
                  <SkipForward className="size-4" />
                </button>
              </ThemedTooltip>
            )}

            {onToggleReview && (
              <ThemedTooltip hint={problem.forReview ? "Remove from Review tab" : "Bookmark problem for Review tab"}>
                <button
                  onClick={onToggleReview}
                  className={cn(
                    "rounded-full p-1.5 transition-colors",
                    problem.forReview
                      ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                      : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  )}
                >
                  {problem.forReview ? (
                    <BookmarkCheck className="size-4 fill-amber-400/20" />
                  ) : (
                    <BookmarkPlus className="size-4" />
                  )}
                </button>
              </ThemedTooltip>
            )}
          </div>
        </div>

        {/* Card Body: Problem Title & Checkbox */}
        <div className="mb-4">
          <div className="flex items-start gap-2">
            <ThemedTooltip hint={problem.done ? "Click to uncheck completed status" : "Submit code solution to mark completed"}>
              <div className="mt-0.5">
                <Checkbox
                  checked={problem.done}
                  onCheckedChange={() => {
                    if (readOnly) return;
                    if (!problem.done) {
                      setCodeModalOpen(true);
                    } else {
                      onToggle();
                    }
                  }}
                  disabled={readOnly}
                  className="size-5 rounded-md border-border text-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
              </div>
            </ThemedTooltip>

            <div className="flex-1 min-w-0">
              <h4
                className={cn(
                  "text-sm font-semibold leading-snug tracking-tight transition-colors line-clamp-2",
                  problem.done ? "line-through text-emerald-400 font-bold" : "text-foreground font-semibold"
                )}
              >
                {problem.name}
              </h4>
            </div>
          </div>
        </div>

        {/* Card Footer: Links Dropdown & Action Buttons */}
        <div className="flex items-center justify-between gap-1 pt-3 border-t border-white/10 text-xs">
          <div className="flex items-center gap-1">
            {/* Links Dropdown Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="inline-flex items-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 font-medium transition-colors text-xs"
                  title="View all problem links & resources"
                >
                  <Link2 className="size-3.5" />
                  <span>Links 🔗</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 rounded-xl border border-white/10 bg-card/95 backdrop-blur-xl">
                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Resource Links</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {problem.link && (
                  <DropdownMenuItem asChild>
                    <a href={problem.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-semibold text-primary">
                      <ExternalLink className="size-3.5 text-primary" />
                      <span>{problem.platform} Official Page</span>
                    </a>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem asChild>
                  <a href={youtubeSearchUrl(problem.name)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-foreground">
                    <Video className="size-3.5 text-rose-500" />
                    <span>YouTube Solution Video</span>
                  </a>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <a href={googleSearchUrl(problem.name)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-foreground">
                    <Search className="size-3.5 text-sky-400" />
                    <span>Google Search Solution</span>
                  </a>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <a href={chatGptProblemUrl(problem.name)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-foreground">
                    <Sparkles className="size-3.5 text-emerald-400" />
                    <span>ChatGPT AI Explanation</span>
                  </a>
                </DropdownMenuItem>

                {hasSubmission && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setCodeModalOpen(true)} className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                      <Code2 className="size-3.5 text-emerald-400" />
                      <span>View Submitted Solution</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Direct AI Explanation quick button */}
            <ThemedTooltip hint="Ask AI for solution walkthrough and intuition">
              <a
                href={chatGptProblemUrl(problem.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
              >
                <Sparkles className="size-3.5 text-emerald-400" />
              </a>
            </ThemedTooltip>
          </div>

          <div className="flex items-center gap-1">
            <ThemedTooltip hint={hasSubmission ? "View or edit stored code solution" : "Submit code solution to mark completed"}>
              <button
                onClick={() => setCodeModalOpen(true)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium transition-colors text-xs",
                  hasSubmission
                    ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30"
                    : "bg-white/5 hover:bg-white/10 text-muted-foreground"
                )}
              >
                <Code2 className="size-3.5" />
                <span>{hasSubmission ? "Code" : "Add Code"}</span>
              </button>
            </ThemedTooltip>

            <ThemedTooltip hint="Solve with Interactive ChatGPT DSA AI Tutor">
              <a
                href={getChatGPTAiPromptUrl(problem.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 font-semibold transition-colors"
              >
                <span>Solve</span>
                <Sparkles className="size-3 text-emerald-400" />
              </a>
            </ThemedTooltip>
          </div>
        </div>
      </div>

      {/* Code Modal with submission mark logic */}
      <CodeModal
        open={codeModalOpen}
        onOpenChange={setCodeModalOpen}
        problemName={problem.name}
        existingSubmission={submission}
        onSave={async (code, link) => {
          await submitCode(problem.name, code, link);
          // Mark completed automatically upon submitting code
          if (!problem.done && !readOnly) {
            onToggle();
          }
        }}
        onDelete={async () => {
          await removeCode(problem.name);
          if (problem.done && !readOnly) {
            onToggle();
          }
        }}
        readOnly={readOnly}
      />
    </>
  );
}
