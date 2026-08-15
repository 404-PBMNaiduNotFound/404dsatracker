import { createFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router'

import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "@/integrations/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Loader2, X } from "lucide-react";
import {
  claimUsername,
  isUsernameAvailable,
  loadUserProfile,
  normalizeUsername,
  saveUserProfile,
  USERNAME_REGEX,
} from "@/lib/db";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — DSA⁴⁰⁴" },
      {
        name: "description",
        content: "Sign in to sync your DSA progress across every device.",
      },
      { property: "og:title", content: "Sign in — DSA⁴⁰⁴" },
      {
        property: "og:description",
        content: "Sign in to sync your DSA progress across every device.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ next: (s.next as string) || "/today" }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email address").max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);

/** Firebase's auth/* error codes -> friendly messages. */
function authErrorMessage(e: unknown): string {
  if (e instanceof FirebaseError) {
    switch (e.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Invalid email or password.";
      case "auth/email-already-in-use":
        return "An account with this email already exists.";
      case "auth/weak-password":
        return "Password must be at least 8 characters.";
      case "auth/popup-closed-by-user":
        return "Google sign-in was cancelled.";
      case "auth/too-many-requests":
        return "Too many attempts — please wait a moment and try again.";
      default:
        return e.message;
    }
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/auth" });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentReset, setSentReset] = useState(false);

  // ── Username + display-name step shown after any successful auth
  // for accounts that don't yet have a username.
  const [step, setStep] = useState<"credentials" | "username">("credentials");
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [usernameBusy, setUsernameBusy] = useState(false);

  // Debounced live availability check while user types.
  useEffect(() => {
    if (step !== "username") return;
    const raw = username.trim();
    if (!raw) { setUsernameStatus("idle"); return; }
    const u = normalizeUsername(raw);
    if (!USERNAME_REGEX.test(u)) { setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(u);
        setUsernameStatus(available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 450);
    return () => clearTimeout(t);
  }, [username, step]);

  /** After any successful auth, route to the username step if needed. */
  async function proceedAfterAuth(user: User) {
    try {
      const profile = await loadUserProfile(user.uid);
      if (!profile.username) {
        setPendingUser(user);
        setDisplayName(user.displayName ?? "");
        setUsername("");
        setUsernameStatus("idle");
        setStep("username");
        return;
      }
    } catch {
      // if profile load fails, just continue
    }
    void navigate({ to: next, replace: true });
  }

  async function handleClaimUsername() {
    if (!pendingUser) return;
    const u = normalizeUsername(username);
    if (!USERNAME_REGEX.test(u)) { setUsernameStatus("invalid"); return; }
    setUsernameBusy(true);
    try {
      await claimUsername(pendingUser.uid, u);
      const trimmedName = displayName.trim();
      if (trimmedName) {
        await saveUserProfile(pendingUser.uid, { displayName: trimmedName });
      }
      toast.success("You're all set!", { description: `Your profile is live at /profile/${u}` });
      void navigate({ to: next, replace: true });
    } catch (e) {
      if (e instanceof Error && e.message === "USERNAME_TAKEN") {
        setUsernameStatus("taken");
        toast.error("That username is already taken — try another.");
      } else if (e instanceof Error && e.message === "USERNAME_INVALID") {
        setUsernameStatus("invalid");
      } else {
        toast.error("Couldn't save your username. Try again.");
      }
    } finally {
      setUsernameBusy(false);
    }
  }

  const validate = () => {
    const e = emailSchema.safeParse(email);
    if (!e.success) { toast.error(e.error.issues[0].message); return null; }
    const p = passwordSchema.safeParse(password);
    if (!p.success) { toast.error(p.error.issues[0].message); return null; }
    return { email: e.data, password: p.data };
  };

  async function signIn() {
    const v = validate();
    if (!v) return;
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, v.email, v.password);
      await proceedAfterAuth(cred.user);
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function signUp() {
    const v = validate();
    if (!v) return;
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, v.email, v.password);
      await proceedAfterAuth(cred.user);
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    try {
      const provider = new GoogleAuthProvider();
      try {
        const cred = await signInWithPopup(auth, provider);
        await proceedAfterAuth(cred.user);
      } catch (e) {
        if (e instanceof FirebaseError && e.code === "auth/popup-blocked") {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw e;
      }
    } catch (e) {
      toast.error("Google sign-in failed", { description: authErrorMessage(e) });
    }
  }

  async function forgot() {
    const e = emailSchema.safeParse(email);
    if (!e.success) return toast.error("Enter your email first");
    try {
      await sendPasswordResetEmail(auth, e.data, {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      });
      setSentReset(true);
      toast.success("Reset link sent — check your inbox.");
    } catch (err) {
      toast.error(authErrorMessage(err));
    }
  }

  // ── Username / display-name step ──────────────────────────────────────────
  if (step === "username") {
    const statusIcon =
      usernameStatus === "checking" ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : usernameStatus === "available" ? (
        <Check className="size-4 text-emerald-500" />
      ) : usernameStatus === "taken" || usernameStatus === "invalid" ? (
        <X className="size-4 text-red-500" />
      ) : null;

    const statusMessage =
      usernameStatus === "taken"
        ? "That username is already taken — choose another."
        : usernameStatus === "invalid"
        ? "3–20 characters: lowercase letters, numbers, - or _ only."
        : usernameStatus === "available"
        ? "Available!"
        : null;

    const canSubmit = usernameStatus === "available" && !usernameBusy;

    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Card className="w-full border-border bg-card">
            <CardHeader>
              <CardTitle>Set up your profile</CardTitle>
              <CardDescription>
                Choose a username for your public profile link.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Display name */}
              <div className="space-y-1.5">
                <Label htmlFor="display-name">Full Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Turner"
                  disabled={usernameBusy}
                  maxLength={60}
                />
              </div>
              {/* Username */}
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. alex-turner"
                    disabled={usernameBusy}
                    className={
                      usernameStatus === "taken" || usernameStatus === "invalid"
                        ? "border-red-500 focus-visible:ring-red-500 pr-9"
                        : usernameStatus === "available"
                        ? "border-emerald-500 focus-visible:ring-emerald-500 pr-9"
                        : "pr-9"
                    }
                    onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) void handleClaimUsername(); }}
                  />
                  {statusIcon && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">{statusIcon}</span>
                  )}
                </div>
                {statusMessage && (
                  <p className={`text-xs ${usernameStatus === "available" ? "text-emerald-500" : "text-red-500"}`}>
                    {statusMessage}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Your profile will be at /profile/{username || "yourname"}
                </p>
              </div>
              <Button className="w-full" disabled={!canSubmit} onClick={() => void handleClaimUsername()}>
                {usernameBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // ── Credentials step ──────────────────────────────────────────────────────
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to home
        </Link>
      <Card className="w-full border-border bg-card">
        <CardHeader>
          <CardTitle className="text-2xl">DSA⁴⁰⁴</CardTitle>
          <CardDescription>
            338 problems · 42 topics · 120 days. Sign in to sync progress across devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Button variant="secondary" className="w-full" onClick={() => void google()}>
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or use email{" "}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Log in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <TabsContent value="signin" className="mt-4 space-y-3">
              <Button className="w-full" disabled={busy} onClick={() => void signIn()}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Log in
              </Button>
              <button
                type="button"
                onClick={() => void forgot()}
                className="w-full text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                {sentReset ? "Reset link sent" : "Forgot password?"}
              </button>
            </TabsContent>
            <TabsContent value="signup" className="mt-4">
              <Button className="w-full" disabled={busy} onClick={() => void signUp()}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Create account
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
