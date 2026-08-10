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
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "@/integrations/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

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
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Welcome back! Thanks for logging in to our website.", {
        description: "Ready to solve today's DSA problems?",
      });
      router.push(next);
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
      await createUserWithEmailAndPassword(auth, email, password);
      toast.success("Account created successfully");
      router.push(next);
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
      await signInWithPopup(auth, provider);
      toast.success("Welcome back! Thanks for logging in to our website.", {
        description: "Ready to solve today's DSA problems?",
      });
      router.push(next);
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to home
        </Link>
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader>
          <CardTitle>DSA⁴⁰⁴</CardTitle>
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
