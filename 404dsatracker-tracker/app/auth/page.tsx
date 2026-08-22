import { Suspense } from "react";
import { AuthPageContent } from "./auth-page-content";

export const metadata = {
  title: "Sign in — DSA⁴⁰⁴",
  description: "Sign in to sync your DSA progress across every device.",
};

function AuthPageSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4">
        <div className="h-8 w-full animate-pulse rounded bg-muted" />
        <div className="h-32 w-full animate-pulse rounded bg-muted" />
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageSkeleton />}>
      <AuthPageContent />
    </Suspense>
  );
}
