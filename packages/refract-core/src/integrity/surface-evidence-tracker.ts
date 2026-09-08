/* eslint-disable max-lines-per-function -- factory keeps all private evidence state closed over. */

import {
  createPrivateMap,
  createPrivateSet,
  privateMapDelete,
  privateMapForEach,
  privateMapGet,
  privateMapSet,
  privateSetAdd,
  privateSetForEach,
} from "../runtime/primordials";

import type {
  IntegrityResult,
  SurfaceEvidence,
  SurfaceEvidenceSink,
  SurfaceIntegrityStatus,
} from "./surface-integrity-types";

type Registration<TSurfaceId extends string> = {
  surfaceId: TSurfaceId;
  realmId: string;
};

const STATUS_RANK: Record<SurfaceIntegrityStatus, number> = {
  unrecoverable: 4,
  unconfirmed: 3,
  repaired: 2,
  intact: 1,
  "not-applicable": 0,
};

const groupKey = (surfaceId: string, realmId: string): string =>
  `${surfaceId.length}:${surfaceId}${realmId}`;

const isSame = <TSurfaceId extends string>(
  previous: SurfaceEvidence<TSurfaceId> | undefined,
  next: SurfaceEvidence<TSurfaceId>,
): boolean => previous?.status === next.status && previous.reason === next.reason;

/** Maintains current evidence independently of the registry's bounded history. */
export const createSurfaceEvidence = <
  TSurfaceId extends string,
  TMethodId extends string,
>(
  now: () => number,
) => {
  const registrations = createPrivateMap<number, Registration<TSurfaceId>>();
  const results = createPrivateMap<
    number,
    IntegrityResult<TSurfaceId, TMethodId> | null
  >();
  const reports = createPrivateMap<string, SurfaceEvidence<TSurfaceId>>();
  let dirtyGroups = createPrivateSet<string>();
  let batchDepth = 0;
  let sink: SurfaceEvidenceSink<TSurfaceId> | null = null;

  const aggregate = (
    surfaceId: TSurfaceId,
    realmId: string,
  ): SurfaceEvidence<TSurfaceId> => {
    let result: SurfaceEvidence<TSurfaceId> = {
      surfaceId,
      realmId,
      status: "not-applicable",
      observedAt: now(),
    };
    privateMapForEach(registrations, (registration, id) => {
      if (registration.surfaceId !== surfaceId || registration.realmId !== realmId)
        return;
      const current = privateMapGet(results, id);
      const candidate: SurfaceEvidence<TSurfaceId> = current
        ? {
            surfaceId: current.surfaceId,
            realmId: current.realmId,
            status: current.status,
            observedAt: result.observedAt,
            ...(current.reason !== undefined ? { reason: current.reason } : {}),
          }
        : {
            surfaceId,
            realmId,
            status: "unconfirmed",
            reason: "target-not-ready",
            observedAt: result.observedAt,
          };
      const rank = STATUS_RANK[candidate.status] - STATUS_RANK[result.status];
      if (
        rank > 0 ||
        (rank === 0 && (candidate.reason ?? "") < (result.reason ?? ""))
      ) {
        result = candidate;
      }
    });
    return result;
  };

  const markDirty = (surfaceId: TSurfaceId, realmId: string): void => {
    const key = groupKey(surfaceId, realmId);
    if (!privateMapGet(reports, key)) {
      privateMapSet(reports, key, {
        surfaceId,
        realmId,
        status: "not-applicable",
        observedAt: now(),
      });
    }
    privateSetAdd(dirtyGroups, key);
  };

  const flush = (): void => {
    if (batchDepth > 0 || dirtyGroups.size === 0) return;
    const pending = dirtyGroups;
    dirtyGroups = createPrivateSet();
    privateSetForEach(pending, (key) => {
      const previous = privateMapGet(reports, key);
      if (!previous) return;
      const next = aggregate(previous.surfaceId, previous.realmId);
      if (isSame(previous, next)) return;
      privateMapSet(reports, key, next);
      try {
        sink?.record({ ...next });
      } catch {
        // Reporting must never affect a page call or a descriptor repair.
      }
    });
  };

  const remove = (id: number): void => {
    const registration = privateMapGet(registrations, id);
    if (!registration) return;
    privateMapDelete(registrations, id);
    privateMapDelete(results, id);
    markDirty(registration.surfaceId, registration.realmId);
  };

  return {
    register(id: number, surfaceId: TSurfaceId, realmId: string): void {
      privateMapSet(registrations, id, { surfaceId, realmId });
      privateMapSet(results, id, null);
      markDirty(surfaceId, realmId);
    },
    record(id: number, result: IntegrityResult<TSurfaceId, TMethodId>): void {
      const registration = privateMapGet(registrations, id);
      if (!registration) return;
      privateMapSet(results, id, result);
      markDirty(registration.surfaceId, registration.realmId);
    },
    remove,
    unregisterRealm(realmId: string): void {
      const ids: number[] = [];
      privateMapForEach(registrations, (registration, id) => {
        if (registration.realmId === realmId) ids.push(id);
      });
      for (const id of ids) remove(id);
      flush();
    },
    setSink(next: SurfaceEvidenceSink<TSurfaceId> | null): void {
      sink = next;
      if (!sink) return;
      privateMapForEach(reports, (report) => {
        try {
          sink?.record({ ...report });
        } catch {
          // Reporting must never affect a page call or a descriptor repair.
        }
      });
    },
    run<TResult>(operation: () => TResult): TResult {
      batchDepth += 1;
      try {
        return operation();
      } finally {
        batchDepth -= 1;
        flush();
      }
    },
  };
};
