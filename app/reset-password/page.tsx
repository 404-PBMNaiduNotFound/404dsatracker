import { lazy, Suspense } from "react";
import { QuoteLoader } from "@/components/QuoteLoader";

export const metadata = {
  title: "Reset password — DSA⁴⁰⁴",
  description: "Reset your password to regain access to your DSA⁴⁰⁴.",
};

const ResetPasswordContent = lazy(() => import("@/components/ResetPasswordContent"));

export default function Page() {
  return (
    <Suspense fallback={<QuoteLoader fullScreen />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
