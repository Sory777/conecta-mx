import { categoryIcon } from '../lib/constants';

const GRADIENTS = [
  'from-blue-500 to-blue-700',
  'from-emerald-500 to-emerald-700',
  'from-amber-500 to-amber-700',
  'from-rose-500 to-rose-700',
  'from-violet-500 to-violet-700',
  'from-cyan-500 to-cyan-700',
  'from-orange-500 to-orange-700',
  'from-teal-500 to-teal-700',
];

function gradientFor(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

interface BusinessImagePlaceholderProps {
  category: string;
  className?: string;
}

// Most of the 6,000+ imported businesses have no photo of their own yet.
// Showing the exact same stock photo for every one of them (regardless of
// whether it's a taquería, a papelería or a ferretería) looked generic and
// unrelated. This shows the business's own category icon on a color
// derived from the category name instead — no extra image download either.
export function BusinessImagePlaceholder({ category, className = '' }: BusinessImagePlaceholderProps) {
  const Icon = categoryIcon(category);
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br ${gradientFor(category)} ${className}`}>
      <Icon className="h-1/3 w-1/3 text-white/90" strokeWidth={1.5} />
    </div>
  );
}
