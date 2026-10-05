import { createUniqueId, type JSX } from 'solid-js';

type IconProps = { size?: number };

const Icon = (props: IconProps & { children: JSX.Element }) => (
  <svg
    width={props.size ?? 16}
    height={props.size ?? 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {props.children}
  </svg>
);

export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const GlobeIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

export const InfoIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </Icon>
);

/** Same geometry as `scripts/generate-icons.mjs`. */
export const BrandMark = (props: IconProps) => {
  const id = createUniqueId();
  return (
    <svg width={props.size ?? 28} height={props.size ?? 28} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={`tile-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2c2e33" />
          <stop offset="1" stop-color="#16171a" />
        </linearGradient>
        <mask id={`crescent-${id}`}>
          <rect width="32" height="32" fill="#fff" />
          <circle cx="20.5" cy="12.5" r="7.2" fill="#000" />
        </mask>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#tile-${id})`} />
      <circle cx="15.5" cy="16.5" r="8.5" fill="#eef0f4" mask={`url(#crescent-${id})`} />
    </svg>
  );
};
