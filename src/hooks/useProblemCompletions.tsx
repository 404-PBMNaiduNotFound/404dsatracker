import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import {
  loadProblemCompletions,
  loadCodeSubmissions,
  saveCodeSubmission,
  removeCodeSubmission,
  type CodeSubmission,
} from "@/lib/db";

function getLocalSubmissionsKey(uid: string) {
  return `dsa_code_submissions_${uid}`;
}

function getLocalCompletionsKey(uid: string) {
  return `dsa_completed_problems_${uid}`;
}

function getLocalSubmissions(uid: string): Record<string, CodeSubmission> {
  if (typeof window === "undefined" || !uid) return {};
  try {
    const raw = localStorage.getItem(getLocalSubmissionsKey(uid));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getLocalCompletions(uid: string): Set<string> {
  if (typeof window === "undefined" || !uid) return new Set();
  try {
    const raw = localStorage.getItem(getLocalCompletionsKey(uid));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function useProblemCompletions() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";

  const [completed, setCompleted] = useState<Set<string>>(() => (uid ? getLocalCompletions(uid) : new Set()));
  const [submissions, setSubmissions] = useState<Record<string, CodeSubmission>>(() => (uid ? getLocalSubmissions(uid) : {}));
  const [loading, setLoading] = useState(true);

  // Load on mount / user change — strictly scoped to active user ID
  useEffect(() => {
    let isMounted = true;

    if (!user || !user.uid) {
      setSubmissions({});
      setCompleted(new Set());
      setLoading(false);
      return;
    }

    const currentUid = user.uid;
    setLoading(true);

    const localSubs = getLocalSubmissions(currentUid);
    const localComp = getLocalCompletions(currentUid);

    // Set user-scoped local state immediately
    setSubmissions(localSubs);
    setCompleted(localComp);

    Promise.all([loadProblemCompletions(currentUid), loadCodeSubmissions(currentUid)])
      .then(([set, subMap]) => {
        if (!isMounted) return;
        const mergedSubs = { ...localSubs, ...subMap };
        const mergedComp = new Set([...Array.from(localComp), ...Array.from(set)]);
        setCompleted(mergedComp);
        setSubmissions(mergedSubs);
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
  }, [user]);

  /** Submit code for a problem, marking it completed and persisting locally and in DB. */
  const submitCode = useCallback(
    async (name: string, code: string, link: string = "") => {
      if (!user?.uid) return;
      const currentUid = user.uid;

      const sub: CodeSubmission = {
        code,
        link,
        submittedAt: new Date().toISOString(),
      };

      setSubmissions((prev) => {
        const next = { ...prev, [name]: sub };
        if (typeof window !== "undefined") {
          localStorage.setItem(getLocalSubmissionsKey(currentUid), JSON.stringify(next));
        }
        return next;
      });

      setCompleted((prev) => {
        const next = new Set(prev);
        next.add(name);
        if (typeof window !== "undefined") {
          localStorage.setItem(getLocalCompletionsKey(currentUid), JSON.stringify(Array.from(next)));
        }
        return next;
      });

      // Saved to localStorage above already, so nothing is lost locally if this
      // fails — but the user should know their submission hasn't synced to
      // their account yet (e.g. won't show on another device or the public
      // profile) rather than silently believing it's fully saved.
      await saveCodeSubmission(currentUid, name, sub, completed).catch(() => {
        toast.error("Saved on this device, but couldn't sync to your account. Check your connection.");
      });
    },
    [user, completed],
  );

  /** Remove code submission for a problem, unmarking it as completed. */
  const removeCode = useCallback(
    async (name: string) => {
      if (!user?.uid) return;
      const currentUid = user.uid;

      setSubmissions((prev) => {
        const next = { ...prev };
        delete next[name];
        if (typeof window !== "undefined") {
          localStorage.setItem(getLocalSubmissionsKey(currentUid), JSON.stringify(next));
        }
        return next;
      });

      setCompleted((prev) => {
        const next = new Set(prev);
        next.delete(name);
        if (typeof window !== "undefined") {
          localStorage.setItem(getLocalCompletionsKey(currentUid), JSON.stringify(Array.from(next)));
        }
        return next;
      });

      await removeCodeSubmission(currentUid, name, completed).catch(() => {
        toast.error("Removed on this device, but couldn't sync the change to your account.");
      });
    },
    [user, completed],
  );

  return { completed, submissions, loading, submitCode, removeCode };
}
