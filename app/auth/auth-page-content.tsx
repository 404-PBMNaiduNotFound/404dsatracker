"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Loader2, Check, X } from "lucide-react";
import { claimUsername, isUsernameAvailable, loadUserProfile, normalizeUsername, saveUserProfile, USERNAME_REGEX } from "@/lib/db";

const emailSchema = z.string().trim().email("Enter a valid email address").max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);

/** Firebase's auth/* error codes -> the same friendly copy Supabase's messages used to give. */
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
        return "Password is too weak. Use at least 8 characters.";
      case "auth/too-many-requests":
        return "Too many attempts. Try again later.";
      default:
        return e.message || "An error occurred";
    }
  }
  return String(e || "An error occurred");
}

export function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/today";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // ── Username step — shown after a successful sign-in/sign-up/Google auth
  // for any account that doesn't have a username yet (brand-new signups,
  // and existing accounts from before this feature that haven't picked one).
  const [step, setStep] = useState<"credentials" | "username">("credentials");
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [usernameBusy, setUsernameBusy] = useState(false);

  // Debounced live availability check as the user types their handle.
  useEffect(() => {
    if (step !== "username") return;
    const raw = username.trim();
    if (!raw) {
      setUsernameStatus("idle");
      return;
    }
    const u = normalizeUsername(raw);
    if (!USERNAME_REGEX.test(u)) {
      setUsernameStatus("invalid");
      return;
    }
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

  /** After any successful auth, continue straight into the app. Username
   * (for accounts that don't have one yet) is now collected as part of the
   * onboarding flow — after preferences and start date — instead of here. */
  async function proceedAfterAuth(user: User, successMessage?: { title: string; description?: string }) {
    if (successMessage) toast.success(successMessage.title, { description: successMessage.description });
    router.push(next);
  }

  async function handleClaimUsername() {
    if (!pendingUser) return;
    const u = normalizeUsername(username);
    if (!USERNAME_REGEX.test(u)) {
      setUsernameStatus("invalid");
      return;
    }
    const trimmedName = displayName.trim();
    setUsernameBusy(true);
    try {
      await claimUsername(pendingUser.uid, u);
      if (trimmedName) {
        await saveUserProfile(pendingUser.uid, { displayName: trimmedName });
      }
      toast.success("You're all set!", { description: `Your public profile is live at /profile/${u}` });
      router.push(next);
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

  async function handleForgotPassword() {
    if (!auth) {
      toast.error("Firebase not initialized. Check your configuration.");
      return;
    }
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error("Enter your email address above first, then click Forgot password.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, parsed.data);
      setResetSent(true);
      toast.success("Reset email sent — check your inbox.");
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) router.push(next);
    });
    return () => unsub();
  }, [router, next]);

  async function handleSignIn() {
    if (!auth) {
      toast.error("Firebase not initialized. Check your configuration.");
      return;
    }

    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        toast.error(e.issues[0]?.message ?? "Invalid input.");
      }
      return;
    }

    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await proceedAfterAuth(cred.user, {
        title: "Welcome back! Thanks for logging in to our website.",
        description: "Ready to solve today's DSA problems?",
      });
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp() {
    if (!auth) {
      toast.error("Firebase not initialized. Check your configuration.");
      return;
    }

    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        toast.error(e.issues[0]?.message ?? "Invalid input.");
      }
      return;
    }

    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await proceedAfterAuth(cred.user);
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    if (!auth) {
      toast.error("Firebase not initialized. Check your configuration.");
      return;
    }

    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await proceedAfterAuth(cred.user, {
        title: "Welcome back! Thanks for logging in to our website.",
        description: "Ready to solve today's DSA problems?",
      });
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

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
          ? "3-20 characters: lowercase letters, numbers, - or _ only."
          : usernameStatus === "available"
            ? "Available!"
            : null;

    const canSubmit = usernameStatus === "available" && !usernameBusy;

    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Card className="w-full max-w-md border-border bg-card">
            <CardHeader>
              <CardTitle>Choose your username</CardTitle>
              <CardDescription>
                This becomes your public profile link — e.g. dsa404.app/profile/{username || "yourname"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="display-name">Full Name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Turner"
                  disabled={usernameBusy}
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground">Shown on your public profile (optional).</p>
              </div>
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canSubmit) handleClaimUsername();
                    }}
                  />
                  {statusIcon && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">{statusIcon}</span>
                  )}
                </div>
                {statusMessage && (
                  <p
                    className={`text-xs ${usernameStatus === "available" ? "text-emerald-500" : "text-red-500"
                      }`}
                  >
                    {statusMessage}
                  </p>
                )}
              </div>

              <Button className="w-full" disabled={!canSubmit} onClick={handleClaimUsername}>
                {usernameBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to home
        </Link>
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2.5 mb-1">
              <div className="size-8 rounded-full overflow-hidden border border-border/80 shadow-md ring-1 ring-primary/20 bg-background shrink-0">
                <img src="/logo.jpg" alt="DSA404 Logo" className="size-full object-cover" />
              </div>
              <div className="font-display font-black tracking-tighter text-2xl leading-none flex items-baseline select-none">
                <span className="bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent drop-shadow-sm">DSA</span>
                <span className="bg-gradient-to-br from-primary to-orange-500 bg-clip-text text-transparent drop-shadow-sm ml-[1px]">⁴⁰⁴</span>
              </div>
            </div>
            <CardDescription>
              {mode === "signin" ? "Sign in to your account" : "Create a new account"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="email" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="google">Google</TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={mode === "signin" ? handleSignIn : handleSignUp}
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === "signin" ? "Sign In" : "Create Account"}
                </Button>

                <div className="space-y-2">
                  <button
                    type="button"
                    className="w-full text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                  >
                    {mode === "signin"
                      ? "Don't have an account? Sign up"
                      : "Already have an account? Sign in"}
                  </button>

                  {mode === "signin" && (
                    resetSent ? (
                      <p className="text-center text-sm text-success">
                        ✓ Reset email sent — check your inbox.
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="w-full text-sm text-primary hover:underline disabled:opacity-50"
                        disabled={busy}
                        onClick={handleForgotPassword}
                      >
                        Forgot password?
                      </button>
                    )
                  )}
                </div>
              </TabsContent>

              <TabsContent value="google" className="pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={handleGoogleSignIn}
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in with Google
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}