import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/format";

export function Price({
  price,
  compareAt,
  size = "md",
  className,
}: {
  price: number;
  compareAt?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const onSale = compareAt != null && compareAt > price;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      <span
        className={cn(
          "font-display font-bold text-white",
          size === "sm" && "text-sm",
          size === "md" && "text-base",
          size === "lg" && "text-3xl",
        )}
      >
        {formatPrice(price)}
      </span>
      {onSale && (
        <span className={cn("text-ink-faint line-through", size === "lg" ? "text-lg" : "text-sm")}>
          <span className="sr-only">Antes </span>
          {formatPrice(compareAt!)}
        </span>
      )}
    </div>
  );
}
