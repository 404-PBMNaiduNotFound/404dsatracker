"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Code2, ExternalLink, Trash2, CheckCircle2, Save } from "lucide-react";
import type { CodeSubmission } from "@/lib/db";
import { toast } from "sonner";

interface CodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  problemName: string;
  existingSubmission?: CodeSubmission;
  onSave: (code: string, link: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  readOnly?: boolean;
}

export function CodeModal({
  open,
  onOpenChange,
  problemName,
  existingSubmission,
  onSave,
  onDelete,
  readOnly = false,
}: CodeModalProps) {
  const [code, setCode] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);

  // Sync state whenever modal opens or existingSubmission changes
  useEffect(() => {
    if (open) {
      const draft = typeof window !== "undefined" ? localStorage.getItem(`draft_code_${problemName}`) : null;
      setCode(existingSubmission?.code || draft || "");
      setLink(existingSubmission?.link || "");
    }
  }, [open, existingSubmission, problemName]);

  const handleCodeChange = (val: string) => {
    setCode(val);
    if (typeof window !== "undefined" && problemName && !readOnly) {
      localStorage.setItem(`draft_code_${problemName}`, val);
    }
  };

  const handleLinkChange = (val: string) => {
    setLink(val);
  };

  const handleSave = async () => {
    if (!code.trim()) {
      toast.error("Please enter your solution code before submitting!");
      return;
    }
    setBusy(true);
    try {
      await onSave(code, link);
      if (typeof window !== "undefined" && problemName) {
        localStorage.removeItem(`draft_code_${problemName}`);
      }
      toast.success("Solution code saved successfully!");
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to save solution code", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setBusy(true);
    try {
      await onDelete();
      if (typeof window !== "undefined" && problemName) {
        localStorage.removeItem(`draft_code_${problemName}`);
      }
      toast.success("Solution deleted");
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to delete solution", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-white/15 bg-card/95 backdrop-blur-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-foreground">
            <Code2 className="size-5 text-primary" />
            {readOnly ? `Code Solution — ${problemName}` : `Add Solution / Submission — ${problemName}`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {!readOnly && (
            <p className="text-xs text-muted-foreground">
              To mark this problem complete, paste your solution code below and optionally provide a submission URL.
            </p>
          )}

          {/* Submission link */}
          <div className="space-y-1.5">
            <Label htmlFor="submission-link" className="text-xs font-bold text-foreground">
              Submission Link (optional)
            </Label>
            {readOnly ? (
              existingSubmission?.link ? (
                <a
                  href={existingSubmission.link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary font-semibold underline"
                >
                  {existingSubmission.link} <ExternalLink className="size-3.5" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground italic">No submission link provided</p>
              )
            ) : (
              <Input
                id="submission-link"
                placeholder="https://leetcode.com/submissions/detail/123456/"
                value={link}
                onChange={(e) => handleLinkChange(e.target.value)}
                className="text-xs rounded-xl bg-background/50 border-white/10"
              />
            )}
          </div>

          {/* Code Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="solution-code" className="text-xs font-bold text-foreground">
                Solution Code
              </Label>
              {existingSubmission && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                  <CheckCircle2 className="size-3.5" /> Solution Saved
                </span>
              )}
            </div>

            {!readOnly && (
              <p className="text-[11px] text-amber-400/90 italic font-medium leading-tight bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                Note: Save your solution code to review it anytime in the future.
              </p>
            )}

            <Textarea
              id="solution-code"
              placeholder="// Paste your C++, Java, Python, or JavaScript solution code here..."
              value={code}
              readOnly={readOnly}
              onChange={(e) => handleCodeChange(e.target.value)}
              className="font-mono text-xs h-64 resize-none bg-background/60 border-white/10 rounded-2xl p-3 focus-visible:ring-primary"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between pt-2 border-t border-white/10">
          {!readOnly && existingSubmission && onDelete && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={busy}
              className="text-destructive hover:bg-destructive/10 rounded-xl text-xs h-8"
            >
              <Trash2 className="size-3.5 mr-1" /> Delete Solution
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl text-xs h-8">
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly && (
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={busy || !code.trim()}
                className="rounded-xl text-xs h-8 font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
              >
                <Save className="size-3.5 mr-1" />
                {busy ? "Saving..." : existingSubmission ? "Update Code" : "Submit Code & Complete"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
