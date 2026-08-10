import { createPublicArray, privateArraySet } from "../runtime/primordials";

export type LocaleGetterReaders = {
  language: () => string;
  languages: () => readonly string[];
};

export type LocaleGetterInstaller = <TValue>(
  property: "language" | "languages",
  getter: () => TValue,
) => void;

/**
 * Installs the shared `navigator.language` / `navigator.languages` semantics
 * while leaving native-shape masking and adapter-specific receiver handling to
 * the caller-provided getter installer.
 */
export const installLocaleGetters = (
  defineGetter: LocaleGetterInstaller,
  readers: LocaleGetterReaders,
): void => {
  defineGetter("language", readers.language);
  defineGetter("languages", () => cloneLocaleLanguages(readers.languages()));
};

/** Returns the ordinary Array shape exposed by Navigator/Intl APIs. */
export const cloneLocaleLanguages = (languages: readonly string[]): string[] => {
  const result = createPublicArray<string>(languages.length);
  for (let index = 0; index < languages.length; index += 1) {
    privateArraySet(result, index, languages[index]!);
  }
  return result;
};

export const LOCALE_GETTERS_SOURCE = `const localeObjectDefineProperty=Object.defineProperty;const cloneLocaleLanguages=(languages)=>{const result=new Array(languages.length);for(let index=0;index<languages.length;index+=1)localeObjectDefineProperty(result,index,{configurable:true,enumerable:true,writable:true,value:languages[index]});return result};const installLocaleGetters=(defineGetter,readers)=>{defineGetter("language",readers.language);defineGetter("languages",()=>cloneLocaleLanguages(readers.languages()))};`;
