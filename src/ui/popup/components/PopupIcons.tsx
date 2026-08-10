import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export const PencilIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <path d="M12 20h9" />
    <path d="m16.5 3.5 4 4L8 20l-5 1 1-5 12.5-12.5Z" />
  </svg>
);

export const TerminalIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <path d="m4 17 6-5-6-5" />
    <path d="M12 19h8" />
  </svg>
);

export const TrashIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="m19 6-1 14H6L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

export const SettingsIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <path d="m12 3 1.7 2.7 3.1.7-.7 3.1L18.8 12l-2.7 1.5.7 3.1-3.1.7L12 20.9l-1.7-2.6-3.1-.7.7-3.1L5.2 12l2.7-1.5-.7-3.1 3.1-.7L12 3Z" />
    <circle cx="12" cy="12" r="3.1" />
  </svg>
);

export const CloseIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export const SparklePinIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" />
    <path d="M12 7.4v4.2" />
    <path d="M9.9 9.5h4.2" />
  </svg>
);

export const BellIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4.75 13.5h10.5l-1.2-1.7V8.1a4.05 4.05 0 0 0-8.1 0v3.7l-1.2 1.7Z" />
    <path d="M8.25 15.5a1.9 1.9 0 0 0 3.5 0" />
  </svg>
);

export const SunIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    {...props}
  >
    <circle cx="10" cy="10" r="3.25" />
    <path d="M10 2v1.6M10 16.4V18M2 10h1.6M16.4 10H18M4.35 4.35l1.15 1.15M14.5 14.5l1.15 1.15M15.65 4.35 14.5 5.5M5.5 14.5l-1.15 1.15" />
  </svg>
);

export const MoonIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M15.75 12.65A6.35 6.35 0 0 1 7.35 4.25a6.35 6.35 0 1 0 8.4 8.4Z" />
  </svg>
);

export const SystemThemeIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    {...props}
  >
    <circle cx="10" cy="10" r="6" />
    <path d="M10 4a6 6 0 0 1 0 12Z" fill="currentColor" stroke="none" />
  </svg>
);

export const InfoIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    {...props}
  >
    <circle cx="10" cy="10" r="7" />
    <path d="M10 9v4" />
    <path d="M10 6.25h.01" />
  </svg>
);

export const ExternalLinkIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M11.5 4H16v4.5" />
    <path d="m9 11 7-7" />
    <path d="M14.5 11.5V15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1h3.5" />
  </svg>
);
