"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronRight, Code2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProblemCompletions } from "@/hooks/useProblemCompletions";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Language starter code — syntax scaffolding only, nothing executes. */
/* ------------------------------------------------------------------ */

interface LanguageConfig {
  id: string;
  label: string;
  starter: string;
}

const LANGUAGES: LanguageConfig[] = [
  {
    id: "javascript",
    label: "JavaScript (Node.js)",
    starter: `function solve(input) {
    // Write your code here
}
`,
  },
  {
    id: "typescript",
    label: "TypeScript",
    starter: `function solve(input: string): any {
    // Write your code here
}
`,
  },
  {
    id: "cpp",
    label: "C++17",
    starter: `#include <bits/stdc++.h>
using namespace std;

int main() {
    // Write your solution here
    return 0;
}`,
  },
  {
    id: "java",
    label: "Java 17",
    starter: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        // Write your solution here
    }
}`,
  },
  {
    id: "python",
    label: "Python 3",
    starter: `def solve():
    # Write your code here
    pass

solve()`,
  },
];

/* ------------------------------------------------------------------ */
/* Persisted submission shape — read by the "View Code" screen.       */
/* ------------------------------------------------------------------ */

export interface SavedSubmission {
  problemName: string;
  topic: string;
  language: string;
  code: string;
  submittedAt: string; // ISO timestamp
}

const STORAGE_KEY = "dsa-tracker:submissions";

function saveSubmission(submission: SavedSubmission) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: SavedSubmission[] = raw ? JSON.parse(raw) : [];
    // Keep only the latest submission per problem name.
    const filtered = all.filter((s) => s.problemName !== submission.problemName);
    filtered.push(submission);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // localStorage unavailable (SSR/private mode) — submission simply won't persist.
  }
}

/* ------------------------------------------------------------------ */

function CodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const lineCount = value.split("\n").length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const syncScroll = () => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = textareaRef.current!;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = value.slice(0, start) + "    " + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 4;
      });
    }
  };

  return (
    <div className="flex flex-1 min-h-0 bg-[#0D0D0D]">
      <div
        ref={gutterRef}
        className="select-none overflow-hidden text-right px-3 py-4 text-[13px] leading-[22px] font-mono text-[#4B5563] border-r border-[#1F1F1F] bg-[#0D0D0D]"
        style={{ minWidth: 48 }}
      >
        {lineNumbers.map((n) => (
          <div key={n}>{n}</div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        className="flex-1 resize-none bg-[#0D0D0D] text-[#E5E5E5] font-mono text-[13px] leading-[22px] px-4 py-4 outline-none"
        style={{ tabSize: 4 }}
      />
    </div>
  );
}

function EditorPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { submissions, submitCode } = useProblemCompletions();

  const problem = useMemo(
    () => ({
      name: params.get("name") || "Untitled Problem",
      topic: params.get("topic") || "",
      link: params.get("link") || "",
    }),
    [params]
  );

  const existingSubmission = submissions[problem.name];

  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(LANGUAGES[0].starter);
  const [langOpen, setLangOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-fill existing code submission if problem was already submitted
  useEffect(() => {
    if (existingSubmission?.code) {
      setCode(existingSubmission.code);
    }
  }, [existingSubmission, problem.name]);

  const currentLang = LANGUAGES.find((l) => l.id === language) || LANGUAGES[0];

  const handleLanguageChange = (id: string) => {
    setLanguage(id);
    const selected = LANGUAGES.find((l) => l.id === id);
    if (selected) setCode(selected.starter);
    setLangOpen(false);
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      toast.error("Please enter your solution code before submitting!");
      return;
    }
    setSubmitting(true);
    try {
      await submitCode(problem.name, code, problem.link || "");
      toast.success(`Solution for "${problem.name}" submitted!`);
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push("/today");
      }
    } catch (err: any) {
      toast.error("Failed to submit solution", { description: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground select-none">
      {/* Top bar: problem name + topic only */}
      <div className="h-[56px] shrink-0 flex items-center justify-between px-4 border-b border-border bg-background">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-[14px] font-bold tracking-tight shrink-0">
            404<span className="text-primary">DSA</span>
          </span>
          <div className="w-px h-4 bg-border shrink-0" />
          <div className="flex items-center gap-1.5 text-[13px] min-w-0">
            <span className="font-semibold text-foreground truncate">{problem.name}</span>
            {problem.topic && (
              <>
                <ChevronRight size={13} className="text-muted-foreground/60 shrink-0" />
                <span className="text-muted-foreground truncate">{problem.topic}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0 flex flex-col bg-background">
        <div className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-border bg-card">
          <div className="relative">
            <button
              onClick={() => setLangOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[12.5px] font-semibold text-foreground hover:bg-secondary transition-colors border border-border/60"
            >
              <Code2 size={13} className="text-primary" />
              {currentLang.label}
              <ChevronDown size={13} className="text-muted-foreground" />
            </button>
            {langOpen && (
              <div className="absolute left-0 top-full mt-1 w-44 rounded-md border border-border bg-card py-1 shadow-lg z-20">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => handleLanguageChange(l.id)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-secondary transition-colors",
                      l.id === language ? "text-foreground font-semibold bg-secondary/40" : "text-muted-foreground"
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <CodeEditor value={code} onChange={setCode} />

        <div className="h-14 shrink-0 flex items-center justify-end gap-2 px-3 border-t border-border bg-card">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-colors shadow-sm"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={null}>
      <EditorPageInner />
    </Suspense>
  );
}