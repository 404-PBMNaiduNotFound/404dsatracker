"use client";



export function QuoteLoader({
  fullScreen = true,
}: {
  fullScreen?: boolean;
}) {
  const overlayClass = fullScreen
    ? "fixed inset-0 z-50 flex items-center justify-center bg-background/80"
    : "flex items-center justify-center min-h-[200px] w-full bg-background/80";

  return (
    <div className={overlayClass} role="status" aria-busy="true">
      <style>{`
        @keyframes morphShape {
          0%, 100% { clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); } /* Diamond */
          25% { clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%); } /* Hexagon */
          50% { clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%); } /* Octagon */
          75% { clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); } /* Star */
        }
        .animate-morph {
          animation: morphShape 6s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
      <div className="flex flex-col items-center gap-4 rounded-[2rem] border border-border/40 bg-card/90 px-12 py-10 shadow-2xl backdrop-blur-md">
        
        <div className="size-20 flex items-center justify-center bg-background shadow-inner overflow-hidden border border-border/50 animate-morph mb-2">
          <img src="/logo.jpg" alt="DSA404 Logo" className="size-full object-cover" />
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="font-display font-black tracking-tighter text-[48px] leading-none flex items-baseline select-none">
            <span className="bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent drop-shadow-md">DSA</span>
            <span className="bg-gradient-to-br from-primary to-orange-500 bg-clip-text text-transparent drop-shadow-md ml-[2px]">⁴⁰⁴</span>
          </div>
          <div className="font-mono text-sm sm:text-[15px] font-bold tracking-tight mt-4 text-foreground/80">
            Find. Solve. Master. 🔥
          </div>
        </div>

        <div className="flex items-center gap-2 mt-6">
          <div className="size-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="size-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="size-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>

        <div className="mt-8 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">
          DSA Tracker
        </div>
      </div>
    </div>
  );
}
