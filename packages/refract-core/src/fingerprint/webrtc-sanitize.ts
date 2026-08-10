const PRIVATE_CANDIDATE_RES = [
  /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  /\b127\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  /\b169\.254\.\d{1,3}\.\d{1,3}\b/,
  /\b172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}\b/,
  /\b192\.168\.\d{1,3}\.\d{1,3}\b/,
  /\bfe80:[0-9a-f:]+/i,
  /\b(?:fc|fd)[0-9a-f]{2}:/i,
  /\.local\b/i,
] as const;
const PRIVATE_IPV4_VALUES = [
  /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  /\b127\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  /\b169\.254\.\d{1,3}\.\d{1,3}\b/g,
  /\b172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}\b/g,
  /\b192\.168\.\d{1,3}\.\d{1,3}\b/g,
] as const;
const PRIVATE_IPV6_VALUES = [
  /\bfe80:[0-9a-f:]+/gi,
  /\b(?:fc|fd)[0-9a-f]{2}:[0-9a-f:]+/gi,
] as const;

const CANDIDATE_LINE_PREFIX = "a=candidate:";

export const isPrivateCandidate = (candidate: string): boolean => {
  const normalizedCandidate = candidate.toLowerCase();

  if (normalizedCandidate.includes(" typ host")) {
    return true;
  }

  return PRIVATE_CANDIDATE_RES.some((pattern) => pattern.test(candidate));
};

export const sanitizeCandidateValue = (
  candidate: string | null | undefined,
): string | null => {
  if (!candidate) {
    return null;
  }

  return isPrivateCandidate(candidate) ? null : candidate;
};

export const sanitizeSessionSdp = (sdp: string | null | undefined): string | null => {
  if (!sdp) {
    return null;
  }

  return sdp
    .split(/\r?\n/)
    .filter((line) => {
      if (!line.startsWith(CANDIDATE_LINE_PREFIX)) {
        return true;
      }

      return !isPrivateCandidate(line);
    })
    .map((line) => {
      let sanitizedLine = line;

      for (const pattern of PRIVATE_IPV4_VALUES) {
        sanitizedLine = sanitizedLine.replace(pattern, "0.0.0.0");
      }

      for (const pattern of PRIVATE_IPV6_VALUES) {
        sanitizedLine = sanitizedLine.replace(pattern, "::");
      }

      return sanitizedLine.replace(/\.local\b/gi, ".invalid");
    })
    .join("\r\n")
    .replace(/\r\n$/, "");
};

/**
 * Relay candidates are allowed to pass through unchanged, but host and srflx
 * candidates must not leak routable addresses through SDP.
 */
export const getSafeCandidateAddress = (ip: string): string =>
  ip.includes(":") ? "::" : "0.0.0.0";

/**
 * Replace host/srflx candidate addresses with protocol-safe placeholders while
 * leaving the rest of the SDP untouched.
 */
export const sanitizeSdp = (sdp: string): string =>
  sdp
    .replace(
      /^(a=candidate:\S+ \d+ \S+ \d+ )(\S+)( \d+ typ (?:host|srflx).*)$/gm,
      (_match, prefix: string, ip: string, suffix: string) =>
        `${prefix}${getSafeCandidateAddress(ip)}${suffix}`,
    )
    .replace(
      /(\braddr\s+)(\S+)/gi,
      (_match, prefix: string, ip: string) => `${prefix}${getSafeCandidateAddress(ip)}`,
    );
