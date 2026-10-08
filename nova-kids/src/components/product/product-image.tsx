import Image, { type ImageProps } from "next/image";

/**
 * Imagen de producto optimizada (AVIF/WebP, lazy loading y tamaños responsivos).
 * Las ilustraciones SVG de demostración se sirven sin procesar.
 */
export function ProductImage(props: ImageProps) {
  const src = typeof props.src === "string" ? props.src : "";
  return <Image {...props} alt={props.alt} unoptimized={props.unoptimized ?? src.endsWith(".svg")} />;
}
