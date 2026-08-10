import { createFileRoute } from '@tanstack/react-router'

import { waitForAuthUser } from "@/integrations/firebase/client";
import { PlanProvider } from "@/hooks/usePlan";
import { SettingsProvider, useSettings } from "@/hooks/useSettings";
import { ReminderRunner } from "@/components/ReminderRunner";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await waitForAuthUser();
    if (!user) throw redirect({ to: "/auth", search: { next: "/today" } });
    return { user };
  },
  component: Layout,
});

function Layout() {
  const { user } = Route.useRouteContext();
  return (
    <SettingsProvider userId={user.uid}>
      <PlanBoundary email={user.email ?? ""} />
    </SettingsProvider>
  );
}

/** Settings must be loaded first: the pause flag suspends missed-week detection. */
function PlanBoundary({ email }: { email: string }) {
  const { settings, userId } = useSettings();
  return (
    <PlanProvider userId={userId} paused={settings.paused}>
      <AppShell email={email}>
        <ReminderRunner />
        <Outlet />
      </AppShell>
    </PlanProvider>
  );
}
