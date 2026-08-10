import { PopupFooterAction } from "./PopupFooterAction";

type PopupFooterActionItem = {
  id?: string;
  label: string;
  title?: string;
  ariaLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
};

export const PopupFooter = ({ actions }: { actions: PopupFooterActionItem[] }) => (
  <footer className="gw-popup-footer">
    <div
      className="gw-popup-footer-grid"
      style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}
    >
      {actions.map((action) => (
        <PopupFooterAction key={action.id ?? action.label} {...action} />
      ))}
    </div>
  </footer>
);
