import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { cn } from "@/ui/components/lib/utils";

const DEFAULT_ROLLING_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
export const NUMERIC_ROLLING_ALPHABET = "0123456789";

const normalizeRollingAlphabet = (alphabet: string): string => {
  const lowered = alphabet.toLowerCase();
  return Array.from(new Set(lowered.split(""))).join("");
};

export const buildCharTransition = (
  fromCharacter: string,
  toCharacter: string,
  {
    alphabet = DEFAULT_ROLLING_ALPHABET,
    fullCycleOnMatch = false,
  }: {
    alphabet?: string;
    fullCycleOnMatch?: boolean;
  } = {},
): { sequence: string[]; steps: number } => {
  const normalizedAlphabet = normalizeRollingAlphabet(alphabet);
  const start = normalizedAlphabet.indexOf(fromCharacter.toLowerCase());
  const end = normalizedAlphabet.indexOf(toCharacter.toLowerCase());
  if (start === -1 || end === -1) {
    return {
      sequence: [toCharacter],
      steps: 0,
    };
  }

  const delta = (end - start + normalizedAlphabet.length) % normalizedAlphabet.length;
  const steps =
    delta === 0 && !fullCycleOnMatch ? 0 : normalizedAlphabet.length + delta;
  if (steps === 0) {
    return {
      sequence: [toCharacter],
      steps: 0,
    };
  }

  const shouldUppercase = toCharacter === toCharacter.toUpperCase();
  return {
    sequence: Array.from({ length: steps + 1 }, (_, index) => {
      const nextCharacter =
        normalizedAlphabet[(start + index) % normalizedAlphabet.length] ?? toCharacter;
      return shouldUppercase ? nextCharacter.toUpperCase() : nextCharacter;
    }),
    steps,
  };
};

export const RollingCharacter = ({
  fromCharacter,
  toCharacter,
  animationCycle,
  animationDelayMs,
  alphabet = DEFAULT_ROLLING_ALPHABET,
  fullCycleOnMatch = false,
  className,
}: {
  fromCharacter: string;
  toCharacter: string;
  animationCycle: number;
  animationDelayMs: number;
  alphabet?: string;
  fullCycleOnMatch?: boolean;
  className?: string;
}) => {
  const transition = useMemo(
    () =>
      buildCharTransition(fromCharacter, toCharacter, {
        alphabet,
        fullCycleOnMatch,
      }),
    [alphabet, fromCharacter, fullCycleOnMatch, toCharacter],
  );
  const animationStyle = {
    "--gw-rolling-character-delay": `${animationDelayMs}ms`,
    "--gw-rolling-character-steps": transition.steps,
  } as CSSProperties;

  return (
    <span className={cn("gw-rolling-character", className)} aria-hidden="true">
      <span
        key={`${fromCharacter}-${toCharacter}-${animationCycle}`}
        style={animationStyle}
        className={cn(
          "gw-rolling-character-track",
          animationCycle > 0 &&
            transition.steps > 0 &&
            "gw-rolling-character-track-animate",
        )}
      >
        {transition.sequence.map((value, index) => (
          // eslint-disable-next-line react/no-array-index-key -- position in animation sequence is the identity; values can repeat across slots
          <span key={`${value}-${index}`} className="gw-rolling-character-slot">
            {value}
          </span>
        ))}
      </span>
    </span>
  );
};

export const RollingValueText = ({
  value,
  alphabet = DEFAULT_ROLLING_ALPHABET,
  fullCycleOnMatch = false,
  characterDelayMs = 75,
  className,
}: {
  value: string;
  alphabet?: string;
  fullCycleOnMatch?: boolean;
  characterDelayMs?: number;
  className?: string;
}) => {
  const previousValueRef = useRef(value);
  const [fromValue, setFromValue] = useState(value);
  const [animationCycle, setAnimationCycle] = useState(0);

  useEffect(() => {
    if (previousValueRef.current === value) {
      return;
    }
    setFromValue(previousValueRef.current);
    previousValueRef.current = value;
    setAnimationCycle((current) => current + 1);
  }, [value]);

  return (
    <span className={cn("gw-rolling-value", className)}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">
        {Array.from(value).map((character, index, characters) => (
          <RollingCharacter
            // eslint-disable-next-line react/no-array-index-key -- character column position is the identity (digit slot)
            key={`rolling-value-${index}`}
            fromCharacter={fromValue[index] ?? character}
            toCharacter={character}
            animationCycle={animationCycle}
            animationDelayMs={(characters.length - index - 1) * characterDelayMs}
            alphabet={alphabet}
            fullCycleOnMatch={fullCycleOnMatch}
          />
        ))}
      </span>
    </span>
  );
};
