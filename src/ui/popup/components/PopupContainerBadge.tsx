import {
  ContainerBadge,
  type ContainerBadgeProps,
} from "@/ui/components/ContainerBadge";

export type PopupContainerBadgeProps = ContainerBadgeProps;

/**
 * Popup container badges carry the container accent across both the glyph and
 * the label so the active container reads as one colored object.
 */
export const PopupContainerBadge = ({
  accentName = true,
  ...props
}: PopupContainerBadgeProps) => <ContainerBadge accentName={accentName} {...props} />;
