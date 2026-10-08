import Link from "next/link";
import { RefreshCcw, Rocket, ShieldCheck, Shirt, Truck } from "lucide-react";
import { Hero } from "@/components/home/hero";
import { CategoryGrid } from "@/components/home/category-grid";
import { ProductGrid } from "@/components/product/product-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { getStorefront } from "@/lib/queries";
import { isNewProduct, isOnSale, productInCategory } from "@/lib/product";
import { sortProducts } from "@/lib/catalog";
import { shippingMethods, store } from "@/config/store";
import { formatPrice } from "@/lib/format";

const freeFrom = shippingMethods.find((m) => m.freeFrom !== null)?.freeFrom;

const BENEFITS = [
  { Icon: Truck, title: "Envíos a todo México", text: freeFrom ? `Gratis en compras desde ${formatPrice(freeFrom)}` : "Rápidos y con seguimiento" },
  { Icon: RefreshCcw, title: "Cambios sencillos", text: "Si la talla no queda, la cambiamos" },
  { Icon: ShieldCheck, title: "Pago seguro", text: "Tarjeta, Mercado Pago, PayPal o transferencia" },
  { Icon: Shirt, title: "Diseño propio", text: "Telas suaves pensadas para jugar" },
];

export default async function HomePage() {
  const { products, categories } = await getStorefront();
  const featured = products.filter((p) => p.featured);
  const spotlight = (featured.length ? featured : products).slice(0, 2);
  const newest = sortProducts(products.filter((p) => isNewProduct(p)), "recientes").slice(0, 8);
  const sale = products.filter(isOnSale).slice(0, 4);
  const best = sortProducts(products, "vendidos").slice(0, 4);
  const counts = Object.fromEntries(categories.map((c) => [c.id, products.filter((p) => productInCategory(p, c)).length]));

  return (
    <>
      <Hero spotlight={spotlight} />

      {/* Beneficios */}
      <section className="relative border-y border-white/8 bg-space-900/60">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-6 px-4 py-8 sm:px-6 lg:grid-cols-4">
          {BENEFITS.map(({ Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10">
                <Icon className="size-5 text-nova-cyan" />
              </span>
              <div>
                <p className="font-display text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-ink-muted">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <SectionHeading eyebrow="Categorías" title="Explora NOVA KIDS" description="Encuentra la prenda perfecta para cada aventura." href="/catalogo" linkLabel="Ver catálogo" />
        <CategoryGrid categories={categories} counts={counts} />
      </section>

      {newest.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
          <SectionHeading eyebrow="Recién llegados" title="Novedades" description="Lo último que aterrizó en la estación NOVA." href="/novedades" />
          <ProductGrid products={newest} />
        </section>
      )}

      {/* Banner de marca */}
      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 px-6 py-14 text-center sm:px-12 sm:py-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#2a1670_0%,_#0c0c22_70%)]" aria-hidden />
          <div className="starfield" aria-hidden />
          <div className="bg-nova-gradient absolute inset-x-0 bottom-0 h-1 opacity-80" aria-hidden />
          <div className="relative">
            <p className="text-nova-gradient font-display text-sm font-bold tracking-[0.4em] sm:text-base">{store.motto}</p>
            <h2 className="mx-auto mt-4 max-w-3xl font-display text-3xl leading-tight font-bold text-white sm:text-5xl">
              Ropa que acompaña cada misión de la infancia
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-ink-muted">
              Diseñamos prendas cómodas, resistentes y con estilo propio para que tus peques exploren sin límites.
            </p>
            <Link href="/nosotros" className="btn btn-secondary mt-8">
              <Rocket className="rocket-icon size-4" /> Conoce la marca
            </Link>
          </div>
        </div>
      </section>

      {sale.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
          <SectionHeading eyebrow="Ofertas" title="Precios que despegan" href="/ofertas" />
          <ProductGrid products={sale} />
        </section>
      )}

      {best.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
          <SectionHeading eyebrow="Favoritos de la tripulación" title="Más vendidos" href="/catalogo?orden=vendidos" />
          <ProductGrid products={best} />
        </section>
      )}

      {products.length === 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-20 text-center sm:px-6">
          <p className="text-ink-muted">Muy pronto verás aquí nuestros productos.</p>
        </section>
      )}
    </>
  );
}
