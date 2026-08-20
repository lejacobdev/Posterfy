/** The Posterfy mark: a framed poster with a record peeking out behind it. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="brand-logo"
    >
      <defs>
        <linearGradient
          id="posterfy-mark"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--brand-500)" />
          <stop offset="0.55" stopColor="var(--brand-400)" />
          <stop offset="1" stopColor="var(--accent-cyan)" />
        </linearGradient>
      </defs>
      <circle cx="21.5" cy="16" r="8.5" fill="url(#posterfy-mark)" opacity="0.45" />
      <circle cx="21.5" cy="16" r="2.6" fill="var(--bg)" />
      <rect
        x="3.5"
        y="4.5"
        width="17"
        height="23"
        rx="2.5"
        fill="var(--bg-elevated)"
        stroke="url(#posterfy-mark)"
        strokeWidth="1.8"
      />
      <rect x="6.8" y="7.8" width="10.4" height="10.4" rx="1" fill="url(#posterfy-mark)" />
      <path
        d="M6.8 21.6h10.4M6.8 24.2h6.6"
        stroke="var(--text-muted)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
