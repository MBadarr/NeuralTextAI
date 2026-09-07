export type IconName =
  | "grid"
  | "scan"
  | "file"
  | "users"
  | "chart"
  | "search"
  | "layers"
  | "settings"
  | "help"
  | "bell"
  | "arrow"
  | "spark";

const paths: Record<IconName, string> = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  scan: "M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M8 8h8v8H8z",
  file: "M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h5",
  users:
    "M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 10a4 4 0 100-8 4 4 0 000 8zM17 11a3 3 0 100-6M17 14h1a4 4 0 014 4v2",
  chart: "M4 19V5M4 19h17M8 16v-5M12 16V7M16 16v-3M20 16V4",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5",
  settings:
    "M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5v.1h-2.6v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H6.4v-2.6h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 001.9-.3 1.7 1.7 0 001-1.5v-.1H15v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.5 1h.1V14h-.1a1.7 1.7 0 00-1.5 1z",
  help: "M9.1 9a3 3 0 115.8 1c0 2-3 2-3 4M12 18h.01M12 22a10 10 0 100-20 10 10 0 000 20z",
  bell: "M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  arrow: "M5 12h14M13 6l6 6-6 6",
  spark:
    "M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3zM19 16l.6 1.8L21 18.5l-1.4.5L19 21l-.6-2-1.4-.5 1.4-.7L19 16z",
};

export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
