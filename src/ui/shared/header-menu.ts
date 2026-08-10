export const HEADER_MENU_ITEM_CLASS =
  "h-8 px-3.5 text-sm font-medium rounded-full border border-transparent " +
  "text-muted-foreground hover:text-foreground hover:bg-accent " +
  "transition-colors duration-150";

export const HEADER_TRIGGER_CLASS =
  `${HEADER_MENU_ITEM_CLASS} ` +
  "data-[state=active]:bg-foreground data-[state=active]:text-background " +
  "data-[state=active]:border-foreground/10 data-[state=active]:shadow-sm " +
  "dark:data-[state=active]:bg-foreground/90";
