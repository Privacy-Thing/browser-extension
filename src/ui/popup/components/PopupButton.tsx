import { forwardRef } from "react";

export type PopupButtonVariant =
  "primary" | "secondary" | "destructive" | "ghost" | "link" | "warning";

export type PopupButtonSize = "sm" | "md" | "lg" | "icon";

type PopupButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: PopupButtonVariant;
  size?: PopupButtonSize;
  tone?: "neutral" | "success" | "warning" | "danger";
  wide?: boolean;
};

export const PopupButton = forwardRef<HTMLButtonElement, PopupButtonProps>(
  (
    {
      className,
      variant = "secondary",
      size = "md",
      tone,
      wide = false,
      type = "button",
      ...props
    },
    ref,
  ) => (
    <button
      {...props}
      ref={ref}
      type={type}
      className={["gw-popup-button", className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size={size}
      data-tone={tone}
      data-wide={wide ? "true" : undefined}
    />
  ),
);

PopupButton.displayName = "PopupButton";
