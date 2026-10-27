import type { en } from "./en";

export type Translations = typeof en;

type WidenCatalog<T> = T extends string
  ? string
  : T extends (...args: infer Args) => string
    ? (...args: Args) => string
    : { readonly [Key in keyof T]: WidenCatalog<T[Key]> };

/** Shape a translated catalog must match: the English keys and message arguments. */
export type LocaleCatalog = WidenCatalog<Translations>;
