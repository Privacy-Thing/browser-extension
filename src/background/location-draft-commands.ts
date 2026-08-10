import {
  buildDraftFromCandidate,
  fetchLocationCandidates,
} from "@/background/location-drafts";
import { loadLocations, randomizeLocation } from "@/background/storage/locations";
import { getOsmConsent } from "@/background/storage/preferences";
import { DEFAULT_RANDOM_RADIUS_KM } from "@/shared/settings-defaults";
import type { LocationDraftResponse } from "@/shared/types";

type LocationDraftDeps = {
  ensureStorageMigration: () => Promise<void>;
  setLastKnownProfiles: (profiles: Awaited<ReturnType<typeof loadLocations>>) => void;
};

const normalizeDraftRadius = (randomizeWithinMeters?: number | false): number => {
  if (randomizeWithinMeters === false) return 0;
  const requestedRadius =
    typeof randomizeWithinMeters === "number"
      ? randomizeWithinMeters
      : DEFAULT_RANDOM_RADIUS_KM * 1000;
  return Math.min(Math.max(requestedRadius, 1000), 99000);
};

const randomizeDraft = <TDraft extends ReturnType<typeof buildDraftFromCandidate>>(
  draft: TDraft,
  randomizeWithinMeters?: number | false,
): TDraft => {
  const radiusMeters = normalizeDraftRadius(randomizeWithinMeters);
  return radiusMeters > 0 ? randomizeLocation(draft, radiusMeters) : draft;
};

const loadDraftContext = async (deps: LocationDraftDeps) => {
  await deps.ensureStorageMigration();
  const [profiles, osmConsent] = await Promise.all([loadLocations(), getOsmConsent()]);
  deps.setLastKnownProfiles(profiles);
  return { profiles, osmConsent };
};

export const createLocationDrafts = (deps: LocationDraftDeps) => {
  const createLocationDraft = async (
    query: string,
    randomizeWithinMeters?: number | false,
  ): Promise<LocationDraftResponse> => {
    try {
      const { profiles, osmConsent } = await loadDraftContext(deps);
      if (osmConsent !== "granted") {
        return {
          ok: false,
          error: "Map access is disabled until you grant consent.",
        };
      }
      const candidates = await fetchLocationCandidates(query);
      if (candidates.length > 1) return { ok: true, candidates };
      const candidate = candidates[0];
      if (!candidate) return { ok: false, error: "No matching location found." };
      return {
        ok: true,
        location: randomizeDraft(
          buildDraftFromCandidate(candidate, profiles),
          randomizeWithinMeters,
        ),
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Creating location draft failed.",
      };
    }
  };
  const createDraftFromCandidate = async (
    candidate: Parameters<typeof buildDraftFromCandidate>[0],
    randomizeWithinMeters?: number | false,
  ): Promise<LocationDraftResponse> => {
    try {
      const { profiles, osmConsent } = await loadDraftContext(deps);
      if (osmConsent !== "granted") {
        return {
          ok: false,
          error: "Map access is disabled until you grant consent.",
        };
      }
      return {
        ok: true,
        location: randomizeDraft(
          buildDraftFromCandidate(candidate, profiles),
          randomizeWithinMeters,
        ),
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Creating location draft failed.",
      };
    }
  };
  return { createLocationDraft, createDraftFromCandidate };
};
