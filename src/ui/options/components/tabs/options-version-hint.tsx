import { useEffect, useMemo, useState } from "react";

import {
  parseChromiumUaVersion,
  type BrowserFingerprintSource,
} from "@/shared/browser-fingerprint";
import {
  NUMERIC_ROLLING_ALPHABET,
  RollingCharacter,
} from "@/ui/options/components/rolling-value";

export type VersionHintExample = {
  prefix: string;
  build: string;
  patch: string;
  fullVersion: string;
};
type VersionDigits = { build: string; patch: string };
const HINT_REPLAY_INTERVAL_MS = 3_000;

export const getVersionHintExample = (
  source: BrowserFingerprintSource | undefined,
): VersionHintExample | null => {
  const hintedVersion =
    source?.userAgentData?.fullVersionList?.find(
      ({ brand, version }) =>
        !brand.toLowerCase().startsWith("not") && /^\d+\.\d+\.\d+\.\d+$/.test(version),
    )?.version ??
    source?.userAgentData?.fullVersionList?.find(({ version }) =>
      /^\d+\.\d+\.\d+\.\d+$/.test(version),
    )?.version;
  const fullVersion =
    hintedVersion ??
    (source?.userAgent ? parseChromiumUaVersion(source.userAgent)?.fullVersion : null);
  if (!fullVersion) return null;
  const [major, minor, build, patch] = fullVersion.split(".");
  if (!major || !minor || !build || !patch) return null;
  return { prefix: `${major}.${minor}.`, build, patch, fullVersion };
};

const hashString = (value: string): number => {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 33 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
};

const buildVisualSegment = (
  segment: string,
  salt: string,
  turn: number,
  previous?: string,
): string => {
  if (!/^\d+$/.test(segment)) return segment;
  const numericSegment = Number(segment);
  if (!Number.isInteger(numericSegment)) return segment;
  const minimum = segment.length > 1 ? 10 ** (segment.length - 1) : 0;
  const count = 10 ** segment.length - minimum;
  if (count <= 1) return segment;
  let offset =
    (hashString(`${salt}:${turn}:${segment}:${previous ?? ""}`) % (count - 1)) + 1;
  let numeric = minimum + ((numericSegment - minimum + offset) % count);
  let next = String(numeric).padStart(segment.length, "0");
  if (next === previous) {
    offset = (offset % (count - 1)) + 1;
    numeric = minimum + ((numericSegment - minimum + offset) % count);
    next = String(numeric).padStart(segment.length, "0");
  }
  return next;
};

const buildVisualVersion = (
  example: VersionHintExample,
  turn: number,
  previous?: VersionDigits,
): VersionDigits => ({
  build: buildVisualSegment(
    example.build,
    `${example.fullVersion}:build`,
    turn,
    previous?.build,
  ),
  patch: buildVisualSegment(
    example.patch,
    `${example.fullVersion}:patch`,
    turn,
    previous?.patch,
  ),
});

const OdometerDigit = ({
  animationCycle,
  animationDelayMs,
  fromDigit,
  toDigit,
}: {
  animationCycle: number;
  animationDelayMs: number;
  fromDigit: string;
  toDigit: string;
}) => (
  <RollingCharacter
    fromCharacter={fromDigit}
    toCharacter={toDigit}
    animationCycle={animationCycle}
    animationDelayMs={animationDelayMs}
    alphabet={NUMERIC_ROLLING_ALPHABET}
    fullCycleOnMatch
  />
);

export const AnimatedVersionHint = ({
  catalogVersionDigits = [],
  enabled,
  example,
}: {
  catalogVersionDigits?: readonly VersionDigits[];
  enabled: boolean;
  example: VersionHintExample;
}) => {
  const [animationCycle, setAnimationCycle] = useState(0);
  const actualDigits = useMemo<VersionDigits>(
    () => ({ build: example.build, patch: example.patch }),
    [example.build, example.patch],
  );
  const [versionRange, setVersionRange] = useState({
    from: actualDigits,
    to: actualDigits,
  });
  useEffect(() => {
    if (!enabled) {
      setVersionRange({ from: actualDigits, to: actualDigits });
      setAnimationCycle(0);
      return;
    }
    let turn = 0;
    setVersionRange({ from: actualDigits, to: actualDigits });
    setAnimationCycle(0);
    const advanceVersion = () => {
      turn += 1;
      setVersionRange((current) => {
        const from = turn === 1 ? actualDigits : current.to;
        const to =
          catalogVersionDigits.length > 0
            ? (catalogVersionDigits[
                // eslint-disable-next-line sonarjs/pseudo-random -- decorative version odometer, not a security context
                Math.floor(Math.random() * catalogVersionDigits.length)
              ] ?? current.to)
            : buildVisualVersion(example, turn, current.to);
        return { from, to };
      });
      setAnimationCycle((current) => current + 1);
    };
    advanceVersion();
    const intervalId = window.setInterval(advanceVersion, HINT_REPLAY_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- example object excluded; all used fields are tracked below
  }, [
    enabled,
    actualDigits,
    catalogVersionDigits,
    example.build,
    example.fullVersion,
    example.patch,
    example.prefix,
  ]);
  if (!enabled) return <span className="text-foreground">{example.fullVersion}</span>;
  const renderDigits = (kind: keyof VersionDigits) =>
    Array.from(versionRange.to[kind]).map((digit, index, digits) => (
      <OdometerDigit
        key={`${kind}-${digits.length - index}`}
        fromDigit={versionRange.from[kind][index] ?? digit}
        toDigit={digit}
        animationCycle={animationCycle}
        animationDelayMs={(digits.length - index - 1) * 75}
      />
    ));
  return (
    <>
      <span className="text-foreground">{example.prefix}</span>
      <span className="sr-only">{`${example.prefix}${versionRange.to.build}.${versionRange.to.patch}`}</span>
      <span aria-hidden="true" className="gw-rolling-value text-primary">
        {renderDigits("build")}
        <span className="gw-rolling-value-separator">.</span>
        {renderDigits("patch")}
      </span>
    </>
  );
};
