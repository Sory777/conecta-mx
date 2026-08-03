import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  size?: number;
  showNumber?: boolean;
  reviewCount?: number;
  onChange?: (v: number) => void;
}

export function StarRating({ value, size = 16, showNumber = false, reviewCount, onChange }: StarRatingProps) {
  const interactive = !!onChange;
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = i <= Math.round(value);
          return (
            <button
              key={i}
              type="button"
              disabled={!interactive}
              onClick={() => onChange?.(i)}
              className={interactive ? 'cursor-pointer p-0.5' : 'cursor-default p-0.5'}
              aria-label={`${i} estrellas`}
            >
              <Star
                style={{ width: size, height: size }}
                className={filled ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}
              />
            </button>
          );
        })}
      </div>
      {showNumber && (
        <span className="text-xs font-medium text-slate-500">
          {value > 0 ? value.toFixed(1) : 'Sin reseñas'}
          {reviewCount !== undefined && reviewCount > 0 && ` (${reviewCount})`}
        </span>
      )}
    </div>
  );
}
