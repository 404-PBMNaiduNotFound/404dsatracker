import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import {
  loadProblemCompletions,
  loadCodeSubmissions,
  saveCodeSubmission,
  removeCodeSubmission,
  type CodeSubmission,
} from "@/lib/db";

/**
 * Manages which problems in the Problems tab the user has marked complete.
 * Completions and code submissions are stored in Firestore at users/{uid}/settings/problemCompletions
 */
export function useProblemCompletions() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<Record<string, CodeSubmission>>({});
  const [loading, setLoading] = useState(true);

  // Load on mount / user change
  useEffect(() => {
    if (!uid) {
      setCompleted(new Set());
      setSubmissions({});
      setLoading(false);
      return;
    }
    let isMounted = true;
    setLoading(true);
    Promise.all([loadProblemCompletions(uid), loadCodeSubmissions(uid)])
      .then(([set, subMap]) => {
        if (!isMounted) return;
        setCompleted(set);
        setSubmissions(subMap);
      })
      .catch((e) => {
        console.warn("Failed to load problem completions from Firestore:", e);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [uid]);

  /** Submit code for a problem, marking it completed. */
  const submitCode = useCallback(
    async (name: string, code: string, link: string = "") => {
      if (!uid) return;
      const sub: CodeSubmission = {
        code,
        link,
        submittedAt: new Date().toISOString(),
      };
      setSubmissions((prev) => ({ ...prev, [name]: sub }));
      setCompleted((prev) => {
        const next = new Set(prev);
        next.add(name);
        return next;
      });
      await saveCodeSubmission(uid, name, sub, completed);
    },
    [uid, completed],
  );

  /** Remove code submission for a problem, unmarking it as completed. */
  const removeCode = useCallback(
    async (name: string) => {
      if (!uid) return;
      setSubmissions((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      setCompleted((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
      await removeCodeSubmission(uid, name, completed);
    },
    [uid, completed],
  );

  return { completed, submissions, loading, submitCode, removeCode };
}

