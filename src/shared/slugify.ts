const isAsciiLetterOrDigit = (character: string): boolean =>
  (character >= "a" && character <= "z") || (character >= "0" && character <= "9");

const isSeparator = (character: string): boolean =>
  character === "-" ||
  character === "_" ||
  character === " " ||
  character === "\t" ||
  character === "\n" ||
  character === "\r";

export const slugifyToken = (value: string): string => {
  const normalized = value.trim().toLowerCase().normalize("NFKD");
  let result = "";
  let previousWasHyphen = false;

  for (const character of normalized) {
    if (isAsciiLetterOrDigit(character)) {
      result += character;
      previousWasHyphen = false;
      continue;
    }

    if (!isSeparator(character) || previousWasHyphen || result.length === 0) {
      continue;
    }

    result += "-";
    previousWasHyphen = true;
  }

  return previousWasHyphen ? result.slice(0, -1) : result;
};
