/** One fixed product term in a locale's glossary. */
export type GlossaryTerm = {
  id: string;
  /** English term as used in the English catalog. */
  english: string;
  /** English messages matching this pattern must contain `term` or an alternative. */
  required?: RegExp;
  /** Catalog paths exempt from `required`, each with the reason. */
  exempt?: Readonly<Record<string, string>>;
  term: string;
  alternatives?: readonly string[];
  /** Strings that must not appear anywhere in the catalog. */
  forbidden?: readonly string[];
};

/** A locale's terminology, enforced by `locale-copy.test.ts`. */
export type LocaleGlossary = {
  terms: readonly GlossaryTerm[];
  /** Additional strings that must not appear, such as other-region vocabulary. */
  forbidden: readonly string[];
};
