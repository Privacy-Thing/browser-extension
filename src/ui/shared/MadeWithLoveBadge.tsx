import { cn } from "@/ui/components/lib/utils";

export const MadeWithLoveBadge = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "inline-flex items-center gap-1.5 text-[12px] font-medium tracking-[0.14em] text-foreground",
      className,
    )}
    aria-hidden="true"
  >
    <span>Made with</span>
    <span className="text-[1.5em] leading-none text-primary">❤</span>
    <span>in</span>
    <span className="text-[1.5em] leading-none">🇵🇱</span>
  </div>
);
