import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/format";

/**
 * Logotipo oficial NOVA KIDS. Se usa el archivo original (solo se recortó el margen
 * transparente); nunca se deforma: el ancho se fija y la altura se calcula por proporción.
 */
export const LOGO = { src: "/brand/nova-kids-logo.png", width: 1452, height: 760 };

export function Logo({
  className,
  width = 128,
  priority = false,
  href = "/",
}: {
  className?: string;
  width?: number;
  priority?: boolean;
  href?: string | null;
}) {
  const img = (
    <Image
      src={LOGO.src}
      alt="NOVA KIDS"
      width={width}
      height={Math.round((width * LOGO.height) / LOGO.width)}
      priority={priority}
      sizes={`${width}px`}
      className={cn("h-auto select-none", className)}
      style={{ width, height: "auto" }}
    />
  );
  if (!href) return img;
  return (
    <Link href={href} aria-label="NOVA KIDS — inicio" className="inline-flex shrink-0">
      {img}
    </Link>
  );
}
