import { PopupButton } from "./PopupButton";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/components/ui/tooltip";

type PopupFooterActionProps = {
  id?: string;
  label: string;
  title?: string;
  ariaLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
};

export const PopupFooterAction = ({
  id,
  label,
  title,
  ariaLabel,
  disabled = false,
  onClick,
}: PopupFooterActionProps) => (
  <div className="gw-popup-footer-item">
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="gw-popup-footer-trigger"
            {...(disabled ? { tabIndex: 0 } : {})}
            {...(title
              ? { "aria-describedby": `${id ?? "popup-footer-action"}-reason` }
              : {})}
          >
            <PopupButton
              {...(id ? { id } : {})}
              type="button"
              aria-label={ariaLabel ?? label}
              disabled={disabled}
              {...(onClick ? { onClick } : {})}
              variant="ghost"
              className="gw-popup-footer-action"
            >
              <span className="gw-popup-footer-label">{label}</span>
            </PopupButton>
          </span>
        </TooltipTrigger>
        {title ? <TooltipContent side="top">{title}</TooltipContent> : null}
      </Tooltip>
    </TooltipProvider>
    {title ? (
      <span id={`${id ?? "popup-footer-action"}-reason`} className="sr-only">
        {title}
      </span>
    ) : null}
  </div>
);
