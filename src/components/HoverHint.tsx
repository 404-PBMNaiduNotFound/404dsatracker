import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Wraps any element (button, link, ConfirmDialog trigger, …) with a small
 * hover tooltip explaining what it does. Works even when the wrapped
 * control is `disabled`, since the tooltip listens on the surrounding span
 * rather than the (pointer-events: none) control itself.
 */
export function HoverHint({ hint, children }: { hint: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-56 text-center">{hint}</TooltipContent>
    </Tooltip>
  );
}
