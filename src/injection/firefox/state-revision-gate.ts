export type RevisionedFirefoxState = {
  bootstrap: {
    revision: number;
  };
};

export const createFxRevisionGate = <TState extends RevisionedFirefoxState>(
  applyNewerState: (state: TState) => boolean,
): {
  apply(state: TState): boolean;
  latestRevision(): number;
} => {
  let latestRevision = Number.NEGATIVE_INFINITY;
  return {
    apply(state) {
      if (state.bootstrap.revision <= latestRevision) {
        return false;
      }
      if (!applyNewerState(state)) {
        return false;
      }
      latestRevision = state.bootstrap.revision;
      return true;
    },
    latestRevision: () => latestRevision,
  };
};
