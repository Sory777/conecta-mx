import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, RefreshCcw, ShieldCheck, Truck } from "lucide-react";
import { Gallery } from "@/components/product/gallery";
import { PurchasePanel } from "@/components/product/purchase-panel";
import { Price } from "@/components/product/price";
import { ProductGrid } from "@/components/product/product-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { getProduct, getStorefront } from "@/lib/queries";
import { discountPercent, isNewProduct, isOnSale, totalStock } from "@/lib/product";
import { GENDER_LABELS } from "@/lib/types";
import { shippingMethods, store } from "@/config/store";
import { formatPrice } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product || product.status !== "active") return { title: "Producto no encontrado" };
  const title = product.seoTitle || product.name;
  const description = product.seoDescription || product.description.slice(0, 160);
  const image = product.images[0]?.url;
  const ogImage = image && !image.endsWith(".svg") ? image : "/brand/og-default.jpg";
  return {
    title,
    description,
    alternates: { canonical: `/producto/${product.slug}` },
    openGraph: {
      type: "website",
      title: `${title} · ${store.name}`,
      description,
      url: `/producto/${product.slug}`,
      images: [{ url: ogImage, alt: product.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product || product.status !== "active") notFound();

  const { products, categories } = await getStorefront();
  const category = categories.find((c) => c.id === product.categoryId);
  const related = products
    .filter((p) => p.id !== product.id)
    .map((p) => ({ p, score: (p.categoryId === product.categoryId ? 2 : 0) + (p.gender === product.gender ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || b.p.soldCount - a.p.soldCount)
    .slice(0, 4)
    .map((x) => x.p);
  const freeFrom = shippingMethods.find((m) => m.freeFrom !== null)?.freeFrom;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    brand: { "@type": "Brand", name: store.name },
    image: product.images.map((i) => new URL(i.url, store.siteUrl).toString()),
    category: category?.name,
    offers: {
      "@type": "Offer",
      url: new URL(`/producto/${product.slug}`, store.siteUrl).toString(),
      priceCurrency: store.currency,
      price: product.price,
      availability: totalStock(product) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:pt-8">
        <nav aria-label="Ruta" className="mb-6 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
          <Link href="/" className="hover:text-white">Inicio</Link>
          <ChevronRight className="size-3" />
          <Link href="/catalogo" className="hover:text-white">Catálogo</Link>
          {category && (
            <>
              <ChevronRight className="size-3" />
              <Link href={`/categoria/${category.slug}`} className="hover:text-white">{category.name}</Link>
            </>
          )}
        </nav>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
          <Gallery images={product.images} name={product.name} />

          <div className="lg:pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xs font-semibold tracking-[0.25em] text-nova-cyan uppercase">NOVA KIDS</span>
              {isNewProduct(product) && <span className="badge badge-new">Nuevo</span>}
              {isOnSale(product) && <span className="badge badge-sale">Oferta −{discountPercent(product)}%</span>}
            </div>
            <h1 className="mt-3 font-display text-3xl leading-tight font-bold text-white sm:text-4xl">{product.name}</h1>
            <Price price={product.price} compareAt={product.compareAtPrice} size="lg" className="mt-4" />
            {isOnSale(product) && product.compareAtPrice && (
              <p className="mt-1 text-sm text-nova-magenta">Ahorras {formatPrice(product.compareAtPrice - product.price)}</p>
            )}
            <p className="mt-5 leading-relaxed text-ink-muted">{product.description}</p>

            <div className="mt-8">
              <PurchasePanel product={product} />
            </div>

            <ul className="mt-8 space-y-3 rounded-2xl border border-white/10 bg-space-900/60 p-5 text-sm">
              <li className="flex gap-3">
                <Truck className="size-5 shrink-0 text-nova-cyan" />
                <span className="text-ink-muted">
                  Envío a todo México{freeFrom ? <> · <strong className="text-white">gratis desde {formatPrice(freeFrom)}</strong></> : null}
                </span>
              </li>
              <li className="flex gap-3">
                <RefreshCcw className="size-5 shrink-0 text-nova-cyan" />
                <span className="text-ink-muted">
                  Cambios de talla sin complicaciones. <Link href="/devoluciones" className="text-white underline-offset-4 hover:underline">Ver política</Link>
                </span>
              </li>
              <li className="flex gap-3">
                <ShieldCheck className="size-5 shrink-0 text-nova-cyan" />
                <span className="text-ink-muted">Pago seguro con tarjeta, Mercado Pago, PayPal o transferencia</span>
              </li>
            </ul>

            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-ink-faint">SKU</dt>
              <dd className="text-ink-muted">{product.sku}</dd>
              {category && (
                <>
                  <dt className="text-ink-faint">Categoría</dt>
                  <dd><Link href={`/categoria/${category.slug}`} className="text-ink-muted hover:text-white">{category.name}</Link></dd>
                </>
              )}
              <dt className="text-ink-faint">Para</dt>
              <dd className="text-ink-muted">{GENDER_LABELS[product.gender]}</dd>
            </dl>
          </div>
        </div>

        {related.length > 0 && (
          <section className="pt-24">
            <SectionHeading eyebrow="Completa el look" title="También te puede gustar" href={category ? `/categoria/${category.slug}` : "/catalogo"} />
            <ProductGrid products={related} />
          </section>
        )}
      </div>
    </>
  );
}
