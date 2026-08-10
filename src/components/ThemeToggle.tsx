/** NEW FILE — Upgrade 2: dark/light toggle backed by the per-user settings row. */
import { Moon, Sun, MonitorSmartphone } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ThemeMode } from "@/lib/settings";

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: MonitorSmartphone },
];

export function ThemeToggle() {
  const { settings, update } = useSettings();
  const active = OPTIONS.find((o) => o.value === settings.theme) ?? OPTIONS[1];
  const Icon = active.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Theme: ${active.label}`}>
          <Icon className="size-5 transition-transform duration-300 ease-out" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onSelect={() => void update({ theme: o.value })}
            className={o.value === settings.theme ? "font-semibold" : undefined}
          >
            <o.icon className="mr-2 size-4" /> {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
