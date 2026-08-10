export const observeElement = <ElementType extends Element = HTMLElement>(
  root: ParentNode,
  selector: string,
): Promise<ElementType> => {
  const existing = root.querySelector<ElementType>(selector);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const element = root.querySelector<ElementType>(selector);
      if (!element) return;
      observer.disconnect();
      resolve(element);
    });
    observer.observe(root, { childList: true, subtree: true });
  });
};
