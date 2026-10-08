import { StoreProvider } from "@/components/store/store-provider";
import { Header } from "./header";
import { Footer } from "./footer";
import { CartDrawer } from "./cart-drawer";
import { SearchOverlay } from "./search-overlay";
import { Toaster } from "@/components/ui/toaster";

/** Estructura común de la tienda pública: header, footer, carrito, buscador y avisos. */
export function ShopChrome({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-space-900">
        Saltar al contenido
      </a>
      <Header />
      <main id="contenido" className="min-h-[60vh]">{children}</main>
      <Footer />
      <CartDrawer />
      <SearchOverlay />
      <Toaster />
    </StoreProvider>
  );
}
