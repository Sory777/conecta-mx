import { useRef } from 'react';

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 48, showText = false, className = '' }: LogoProps) {
  const gradId = useRef(`cmxCGrad-${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
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
            <stop offset="0%" stopColor="#1E88E5" />
            <stop offset="55%" stopColor="#1565C0" />
            <stop offset="100%" stopColor="#0D47A1" />
          </linearGradient>
        </defs>

        {/* Bold C letter: outer r=44, inner r=27, gap ~55° on right side */}
        {/* Outer right-bottom: (75.3, 86.0) | Outer right-top: (75.3, 14.0) */}
        {/* Inner right-bottom: (65.5, 72.1) | Inner right-top: (65.5, 27.9) */}
        <path
          d="M 75.3 86.0 A 44 44 0 1 1 75.3 14.0 L 65.5 27.9 A 27 27 0 1 0 65.5 72.1 Z"
          fill={`url(#${gradId})`}
        />

        {/* Back-left person (light blue) */}
        <g fill="#42A5F5">
          <circle cx="36" cy="38.2" r="2.4" />
          <path d="M 32.8 43.5 A 3.2 3.2 0 0 1 39.2 43.5 Z" />
        </g>

        {/* Back-right person (light blue) */}
        <g fill="#42A5F5">
          <circle cx="64" cy="38.2" r="2.4" />
          <path d="M 60.8 43.5 A 3.2 3.2 0 0 1 67.2 43.5 Z" />
        </g>

        {/* Center-top person (medium blue, slightly larger) */}
        <g fill="#1E88E5">
          <circle cx="50" cy="31.5" r="3.2" />
          <path d="M 45.8 37.5 A 4.2 4.2 0 0 1 54.2 37.5 Z" />
        </g>

        {/* Front-center person (orange, largest — the "you") */}
        <g fill="#FF8F00">
          <circle cx="50" cy="47.5" r="3.6" />
          <path d="M 45.2 54 A 4.8 4.8 0 0 1 54.8 54 Z" />
        </g>

        {/* Location pin (green) */}
        <circle cx="50" cy="64" r="5.5" fill="#00C853" />
        <polygon points="44.5,67 55.5,67 50,76" fill="#00C853" />
      </svg>

      {showText && (
        <div className="leading-none">
          <div className="text-[13px] font-extrabold tracking-tight text-[#0D47A1]">CONECTA</div>
          <div
            className="text-[15px] font-black tracking-widest"
            style={{
              background: 'linear-gradient(90deg, #00C853, #FF8F00)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            MX
          </div>
        </div>
      )}
    </div>
  );
}
