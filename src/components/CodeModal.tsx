"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Code2, ExternalLink, Trash2 } from "lucide-react";
import type { CodeSubmission } from "@/lib/db";

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
  const [code, setCode] = useState(existingSubmission?.code ?? "");
  const [link, setLink] = useState(existingSubmission?.link ?? "");
  const [busy, setBusy] = useState(false);

  // Sync state when opening with new props
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setCode(existingSubmission?.code ?? "");
      setLink(existingSubmission?.link ?? "");
    }
    onOpenChange(v);
  };

  const handleSave = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      await onSave(code, link);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setBusy(true);
    try {
      await onDelete();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
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
          <div className="space-y-1">
            <Label htmlFor="submission-link" className="text-xs">
              Submission Link (optional)
            </Label>
            {readOnly ? (
              existingSubmission?.link ? (
                <a
                  href={existingSubmission.link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-primary underline"
                >
                  {existingSubmission.link} <ExternalLink className="size-3" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground italic">No link provided</p>
              )
            ) : (
              <Input
                id="submission-link"
                placeholder="https://leetcode.com/submissions/detail/123456/"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="text-xs"
              />
            )}
          </div>

          {/* Code Textarea */}
          <div className="space-y-1">
            <Label htmlFor="solution-code" className="text-xs">
              Solution Code
            </Label>
            {!readOnly && (
              <p className="text-[11px] text-destructive/80 italic font-medium leading-tight">
                Note: This is not for debugging, it is for reviewing your code after some days. Be aware of it, while if you not submit your own code it is your loss like this.
              </p>
            )}
            <Textarea
              id="solution-code"
              placeholder="// Paste your C++, Java, Python, or JavaScript solution here..."
              value={code}
              readOnly={readOnly}
              onChange={(e) => setCode(e.target.value)}
              className="font-mono text-xs h-64 resize-none bg-muted/30"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          {!readOnly && existingSubmission && onDelete && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={busy}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5 mr-1" /> Delete Solution
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly && (
              <Button type="button" size="sm" onClick={handleSave} disabled={busy || !code.trim()}>
                {busy ? "Saving..." : existingSubmission ? "Update Code" : "Submit Code & Complete"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
