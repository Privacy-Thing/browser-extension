import { usePopupController } from "./popup-controller";
import { PopupSheetPane } from "./popup-sheet-view";
import { getPopupLayoutStyle, PopupShellPane } from "./popup-shell-view";

export const PopupApp = () => {
  const controller = usePopupController();
  return (
    <div
      className="gw-popup-layout"
      data-workspace-open={controller.state.isRuleSheetOpen ? "true" : "false"}
      data-sizing-state={controller.state.sizingState}
      style={getPopupLayoutStyle(controller)}
    >
      <PopupShellPane controller={controller} />
      <PopupSheetPane controller={controller} />
    </div>
  );
};
