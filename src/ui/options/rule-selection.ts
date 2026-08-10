export const getVisibleSelectionState = (
  visibleKeys: readonly string[],
  selectedKeys: ReadonlySet<string>,
): {
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  selectedVisibleCount: number;
} => {
  if (visibleKeys.length === 0) {
    return {
      allVisibleSelected: false,
      someVisibleSelected: false,
      selectedVisibleCount: 0,
    };
  }

  const selectedVisibleCount = visibleKeys.filter((key) =>
    selectedKeys.has(key),
  ).length;

  return {
    allVisibleSelected: selectedVisibleCount === visibleKeys.length,
    someVisibleSelected:
      selectedVisibleCount > 0 && selectedVisibleCount < visibleKeys.length,
    selectedVisibleCount,
  };
};

export const toggleVisibleSelections = (
  visibleKeys: readonly string[],
  selectedKeys: ReadonlySet<string>,
  nextChecked: boolean,
): Set<string> => {
  const next = new Set(selectedKeys);

  for (const key of visibleKeys) {
    if (nextChecked) {
      next.add(key);
    } else {
      next.delete(key);
    }
  }

  return next;
};

export const toggleMatchingSelections = (
  matchingKeys: readonly string[],
  selectedKeys: ReadonlySet<string>,
  nextChecked: boolean,
): Set<string> => {
  const next = new Set(selectedKeys);

  for (const key of matchingKeys) {
    if (nextChecked) {
      next.add(key);
    } else {
      next.delete(key);
    }
  }

  return next;
};
