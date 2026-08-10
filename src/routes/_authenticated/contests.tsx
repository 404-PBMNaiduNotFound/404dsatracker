import { createFileRoute } from '@tanstack/react-router'

import { ContestsPageSection } from "@/components/ContestsSection";

export const Route = createFileRoute("/_authenticated/contests")({
  head: () => ({
    meta: [
      { title: "Contests — DSA⁴⁰⁴" },
      {
        name: "description",
        content: "Live, upcoming, and missed CP contests from LeetCode, Codeforces, CodeChef, HackerRank, and AtCoder.",
      },
    ],
  }),
  component: ContestsPage,
});

function ContestsPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Contests</h1>
      <ContestsPageSection />
    </>
  );
}
