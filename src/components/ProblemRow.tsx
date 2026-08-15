"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  BookOpen,
  Trash2,
  BadgeCheck,
  Search,
  BookmarkPlus,
  BookmarkCheck,
  Sparkles,
} from "lucide-react";

function googleSearchUrl(problemName: string, topic?: string) {
  const query = `${topic ? topic + " " : ""}${problemName} DS site:takeuforward.org OR site:geeksforgeeks.org OR site:leetcode.com OR site:naukri.com OR site:interviewbit.com OR site:techiedelight.com OR site:programiz.com OR site:w3schools.com solution explanation`;
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HoverHint } from "@/components/HoverHint";
import { Badge } from "@/components/ui/badge";
import type { Problem } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CodeModal } from "@/components/CodeModal";
import { useProblemCompletions } from "@/hooks/useProblemCompletions";
import { Code2 } from "lucide-react";

const diffClass: Record<string, string> = {
  Easy: "text-easy",
  Medium: "text-medium",
  Hard: "text-hard",
  Advanced: "text-purple-600 dark:text-purple-400",
  Expert: "text-red-600 dark:text-red-400",
  "Multiple Choice": "text-blue-600 dark:text-blue-400",
};

export function ProblemRow({
  problem,
  onToggle,
  onDelete,
  onReview,
  readOnly,
  lateMode,
  index = 0,
}: {
  problem: Problem;
  onToggle?: (done: boolean) => void;
  onDelete?: () => void;
  /** Shown only when provided (Today tab + Review tab) — flags/unflags this problem for review. */
  onReview?: () => void;
  readOnly?: boolean;
  /** When true, problem was missed — show "completed late" badge on done items */
  lateMode?: boolean;
  /** used only to stagger the entrance animation */
  index?: number;
}) {
  const id = `p-${problem.name.replace(/\W+/g, "-")}`;
  const [justDone, setJustDone] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const { submissions, submitCode, removeCode } = useProblemCompletions();
  const submission = submissions[problem.name];

  const handleSaveCode = async (code: string, link: string) => {
    await submitCode(problem.name, code, link);
    setJustDone(true);
    window.setTimeout(() => setJustDone(false), 400);
    onToggle?.(true);
  };

  const handleDeleteCode = async () => {
    await removeCode(problem.name);
    onToggle?.(false);
  };

  return (
    <>
      <li
        style={{ "--i": index } as React.CSSProperties}
        className={cn(
          "stagger-item flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface/60 px-3 py-2.5 transition-colors duration-200",
          problem.done && "border-success/30 bg-success/5",
        )}
      >
        <HoverHint hint={readOnly ? "View only — only today's problems can be marked done" : "Submit code solution to mark done"}>
          <Checkbox
            id={id}
            checked={problem.done}
            disabled={readOnly}
            onCheckedChange={() => {
              if (readOnly) return;
              setModalOpen(true);
            }}
            aria-label={`Mark ${problem.name} as done`}
            className={cn("size-5 transition-transform", justDone && "animate-pop-check")}
          />
        </HoverHint>
        <label
          htmlFor={id}
          className={cn(
            "min-w-[8rem] flex-1 basis-40 cursor-pointer break-words text-sm",
            problem.done && "text-muted-foreground line-through",
          )}
          onClick={() => {
            if (!readOnly) setModalOpen(true);
          }}
        >
          {problem.name}
        </label>
        <span className={cn("text-xs font-semibold", diffClass[problem.difficulty] ?? "text-muted-foreground")}>
          {problem.difficulty}
        </span>
        {lateMode && problem.done && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 bg-success/15 text-success border-success/20">
            completed late
          </Badge>
        )}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {problem.platform}
          {problem.linkVerified && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span aria-label="Verified direct link to the problem">
                  <BadgeCheck className="size-3.5 text-success" aria-hidden="true" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Verified direct problem link</TooltipContent>
            </Tooltip>
          )}
        </span>
        <span className="text-xs text-muted-foreground">~{problem.estTime}m</span>
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {/* Code button with hover tooltip – only show if solve link present */}
          {problem.link && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              title={problem.done ? "View or edit your submitted code for this problem" : "Add code solution to mark problem as completed"}
              className={cn(
                "flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors",
                problem.done
                  ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                  : "border-border text-muted-foreground hover:border-primary hover:text-primary",
              )}
            >
              <Code2 className="size-3.5" />
              <span className="text-xs">Code</span>
            </button>
          )}
          {problem.platform === "LeetCode" && !problem.linkVerified ? null : (() => {
            // Derive the actual platform label from the verified link URL
            const url = problem.link;
            const linkPlatform =
              url.includes("geeksforgeeks.org") ? "GFG" :
                url.includes("hackerrank.com") ? "HackerRank" :
                  url.includes("w3schools.com") ? "W3Schools" :
                    url.includes("leetcode.com") ? "LeetCode" :
                      problem.platform;
            const hint =
              linkPlatform === "LeetCode"
                ? "Opens this problem directly on LeetCode"
                : `Opens this problem on ${linkPlatform}`;
            return (
              <HoverHint hint={hint}>
                <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                  <a href={url} target="_blank" rel="noreferrer" aria-label={`Solve ${problem.name} on ${linkPlatform}`}>
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    <span className="ml-1 text-xs">{linkPlatform}</span>
                  </a>
                </Button>
              </HoverHint>
            );
          })()}
          {problem.takeUForwardLink && (
            <HoverHint hint="Opens the takeUforward article explaining this problem">
              <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                <a
                  href={problem.takeUForwardLink}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Read the takeUforward article for ${problem.name}`}
                >
                  <BookOpen className="size-3.5" aria-hidden="true" />
                  <span className="ml-1 text-xs">TUF</span>
                </a>
              </Button>
            </HoverHint>
          )}
          <HoverHint hint="Search Google: problem name + DSA LeetCode GeeksforGeeks TUF YouTube tutorials">
            <Button asChild variant="ghost" size="sm" className="h-8 px-2">
              <a
                href={googleSearchUrl(problem.name)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Search Google for ${problem.name} DSA tutorials`}
              >
                <Search className="size-3.5" aria-hidden="true" />
                <span className="ml-1 text-xs">Google</span>
              </a>
            </Button>
          </HoverHint>
          <HoverHint hint="Search YouTube for brute force, better, and optimal solutions with explanations">
            <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-red-500 hover:text-red-600">
              <a
                href={youtubeSearchUrl(problem.name)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Search YouTube for ${problem.name} solution`}
              >
                <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                <span className="ml-1 text-xs">YouTube</span>
              </a>
            </Button>
          </HoverHint>
          <HoverHint hint="Ask ChatGPT to explain brute force, better, optimal approach, TC, SC, and intuition for this problem">
            <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-green-600 hover:text-green-700">
              <a
                href={chatGptProblemUrl(problem.name)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Explain ${problem.name} on ChatGPT`}
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                <span className="ml-1 text-xs">ChatGPT</span>
              </a>
            </Button>
          </HoverHint>
          {onReview && (
            <HoverHint
              hint={
                problem.forReview
                  ? "Remove this problem from your Review tab"
                  : "Flag this problem to revisit later in the Review tab"
              }
            >
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-8",
                  problem.forReview
                    ? "text-primary hover:text-primary"
                    : "text-muted-foreground hover:text-primary",
                )}
                aria-label={
                  problem.forReview
                    ? `Remove ${problem.name} from review`
                    : `Add ${problem.name} to review`
                }
                onClick={onReview}
              >
                {problem.forReview ? (
                  <BookmarkCheck className="size-4" />
                ) : (
                  <BookmarkPlus className="size-4" />
                )}
              </Button>
            </HoverHint>
          )}
          {onDelete && !problem.done && (
            <HoverHint hint="Moves this problem to tomorrow's plan instead of today">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                aria-label={`Move ${problem.name} to tomorrow`}
                onClick={onDelete}
              >
                <Trash2 className="size-4" />
              </Button>
            </HoverHint>
          )}
        </div>
      </li>

      <CodeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        problemName={problem.name}
        existingSubmission={submission}
        onSave={handleSaveCode}
        onDelete={handleDeleteCode}
        readOnly={readOnly}
      />
    </>
  );
}
