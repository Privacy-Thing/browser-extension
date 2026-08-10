// @vitest-environment jsdom

import { act, createElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Combobox } from "./combobox";

import { createRafController } from "@/test-utils/animation-frame";

vi.mock("cmdk", async () => {
  const React = await import("react");

  const Command = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
      shouldFilter?: boolean;
      onValueChange?: (value: string) => void;
      value?: string;
    }
  >(
    (
      {
        children,
        shouldFilter: _shouldFilter,
        onValueChange: _onValueChange,
        value: _value,
        ...props
      },
      ref,
    ) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    ),
  );

  const Input = React.forwardRef<
    HTMLInputElement,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
      onValueChange?: (value: string) => void;
    }
  >(({ onValueChange, ...props }, ref) => (
    <input
      ref={ref}
      {...props}
      onChange={(event) => {
        onValueChange?.(event.currentTarget.value);
      }}
    />
  ));

  const List = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    ),
  );

  const Empty = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    (props, ref) => <div ref={ref} {...props} />,
  );

  const Group = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    ),
  );

  const Item = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
      value?: string;
      onSelect?: (value: string) => void;
      disabled?: boolean;
    }
  >(({ children, value = "", onSelect, disabled, onClick, ...props }, ref) => (
    <div
      ref={ref}
      data-disabled={disabled ? "true" : "false"}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        onSelect?.(value);
      }}
    >
      {children}
    </div>
  ));

  const Separator = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >((props, ref) => <div ref={ref} {...props} />);

  return {
    Command,
    default: Object.assign(Command, {
      Input,
      List,
      Empty,
      Group,
      Item,
      Separator,
    }),
  };
});

vi.mock("./popover", async () => {
  const React = await import("react");

  type PopoverContextValue = {
    open: boolean;
    onOpenChange: ((open: boolean) => void) | undefined;
  };

  const PopoverContext = React.createContext<PopoverContextValue>({
    open: false,
    onOpenChange: undefined,
  });

  const Popover = ({
    children,
    open = false,
    onOpenChange,
  }: {
    children?: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <PopoverContext.Provider value={{ open, onOpenChange }}>
      {children}
    </PopoverContext.Provider>
  );

  const PopoverTrigger = ({
    children,
    asChild,
  }: {
    children?: ReactNode;
    asChild?: boolean;
  }) => {
    const { open, onOpenChange } = React.useContext(PopoverContext);

    if (!asChild || !React.isValidElement(children)) {
      return <>{children}</>;
    }

    return React.cloneElement(children as ReactElement<{ onClick?: () => void }>, {
      onClick: () => onOpenChange?.(!open),
    });
  };

  const PopoverContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
      sideOffset?: number;
      onOpenAutoFocus?: (event: { preventDefault: () => void }) => void;
    }
  >(({ children, sideOffset: _sideOffset, onOpenAutoFocus, ...props }, ref) => {
    const { open } = React.useContext(PopoverContext);
    if (!open) {
      return null;
    }

    onOpenAutoFocus?.({
      preventDefault: () => {},
    });

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

  return {
    Popover,
    PopoverTrigger,
    PopoverContent,
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

describe("Combobox", () => {
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

  it("renders aria-labelledby and aria-describedby on the trigger", () => {
    const markup = renderToStaticMarkup(
      createElement(Combobox, {
        options: [{ value: "pl-PL", label: "Polish" }],
        value: "pl-PL",
        id: "locale-combobox",
        "aria-labelledby": "locale-label",
        "aria-describedby": "locale-hint",
      }),
    );

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('id="locale-combobox"');
    expect(markup).toContain('aria-labelledby="locale-label"');
    expect(markup).toContain('aria-describedby="locale-hint"');
  });

  it("scrolls the selected option into view when opened", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    const currentRoot = createRoot(container);
    root = currentRoot;
    await act(async () => {
      currentRoot.render(
        <Combobox
          value="europe-paris"
          options={[
            { value: "europe-warsaw", label: "Europe/Warsaw" },
            { value: "europe-paris", label: "Europe/Paris" },
            { value: "america-new-york", label: "America/New_York" },
          ]}
        />,
      );
    });

    const trigger = container.querySelector('button[role="combobox"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error("Missing combobox trigger.");
    }

    await act(async () => {
      trigger.click();
    });
    await flushEffects();

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      block: "nearest",
    });
    expect(container.querySelector('[data-side-offset="-2"]')).not.toBeNull();
    expect(
      container.querySelector('[data-combobox-option-value="europe-paris"]'),
    ).not.toBeNull();
  });
});
