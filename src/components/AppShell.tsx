"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { usePlan } from "@/hooks/usePlan";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { currentStreak } from "@/lib/gamification";
import { formatDate } from "@/lib/plan";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  CalendarDays,
  CircleUser,
  Cloud,
  Flame,
  Home,
  ListTodo,
  Menu,
  Palette,
  PauseCircle,
  Settings,
  LayoutGrid,
  CalendarRange,
  UserCircle2,
  BookmarkCheck,
  Code2,
  Trophy,
  ChevronRight,
  X,
  LogOut,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeCustomizer } from "../../app/theme-customizer-context";
import { ThemeCustomizerPanel } from "../../app/theme-customizer-panel";

const NAV = [
  { to: "/today", label: "Today", icon: ListTodo, hint: "Your daily checklist — topic, problems, notes, and today's contests at a glance." },
  { to: "/review", label: "Review", icon: BookmarkCheck, hint: "Problems you bookmarked for a second look — sorted by day and section." },
  { to: "/backlog", label: "Backlog", icon: CalendarDays, hint: "Past days you haven't fully completed. Insert a revision day to catch up." },
  { to: "/problems", label: "Problems", icon: Code2, hint: "838+ problems from 2 curated sets — filter by platform, difficulty, or sheet." },
  { to: "/topics", label: "Topic View", icon: LayoutGrid, hint: "All 42 Core 404 topics. Expand any topic, skip topics, track progress." },
  { to: "/weeks", label: "Week View", icon: CalendarRange, hint: "Your 17-week roadmap. See every day's status and jump to any day directly." },
  { to: "/contests", label: "Contests", icon: Trophy, hint: "Live, upcoming & missed CP contests from LeetCode, Codeforces, CodeChef, AtCoder, HackerRank." },
  { to: "/progress", label: "Progress", icon: Flame, hint: "Streaks, badges, weekly charts, and overall solving progress." },
  { to: "/profile", label: "Profile", icon: UserCircle2, hint: "Your public profile — coding platform links, solved stats, and completed problems." },
  { to: "/settings", label: "Settings", icon: Settings, hint: "Adjust daily pace, shift schedule, pause plan, change password or theme." },
] as const;

const MOBILE_BOTTOM_KEYS = ["/today", "/profile", "/settings"] as const;
const MOBILE_BAR = NAV.filter((n) => (MOBILE_BOTTOM_KEYS as readonly string[]).includes(n.to));

const SIDEBAR_MIN = 176;
const SIDEBAR_MAX = 320;
const SIDEBAR_DEFAULT = 224;
const SIDEBAR_STORAGE_KEY = "dsa-sidebar-width";

