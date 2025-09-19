import { useId } from 'react';

interface GrokLogoProps {
  className?: string;
  title?: string;
}

export function GrokLogo({ className, title = 'GrokParty' }: GrokLogoProps) {
  const ringGradientId = useId();
  const accentGradientId = useId();
  const titleId = useId();

  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      role="img"
      aria-labelledby={titleId}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id={titleId}>{title}</title>
      <defs>
        <linearGradient id={ringGradientId} x1="12" y1="8" x2="36" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0f172a" stopOpacity={0.85} />
          <stop offset="1" stopColor="#0f172a" stopOpacity={0.55} />
        </linearGradient>
        <linearGradient id={accentGradientId} x1="18" y1="20" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>

      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="24" cy="24" r="17" stroke={`url(#${ringGradientId})`} strokeWidth="2.6" />
        <path
          d="M17 19.5h14c2.76 0 5 2.17 5 4.84v1.32c0 2.67-2.24 4.84-5 4.84h-6.1L21 32.7v-2.3H17c-2.76 0-5-2.17-5-4.84v-1.32c0-2.67 2.24-4.84 5-4.84Z"
          stroke={`url(#${accentGradientId})`}
          strokeWidth="2"
        />
        <path
          d="M30.5 16.5c2 0 3.5 1.4 3.5 3.16v.94c0 1.74-1.5 3.16-3.5 3.16H29v1.9l-2.3-1.9H24"
          stroke={`url(#${accentGradientId})`}
          strokeWidth="1.6"
        />
        <circle cx="20.5" cy="24" r="1.2" stroke={`url(#${accentGradientId})`} strokeWidth="1.4" />
        <circle cx="26.5" cy="24" r="1.2" stroke={`url(#${accentGradientId})`} strokeWidth="1.4" />
        <path d="M21.5 27.6c.82.86 1.92 1.34 3 1.34s2.18-.48 3-1.34" stroke={`url(#${accentGradientId})`} strokeWidth="1.4" />
        <path d="m13.6 15.1 1.1-2.7 1.1 2.7 2.7 1.1-2.7 1.1-1.1 2.7-1.1-2.7-2.7-1.1z" stroke={`url(#${accentGradientId})`} strokeWidth="1.2" />
      </g>
    </svg>
  );
}
