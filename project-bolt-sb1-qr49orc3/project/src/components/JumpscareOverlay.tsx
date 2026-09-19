import { useEffect, useState } from 'react';

interface JumpscareOverlayProps {
  active: boolean;
  intensity: 'small' | 'big';
  onDone: () => void;
}

export function JumpscareOverlay({ active, intensity, onDone }: JumpscareOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;
    setVisible(true);
    const duration = intensity === 'big' ? 550 : 260;
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDone();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [active, intensity, onDone]);

  if (!visible) return null;

  const big = intensity === 'big';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-black"
      style={{ animation: big ? 'jumpscare-shake 0.5s ease-in-out' : 'jumpscare-flicker 0.25s ease-in-out' }}
    >
      <svg
        viewBox="0 0 200 200"
        className={big ? 'h-[70vh] w-[70vh] max-w-full' : 'h-[35vh] w-[35vh] max-w-full opacity-70'}
        style={{ filter: 'drop-shadow(0 0 40px rgba(255,0,0,0.5))' }}
      >
        <ellipse cx="100" cy="105" rx="70" ry="85" fill="#0a0a0a" stroke="#3a0000" strokeWidth="3" />
        <ellipse cx="70" cy="90" rx="16" ry={big ? 22 : 12} fill="#ff1a1a">
          <animate attributeName="ry" values={big ? '22;28;22' : '12;14;12'} dur="0.3s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="130" cy="90" rx="16" ry={big ? 22 : 12} fill="#ff1a1a">
          <animate attributeName="ry" values={big ? '22;28;22' : '12;14;12'} dur="0.3s" repeatCount="indefinite" />
        </ellipse>
        <circle cx="70" cy="90" r="6" fill="#000" />
        <circle cx="130" cy="90" r="6" fill="#000" />
        <path
          d="M 55 145 Q 100 190 145 145 L 138 150 Q 100 175 62 150 Z"
          fill="#450a0a"
          stroke="#8b0000"
          strokeWidth="2"
        />
        {Array.from({ length: 7 }).map((_, i) => (
          <polygon
            key={i}
            points={`${60 + i * 12},150 ${64 + i * 12},150 ${62 + i * 12},${big ? 172 : 164}`}
            fill="#f8fafc"
          />
        ))}
      </svg>
      <style>{`
        @keyframes jumpscare-shake {
          0% { transform: translate(0,0) scale(1); filter: brightness(1); }
          10% { transform: translate(-12px,8px) scale(1.05); filter: brightness(2.2); }
          25% { transform: translate(10px,-10px) scale(1.1); }
          40% { transform: translate(-8px,6px) scale(1.02); }
          60% { transform: translate(6px,-4px) scale(1.05); }
          100% { transform: translate(0,0) scale(1); filter: brightness(1); }
        }
        @keyframes jumpscare-flicker {
          0% { opacity: 0; }
          30% { opacity: 1; filter: brightness(2); }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
