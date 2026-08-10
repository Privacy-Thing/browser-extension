import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/components/ui/tooltip";

type PopupPowerButtonProps = {
  id?: string;
  state: "active" | "disabled" | "warning";
  disabled?: boolean;
  title?: string;
  ariaLabel: string;
  warningBadgeLabel?: string;
  warningBadgeTitle?: string;
  onWarningBadgeClick?: () => void;
  onClick?: () => void;
};

/**
 * Circular power button with glow effects.
 *
 * Geometry derived from the Affinity Designer SVG (viewBox 564×564):
 *   - outer ring:   r=135 (button edge) — halo glow via box-shadow
 *   - dark gap:     r=133 → inset 1.5%
 *   - inner ring:   r=118 → inset 12.6%
 *   - inner surface: r≈109 → inset 19.3%
 *   - icon area:    r≈49  → font-size 36.3% of button
 *
 * Scale via `--gw-power-size` (defaults to the shared popup size token).
 * Accent color driven by `--gw-power-accent` per `data-state`.
 */
export const PopupPowerButton = ({
  id,
  state,
  disabled = false,
  title,
  ariaLabel,
  warningBadgeLabel,
  warningBadgeTitle,
  onWarningBadgeClick,
  onClick,
}: PopupPowerButtonProps) => (
  <TooltipProvider delayDuration={150}>
    <div className="gw-popup-power-anchor">
      {warningBadgeLabel ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="gw-popup-power-warning"
              aria-label={warningBadgeLabel}
              onClick={onWarningBadgeClick}
            >
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {warningBadgeTitle ?? warningBadgeLabel}
          </TooltipContent>
        </Tooltip>
      ) : null}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            id={id}
            type="button"
            aria-label={ariaLabel}
            data-state={state}
            disabled={disabled}
            onClick={onClick}
            className="gw-popup-power-button"
          >
            <span className="gw-popup-power-gap" aria-hidden="true" />
            <span className="gw-popup-power-inner-ring" aria-hidden="true" />
            <span className="gw-popup-power-surface" aria-hidden="true" />
            <i
              className="fa-solid fa-power-off gw-popup-power-icon"
              aria-hidden="true"
            />
          </button>
        </TooltipTrigger>
        {title ? <TooltipContent side="top">{title}</TooltipContent> : null}
      </Tooltip>
    </div>
  </TooltipProvider>
);
