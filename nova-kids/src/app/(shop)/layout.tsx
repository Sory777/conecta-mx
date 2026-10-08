import { ShopChrome } from "@/components/layout/shop-chrome";

// Las páginas leen inventario y precios en cada petición.
export const dynamic = "force-dynamic";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <ShopChrome>{children}</ShopChrome>;
}
