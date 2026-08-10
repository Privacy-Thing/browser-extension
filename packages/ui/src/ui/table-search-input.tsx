import { Input } from "./input";

export type TableSearchInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "className"
> & {
  className?: string;
};

export const TableSearchInput = ({ className, ...props }: TableSearchInputProps) => {
  return (
    <div className={className}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <Input className="pl-9" {...props} />
      </div>
    </div>
  );
};
