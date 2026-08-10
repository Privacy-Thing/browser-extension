export type PopupBorderTiming = "steady" | "boosted" | "urgent";

export const resolvePopupBorderTiming = ({
  hasError,
  hasUserTopic,
  tone,
}: {
  hasError: boolean;
  hasUserTopic: boolean;
  tone: "active" | "disabled" | "warning" | "danger";
}): PopupBorderTiming => {
  if (hasError) return "urgent";
  if (hasUserTopic) return "boosted";
  if (tone === "warning" || tone === "danger") return "urgent";
  return "steady";
};