// ─── Desktop Sidebar (resizable) ──────────────────────────────────────────────
function DesktopSidebar({
  pathname, email, streak, lastSynced, displayName, initials, photoURL, onSignOut, width, onWidthChange,
}: {
  pathname: string; email: string; streak: number; lastSynced: string | null;
  displayName: string; initials: string; photoURL?: string | null;
  onSignOut: () => void; width: number; onWidthChange: (w: number) => void;
}) {
  const { openPanel } = useThemeCustomizer();
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(width);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(ev: MouseEvent) {
      if (!dragging.current) return;
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW.current + ev.clientX - startX.current));
      onWidthChange(next);
    }
    function onUp() {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [width, onWidthChange]);

  const collapsed = width <= SIDEBAR_MIN + 8;

  return (
    <aside
      className="hidden md:flex fixed top-0 left-0 h-full flex-col z-30 select-none"
      style={{ width }}
    >
      {/* Main sidebar panel — rounded on right edges */}
      <div className="flex flex-col flex-1 bg-card/95 backdrop-blur border-r border-border rounded-r-2xl overflow-hidden shadow-md h-full">

        {/* Brand */}
        <Link href="/today" className="flex items-center gap-3 border-b border-border px-4 py-4 shrink-0 justify-center md:justify-start">
          {collapsed ? (
            <div className="font-display font-black tracking-tighter text-[18px] leading-none flex items-baseline select-none">
              <span className="bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent drop-shadow-sm">D</span>
              <span className="bg-gradient-to-br from-primary to-orange-500 bg-clip-text text-transparent drop-shadow-sm">⁴</span>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="font-display font-black tracking-tighter text-[24px] leading-none flex items-baseline select-none">
                <span className="bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent drop-shadow-md">DSA</span>
                <span className="bg-gradient-to-br from-primary to-orange-500 bg-clip-text text-transparent drop-shadow-md ml-[1px]">⁴⁰⁴</span>
              </div>
              <div className="font-mono text-[9px] font-bold tracking-tight text-muted-foreground leading-tight mt-1 truncate max-w-[160px]">
                404 Distractions. 1 Goal: DSA. 🔥
              </div>
            </div>
          )}
        </Link>

        {/* User card */}
        <div className="border-b border-border px-3 py-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
              {photoURL
                ? <img src={photoURL} alt="avatar" className="size-full object-cover" />
                : <span className="text-sm font-bold text-primary">{initials}</span>
              }
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{displayName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{email}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {streak > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  <Flame className="size-3 animate-streak" />{streak}d
                </span>
              )}
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Cloud className="size-3" />
                {lastSynced ? new Date(lastSynced).toLocaleTimeString() : "—"}
              </span>
              <div className="ml-auto"><ThemeToggle /></div>
            </div>
          )}
          {collapsed && (
            <div className="mt-2 flex flex-col items-center gap-1">
              {streak > 0 && <span className="text-[10px] font-bold text-primary flex items-center gap-0.5"><Flame className="size-3" />{streak}</span>}
              <ThemeToggle />
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav aria-label="Sidebar navigation" className="flex-1 overflow-y-auto py-2 px-2">
          <ul className="space-y-0.5">
            {NAV.map((n) => {
              const isActive = pathname.startsWith(n.to);
              return (
                <li key={n.to}>
                  <Link
                    href={n.to}
                    aria-current={isActive ? "page" : undefined}
                    title={collapsed ? n.label : undefined}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all duration-150",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <n.icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                    {!collapsed && <span className="truncate flex-1">{n.label}</span>}
                    {!collapsed && isActive && <span className="ml-auto size-1.5 rounded-full bg-primary shrink-0" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-border px-2 py-2 space-y-0.5 shrink-0">
          <button
            onClick={openPanel}
            title="Customize Color & Font"
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Palette className="size-3.5 shrink-0" />
            {!collapsed && <span>Customize Color & Font</span>}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                <CircleUser className="size-3.5 shrink-0" />
                {!collapsed && <><span>Account</span><ChevronRight className="size-3 ml-auto" /></>}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56">
              <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href="/"><Home className="mr-2 size-4" /> Home</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/profile"><UserCircle2 className="mr-2 size-4" /> Profile</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/settings"><Settings className="mr-2 size-4" /> Settings</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 size-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Drag handle — rounded pill on right edge */}
      <div
        onMouseDown={onMouseDown}
        title="Drag to resize sidebar"
        className={cn(
          "absolute top-1/2 -translate-y-1/2 right-0 translate-x-1/2 z-40",
          "flex items-center justify-center",
          "w-4 h-10 rounded-full border border-border bg-card shadow-md",
          "cursor-col-resize hover:bg-primary/10 hover:border-primary/40 transition-colors group",
        )}
      >
        <GripVertical className="size-3 text-muted-foreground group-hover:text-primary" />
      </div>

      {/* Corner decorations — small rounded blobs on sidebar corners */}
      <div className="absolute top-0 right-0 size-3 rounded-bl-xl border-b border-l border-border bg-background pointer-events-none" />
      <div className="absolute bottom-0 right-0 size-3 rounded-tl-xl border-t border-l border-border bg-background pointer-events-none" />
    </aside>
  );
}

// ─── Mobile Drawer ─────────────────────────────────────────────────────────────
function MobileDrawer({
  open, onClose, pathname, email, streak, lastSynced, displayName, initials, photoURL, onSignOut,
}: {
  open: boolean; onClose: () => void; pathname: string; email: string; streak: number;
  lastSynced: string | null; displayName: string; initials: string; photoURL?: string | null;
  onSignOut: () => void;
}) {
  const { openPanel } = useThemeCustomizer();
  return (
    <>
      <div
        className={cn("fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}
        aria-hidden="true" onClick={onClose}
      />
      <aside
        aria-label="Navigation drawer"
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-[280px] flex flex-col",
          "bg-card border-r border-border rounded-r-2xl shadow-2xl",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Identity header */}
        <div className="relative bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border-b border-border px-5 pt-10 pb-5 rounded-tr-2xl">
          <button onClick={onClose} aria-label="Close navigation"
            className="absolute top-4 right-4 rounded-full p-1.5 text-muted-foreground hover:bg-secondary transition-colors">
            <X className="size-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
              {photoURL ? <img src={photoURL} alt="avatar" className="size-full object-cover" /> : <span className="text-lg font-bold text-primary">{initials}</span>}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{displayName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{email}</p>
            </div>
          </div>
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {streak > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                <Flame className="size-3.5 animate-streak" />{streak} day streak
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
              <Cloud className="size-3" />{lastSynced ? new Date(lastSynced).toLocaleTimeString() : "Not synced"}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <Link href="/profile" onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary transition-colors" aria-label="Profile">
                <UserCircle2 className="size-5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="px-4 py-2 border-b border-border bg-muted/30">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Navigation</p>
        </div>

        <nav aria-label="Drawer navigation" className="flex-1 overflow-y-auto py-2 px-2">
          <ul className="space-y-0.5">
            {NAV.map((n) => {
              const isActive = pathname.startsWith(n.to);
              return (
                <li key={n.to}>
                  <Link href={n.to} onClick={onClose}
                    className={cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
                    <div className={cn("shrink-0 flex items-center justify-center rounded-lg size-8",
                      isActive ? "bg-primary/15" : "bg-muted/60")}>
                      <n.icon className={cn("size-4", isActive ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium", isActive && "font-semibold text-primary")}>{n.label}</p>
                      <p className="text-[10px] opacity-60 line-clamp-1 mt-0.5">{n.hint}</p>
                    </div>
                    {isActive && <span className="shrink-0 size-1.5 rounded-full bg-primary" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border px-3 py-3 space-y-0.5 rounded-br-2xl shrink-0">
          <button onClick={() => { openPanel(); onClose(); }}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            <Palette className="size-3.5 shrink-0" />
            <span>Customize Color & Font</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                <CircleUser className="size-3.5 shrink-0" />
                <span>Account</span><ChevronRight className="size-3 ml-auto" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56">
              <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href="/"><Home className="mr-2 size-4" /> Home</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/profile" onClick={onClose}><UserCircle2 className="mr-2 size-4" /> Profile</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/settings" onClick={onClose}><Settings className="mr-2 size-4" /> Settings</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 size-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────
export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const { lastSynced, days } = usePlan();
  const { settings } = useSettings();
  const { user } = useAuth();
  const { openPanel } = useThemeCustomizer();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const streak = currentStreak(days);

  const displayName = user?.displayName || email?.split("@")[0] || "Developer";
  const initials = displayName[0]?.toUpperCase() ?? "?";
  const photoURL = user?.photoURL;

  // Load persisted sidebar width
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved) setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Number(saved))));
    } catch {}
  }, []);

  const handleSidebarWidth = useCallback((w: number) => {
    setSidebarWidth(w);
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(w)); } catch {}
  }, []);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Swipe-to-open drawer (mobile)
  useEffect(() => {
    let startX = 0, startY = 0;
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; };
    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (startX < 40 && dx > 60 && dy < 80) setDrawerOpen(true);
      if (drawerOpen && dx < -60 && dy < 80) setDrawerOpen(false);
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [drawerOpen]);

  const activeNav = NAV.find((n) => pathname.startsWith(n.to)) ?? NAV[0];

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await firebaseSignOut(auth);
    router.push("/auth?next=/today");
  }

  const sharedProps = {
    pathname, email, streak, lastSynced, displayName, initials, photoURL,
    onSignOut: () => void signOut(),
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* Desktop sidebar */}
      <DesktopSidebar {...sharedProps} width={sidebarWidth} onWidthChange={handleSidebarWidth} />

      {/* Mobile drawer */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} {...sharedProps} />

      {/* Page layout — shifts right by sidebar width on desktop */}
      <div
        className="min-h-screen w-full max-w-full overflow-x-hidden bg-background transition-[padding] duration-200"
      >
        {/* ─ Outer wrapper shifts right on desktop ─ */}
        <div className="md:transition-[padding] md:duration-200 md:pl-[var(--sidebar-w)]" style={{ ['--sidebar-w' as string]: `${sidebarWidth}px` } as React.CSSProperties}>

          {/* Mobile-only top header */}
          <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur md:hidden">
            <div className="flex items-center gap-2 px-4 py-3">
              <button onClick={() => setDrawerOpen((v) => !v)} aria-label="Open navigation" aria-expanded={drawerOpen}
                className="flex shrink-0 items-center justify-center size-9 rounded-xl border border-border bg-secondary/60 transition-colors hover:bg-secondary">
                <Menu className="size-5" />
              </button>
              <button onClick={() => setDrawerOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary border border-primary/20">
                <activeNav.icon className="size-3.5 shrink-0" />
                <span>{activeNav.label}</span>
              </button>
              <Link href="/today" className="ml-2 flex items-center gap-1.5">
                <div className="font-display font-black tracking-tighter text-[20px] leading-none flex items-baseline select-none">
                  <span className="bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent drop-shadow-sm">DSA</span>
                  <span className="bg-gradient-to-br from-primary to-orange-500 bg-clip-text text-transparent drop-shadow-sm ml-[1px]">⁴⁰⁴</span>
                </div>
              </Link>
              <div className="ml-auto flex items-center gap-1">
                {streak > 0 && (
                  <span className="hidden items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary xs:flex">
                    <Flame className="size-3.5 animate-streak" />{streak}
                  </span>
                )}
                <ThemeToggle />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Account menu"><CircleUser className="size-5" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{email}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild><Link href="/"><Home className="mr-2 size-4" /> Home</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/profile"><UserCircle2 className="mr-2 size-4" /> Profile</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/settings"><Settings className="mr-2 size-4" /> Settings</Link></DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openPanel()}><Palette className="mr-2 size-4" /> Customize Color & Font</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => void signOut()} className="text-destructive focus:text-destructive">Log out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Desktop context ribbon — same height as header (~52px), shows active page hint */}
          <div className="hidden md:flex sticky top-0 z-20 items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-6 py-3 min-h-[52px]">
            <div className="flex items-center gap-2 min-w-0">
              <activeNav.icon className="size-4 text-primary shrink-0" aria-hidden="true" />
              <span className="font-semibold text-sm text-foreground">{activeNav.label}</span>
              <span className="hidden lg:inline text-muted-foreground mx-1.5">·</span>
              <span className="hidden lg:block text-xs text-muted-foreground truncate leading-snug">{activeNav.hint}</span>
            </div>
            {/* Right side desktop controls */}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {streak > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  <Flame className="size-3.5 animate-streak" />{streak}
                </span>
              )}
              <span className="hidden xl:flex items-center gap-1.5 text-xs text-muted-foreground">
                <Cloud className="size-3.5" />
                {lastSynced ? `Synced ${new Date(lastSynced).toLocaleTimeString()}` : "Not synced yet"}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Account menu"><CircleUser className="size-5" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link href="/"><Home className="mr-2 size-4" /> Home</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/profile"><UserCircle2 className="mr-2 size-4" /> Profile</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/settings"><Settings className="mr-2 size-4" /> Settings</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void signOut()} className="text-destructive focus:text-destructive">Log out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Pause banner */}
          {settings.paused && (
            <div role="status" className="border-b border-warning/40 bg-warning/10">
              <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm text-warning">
                <PauseCircle className="size-4" />
                <span>Preparation paused since {formatDate(settings.pausedFrom ?? "")}. Missed-week checks are off.</span>
                <Link href="/settings" className="ml-auto font-semibold underline underline-offset-4">Resume</Link>
              </div>
            </div>
          )}

          {/* Main content */}
          <main className="w-full min-w-0 px-4 pb-24 pt-6 md:pb-8 md:px-6">{children}</main>

          {/* Theme customizer */}
          <ThemeCustomizerPanel />

          {/* Mobile bottom bar */}
          <nav aria-label="Quick navigation"
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden">
            <ul className="grid grid-cols-3">
              {MOBILE_BAR.map((n) => {
                const isActive = pathname.startsWith(n.to);
                return (
                  <li key={n.to}>
                    <Link href={n.to}
                      className={cn("flex flex-col items-center gap-0.5 px-2 py-2.5 text-[11px] font-medium transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground")}>
                      <n.icon className={cn("size-5", isActive && "text-primary")} aria-hidden="true" />
                      {n.label}
                      {isActive && <span className="size-1 rounded-full bg-primary" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </TooltipProvider>
  );
}
