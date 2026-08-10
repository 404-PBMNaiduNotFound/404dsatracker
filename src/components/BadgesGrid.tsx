"use client";

import type { Badge } from "@/lib/gamification";
import { Award, Lock, ShieldCheck, Trophy, Zap, Star, Target, CheckCircle2 } from "lucide-react";

export interface BadgesGridProps {
  badges: Badge[];
}

function getBadgeIcon(code: string, earned: boolean) {
  const iconClass = earned ? "size-5 text-amber-500 dark:text-amber-400" : "size-5 text-muted-foreground/60";
  if (code.startsWith("streak_")) return <Zap className={iconClass} />;
  if (code.startsWith("first_")) return <Target className={iconClass} />;
  if (code === "halfway") return <Star className={iconClass} />;
  if (code === "finisher") return <Trophy className={iconClass} />;
  if (code.startsWith("section_")) return <ShieldCheck className={iconClass} />;
  return <Award className={iconClass} />;
}

export function BadgesGrid({ badges }: BadgesGridProps) {
  const earnedList = badges.filter((b) => b.earned);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-amber-500" />
          <h2 className="font-display text-lg font-semibold">Badges & Achievements</h2>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
          {earnedList.length} of {badges.length} Unlocked
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {badges.map((b) => (
          <div
            key={b.code}
            className={`relative flex items-start gap-3 rounded-xl border p-3.5 transition-all ${
              b.earned
                ? "border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card shadow-sm hover:border-amber-500/50"
                : "border-border/60 bg-muted/20 opacity-65"
            }`}
          >
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
                b.earned
                  ? "border-amber-500/40 bg-amber-500/10 shadow-inner"
                  : "border-border bg-muted/40"
              }`}
            >
              {getBadgeIcon(b.code, b.earned)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold truncate">{b.label}</p>
                {b.earned ? (
                  <CheckCircle2 className="size-3.5 text-amber-500 shrink-0 ml-auto" />
                ) : (
                  <Lock className="size-3.5 text-muted-foreground/60 shrink-0 ml-auto" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {b.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
