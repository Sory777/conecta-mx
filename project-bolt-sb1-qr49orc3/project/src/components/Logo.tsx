import { useRef } from 'react';

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  /** Force the light (off-white) ink tone — use when the logo sits on a fixed dark surface (hero, footer) regardless of the active page theme. */
  invert?: boolean;
}

export function Logo({ size = 48, showText = false, className = '', invert = false }: LogoProps) {
  const gradId = useRef(`cmxCGrad-${Math.random().toString(36).slice(2, 8)}`).current;
  const inkClass = invert ? 'text-ink-invert' : 'text-ink dark:text-ink-invert';
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Conecta MX"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(var(--gold-strong))" />
            <stop offset="100%" stopColor="rgb(var(--gold))" />
          </linearGradient>
        </defs>

        {/* Bold C letter: outer r=44, inner r=27, gap ~55° on right side */}
        <path
          d="M 75.3 86.0 A 44 44 0 1 1 75.3 14.0 L 65.5 27.9 A 27 27 0 1 0 65.5 72.1 Z"
          fill={`url(#${gradId})`}
        />

        {/* Three connected people, rendered in a single ink tone for a quiet, monochrome mark */}
        <g fill="currentColor" className={inkClass} opacity="0.85">
          <circle cx="36" cy="38.2" r="2.4" />
          <path d="M 32.8 43.5 A 3.2 3.2 0 0 1 39.2 43.5 Z" />
          <circle cx="64" cy="38.2" r="2.4" />
          <path d="M 60.8 43.5 A 3.2 3.2 0 0 1 67.2 43.5 Z" />
        </g>
        <g fill="currentColor" className={inkClass}>
          <circle cx="50" cy="31.5" r="3.2" />
          <path d="M 45.8 37.5 A 4.2 4.2 0 0 1 54.2 37.5 Z" />
        </g>
        <g fill={`url(#${gradId})`}>
          <circle cx="50" cy="47.5" r="3.6" />
          <path d="M 45.2 54 A 4.8 4.8 0 0 1 54.8 54 Z" />
        </g>

        {/* Location pin, gold */}
        <circle cx="50" cy="64" r="5.5" fill={`url(#${gradId})`} />
        <polygon points="44.5,67 55.5,67 50,76" fill="rgb(var(--gold))" />
      </svg>

      {showText && (
        <div className="leading-none">
          <div className={`font-serif text-[15px] font-bold tracking-tight ${inkClass}`}>CONECTA</div>
          <div className="text-[13px] font-bold tracking-[0.2em] text-gold">MX</div>
        </div>
      )}
    </div>
  );
}
