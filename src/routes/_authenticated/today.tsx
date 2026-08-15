import { createFileRoute } from '@tanstack/react-router'
import { MergedTodayProfile } from "@/components/MergedTodayProfile";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today & Profile — DSA⁴⁰⁴" },
      {
        name: "description",
        content:
          "Your daily DSA checklist, developer profile, platform handles, motivational greetings, and solved days calendar.",
      },
      { property: "og:title", content: "Today & Profile — DSA⁴⁰⁴" },
      {
        property: "og:description",
        content: "Track today's Core 404 problems, developer profile, and solved activity calendar.",
      },
    ],
  }),
  component: MergedTodayProfile,
});