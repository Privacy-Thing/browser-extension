// @vitest-environment jsdom

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

import { createRafController } from "@/test-utils/animation-frame";

vi.mock("@radix-ui/react-select", async () => {
  const React = await import("react");

  type SelectContextValue = {
    open: boolean;
    value: string;
  };

  const SelectContext = React.createContext<SelectContextValue>({
    open: false,
    value: "",
  });

  const Root = ({
    children,
    open = false,
    value = "",
  }: {
    children?: ReactNode;
    open?: boolean;
    value?: string;
  }) => (
    <SelectContext.Provider value={{ open, value }}>{children}</SelectContext.Provider>
  );

  const Trigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement>
  >((props, ref) => <button ref={ref} type="button" {...props} />);

  const Icon = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const Portal = ({ children }: { children?: ReactNode }) => <>{children}</>;

  const Content = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { position?: string; sideOffset?: number }
  >(({ children, position: _position, sideOffset: _sideOffset, ...props }, ref) => {
    const { open } = React.useContext(SelectContext);
    if (!open) {
      return null;
    }

    return (
      <div
        ref={ref}
        data-side="bottom"
        data-side-offset={String(_sideOffset)}
        {...props}
      >
        {children}
      </div>
    );
  });

  const Viewport = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >((props, ref) => <div ref={ref} data-radix-select-viewport="" {...props} />);

  const Item = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value: string }
  >(({ children, value, ...props }, ref) => {
    const { value: selectedValue } = React.useContext(SelectContext);

    return (
      <div
        ref={ref}
        data-value={value}
        data-state={selectedValue === value ? "checked" : "unchecked"}
        {...props}
      >
        {children}
      </div>
    );
  });

  const ItemIndicator = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const ItemText = ({
    asChild,
    children,
  }: {
    asChild?: boolean;
    children?: ReactNode;
  }) => (asChild ? <>{children}</> : <span>{children}</span>);

  const Group = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Value = ({ children }: { children?: ReactNode }) => <span>{children}</span>;
  const Label = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    (props, ref) => <div ref={ref} {...props} />,
  );
  const Separator = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >((props, ref) => <div ref={ref} {...props} />);

  return {
    Root,
    Trigger,
    Icon,
    Portal,
    Content,
    Viewport,
    Item,
    ItemIndicator,
    ItemText,
    Group,
    Value,
    Label,
    Separator,
  };
});

let animationFrames = createRafController();

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    animationFrames.flushAll();
    await Promise.resolve();
  });
};

describe("Select", () => {
  let root: Root | null = null;
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    animationFrames = createRafController();
    vi.stubGlobal("requestAnimationFrame", animationFrames.request);
    vi.stubGlobal("cancelAnimationFrame", animationFrames.cancel);
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
  });

  afterEach(async () => {
    if (root) {
      const currentRoot = root;
      root = null;
      await act(async () => {
        currentRoot.unmount();
      });
    }

    document.body.innerHTML = "";
    scrollIntoViewMock.mockReset();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("scrolls the selected item into view when the menu opens", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    const currentRoot = createRoot(container);
    root = currentRoot;
    await act(async () => {
      currentRoot.render(
        <Select open value="paris">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="warsaw">Warsaw</SelectItem>
            <SelectItem value="paris">Paris</SelectItem>
            <SelectItem value="london">London</SelectItem>
          </SelectContent>
        </Select>,
      );
    });
    await flushEffects();

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      block: "nearest",
    });
    expect(
      container.querySelector('[data-state="checked"]')?.getAttribute("data-value"),
    ).toBe("paris");
    expect(container.querySelector('[data-side-offset="-2"]')).not.toBeNull();
  });
});
