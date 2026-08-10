import { cn } from "../lib/utils";

export type DropdownChromeSide = "top" | "bottom";
export const dropdownPanelSideOffset = -2;

const focusChromeBorderClass =
  "after:[border-color:var(--gw-form-chrome-border-color)]";
const panelChromeBorderClass =
  "after:[border-color:var(--gw-form-chrome-border-color)]";
const panelBottomShadowClass =
  "data-[side=bottom]:[box-shadow:var(--gw-form-overlay-shadow-bottom)]";
const panelTopShadowClass =
  "data-[side=top]:[box-shadow:var(--gw-form-overlay-shadow-top)]";

export const resolveChromeSide = (
  trigger: HTMLElement | null,
  content: HTMLElement | null,
  fallback: DropdownChromeSide = "bottom",
): DropdownChromeSide => {
  if (!trigger || !content) {
    return fallback;
  }

  const triggerRect = trigger.getBoundingClientRect();
  const contentRect = content.getBoundingClientRect();

  if (contentRect.bottom <= triggerRect.top + 1) {
    return "top";
  }

  if (contentRect.top >= triggerRect.bottom - 1) {
    return "bottom";
  }

  const triggerMidY = triggerRect.top + triggerRect.height / 2;
  const contentMidY = contentRect.top + contentRect.height / 2;
  return contentMidY < triggerMidY ? "top" : "bottom";
};

export const dropdownPanelChromeClass = cn(
  "gw-form-overlay-surface relative p-0",
  "after:pointer-events-none after:absolute after:-inset-x-1 after:border-2 after:content-['']",
  panelChromeBorderClass,
  "data-[side=bottom]:!border-t-0 data-[side=bottom]:!rounded-t-none",
  "data-[side=bottom]:after:top-0 data-[side=bottom]:after:-bottom-1",
  "data-[side=bottom]:after:rounded-[7px] data-[side=bottom]:after:rounded-t-none data-[side=bottom]:after:border-t-0",
  panelBottomShadowClass,
  "data-[side=top]:!border-b-0 data-[side=top]:!rounded-b-none",
  "data-[side=top]:after:-top-1 data-[side=top]:after:bottom-0",
  "data-[side=top]:after:rounded-[7px] data-[side=top]:after:rounded-b-none data-[side=top]:after:border-b-0",
  panelTopShadowClass,
);

export const getTriggerChromeClass = ({
  open,
  side,
}: {
  open: boolean;
  side: DropdownChromeSide;
}): string =>
  cn(
    "gw-form-control gw-form-focus-visible relative rounded-md border outline-none transition-colors",
    "focus-visible:outline-none",
    open &&
      "focus-visible:ring-0 focus-visible:ring-offset-0 after:pointer-events-none after:absolute after:-inset-x-1 after:border-2 after:content-['']",
    open && focusChromeBorderClass,
    open && "hover:[border-color:var(--gw-form-border-color)]",
    open && "hover:[background-color:var(--gw-form-field-surface)]",
    open &&
      side === "bottom" &&
      "!rounded-b-none ![border-bottom-color:var(--gw-form-border-color)]",
    open &&
      side === "bottom" &&
      "after:-top-1 after:bottom-0 after:rounded-[7px] after:rounded-b-none after:border-b-0",
    open &&
      side === "top" &&
      "!rounded-t-none ![border-top-color:var(--gw-form-border-color)]",
    open &&
      side === "top" &&
      "after:top-0 after:-bottom-1 after:rounded-[7px] after:rounded-t-none after:border-t-0",
  );

export const getPanelChromeClass = (side: DropdownChromeSide): string =>
  cn(side === "bottom" && "!rounded-t-none", side === "top" && "!rounded-b-none");
