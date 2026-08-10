export const shouldCloseSheet = ({
  activeTrigger,
  nextTrigger,
  open,
}: {
  activeTrigger: string | null;
  nextTrigger: string;
  open: boolean;
}): boolean => open && activeTrigger === nextTrigger;
