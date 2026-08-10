import { forwardRef, useCallback, useRef, useState } from "react";

import { cn } from "../lib/utils";

export interface TagsInputPrefixTag {
  value: string;
  tone?: "secondary" | "accent";
  title?: string;
  visible?: boolean;
  animated?: boolean;
}

export interface TagsInputProps {
  value?: string[];
  defaultValue?: string[];
  onChange?: (tags: string[]) => void;
  prefixTags?: readonly TagsInputPrefixTag[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  /** Separator keys that commit the current input as a tag. Defaults to Enter and comma. */
  separators?: string[];
  /** Maximum number of tags. */
  maxTags?: number;
}

type TagStateOptions = {
  defaultValue: string[];
  maxTags: number | undefined;
  onChange: TagsInputProps["onChange"] | undefined;
  separators: string[];
  value: string[] | undefined;
};

const useTagState = (options: TagStateOptions) => {
  const { maxTags, onChange, separators } = options;
  const isControlled = options.value !== undefined;
  const [internalTags, setInternalTags] = useState<string[]>(
    options.defaultValue ?? [],
  );
  const [input, setInput] = useState("");
  const tags = isControlled ? options.value! : internalTags;
  const commitTags = useCallback(
    (next: string[]) => {
      if (!isControlled) setInternalTags(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );
  const addTag = useCallback(
    (raw: string) => {
      const tag = raw.trim();
      if (!tag || tags.includes(tag)) return;
      if (maxTags !== undefined && tags.length >= maxTags) return;
      commitTags([...tags, tag]);
      setInput("");
    },
    [commitTags, maxTags, tags],
  );
  const removeTag = useCallback(
    (index: number) => commitTags(tags.filter((_, itemIndex) => itemIndex !== index)),
    [commitTags, tags],
  );
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (separators.includes(event.key)) {
        event.preventDefault();
        addTag(input);
      } else if (event.key === "Backspace" && input === "" && tags.length > 0) {
        removeTag(tags.length - 1);
      }
    },
    [addTag, input, removeTag, separators, tags.length],
  );
  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = event.clipboardData.getData("text");
      if (!separators.includes(",") || !pasted.includes(",")) return;
      event.preventDefault();
      let next = [...tags];
      for (const part of pasted.split(",")) {
        const tag = part.trim();
        if (!tag || next.includes(tag)) continue;
        if (maxTags !== undefined && next.length >= maxTags) break;
        next = [...next, tag];
      }
      commitTags(next);
      setInput("");
    },
    [commitTags, maxTags, separators, tags],
  );
  return { addTag, handleKeyDown, handlePaste, input, removeTag, setInput, tags };
};

const PrefixTags = ({ tags }: { tags: readonly TagsInputPrefixTag[] }) =>
  tags.map((tag) => (
    <span
      key={`prefix-${tag.value}`}
      data-prefix-tag-state={tag.visible === false ? "hidden" : "visible"}
      aria-hidden={tag.visible === false}
      className={cn(
        "my-0.5 inline-grid min-w-0 overflow-hidden align-middle origin-left",
        tag.animated &&
          "transition-[grid-template-columns,max-height,opacity,margin] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]",
        tag.visible === false
          ? "mr-0 h-0 max-h-0 grid-cols-[0fr] opacity-0"
          : "mr-1.5 max-h-8 grid-cols-[1fr] opacity-100",
      )}
    >
      <span
        title={tag.title}
        className={cn(
          "inline-flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
          tag.tone === "accent"
            ? "border-primary/35 bg-primary/10 text-primary"
            : "bg-secondary text-secondary-foreground",
          tag.visible === false && "pointer-events-none border-transparent px-0 py-0",
        )}
      >
        {tag.value}
      </span>
    </span>
  ));

type TagChipsProps = {
  disabled: boolean;
  onRemove: (index: number) => void;
  tags: string[];
};

const TagChips = ({ disabled, onRemove, tags }: TagChipsProps) =>
  tags.map((tag, index) => (
    <span
      // eslint-disable-next-line react/no-array-index-key -- index is a tie-breaker for duplicate tag strings; no stable id available
      key={`${tag}-${index}`}
      className="my-0.5 mr-1.5 inline-flex items-center gap-1 rounded-md border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
    >
      {tag}
      {disabled ? null : (
        <button
          type="button"
          tabIndex={-1}
          className="gw-form-decorative ml-0.5 rounded-sm hover:bg-[color:var(--gw-form-field-hover-surface)] hover:text-accent-foreground"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(index);
          }}
          aria-label={`Remove ${tag}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </span>
  ));

const TagsInput = forwardRef<HTMLDivElement, TagsInputProps>(
  (
    {
      value: controlledValue,
      defaultValue = [],
      onChange,
      prefixTags = [],
      placeholder = "Add tag...",
      ariaLabel,
      disabled = false,
      className,
      separators = ["Enter", ","],
      maxTags,
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const { addTag, handleKeyDown, handlePaste, input, removeTag, setInput, tags } =
      useTagState({
        defaultValue,
        maxTags,
        onChange,
        separators,
        value: controlledValue,
      });

    return (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- click delegates focus to the internal input; keyboard users interact directly with that input
      <div
        ref={ref}
        className={cn(
          "gw-form-control gw-form-focus-within flex min-h-10 w-full flex-wrap items-center rounded-md border px-3 py-2 text-sm transition-colors",
          disabled && "cursor-not-allowed bg-muted/30",
          className,
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <PrefixTags tags={prefixTags} />
        <TagChips disabled={disabled} onRemove={removeTag} tags={tags} />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => addTag(input)}
          placeholder={
            tags.length === 0 && prefixTags.every((tag) => tag.visible === false)
              ? placeholder
              : undefined
          }
          aria-label={ariaLabel ?? placeholder}
          disabled={disabled}
          className="my-0.5 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          style={{ minWidth: "80px" }}
        />
      </div>
    );
  },
);
TagsInput.displayName = "TagsInput";

export { TagsInput };
