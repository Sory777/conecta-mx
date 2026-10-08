"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ExternalLink, FolderTree, LayoutDashboard, LogOut, Menu, Package, ShoppingCart, X } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/format";

const LINKS = [
  { href: "/admin", label: "Resumen", Icon: LayoutDashboard },
  { href: "/admin/productos", label: "Productos", Icon: Package },
  { href: "/admin/categorias", label: "Categorías", Icon: FolderTree },
  { href: "/admin/pedidos", label: "Pedidos", Icon: ShoppingCart },
];

export function AdminNav({ pendingOrders }: { pendingOrders: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {LINKS.map(({ href, label, Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition",
              active ? "bg-white/8 text-white" : "text-ink-muted hover:bg-white/4 hover:text-white",
            )}
          >
            <Icon className={cn("size-4.5", active && "text-nova-cyan")} />
            {label}
            {href === "/admin/pedidos" && pendingOrders > 0 && (
              <span className="bg-nova-gradient ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold text-white">{pendingOrders}</span>
            )}
          </Link>
        );
      })}
      <div className="my-3 h-px bg-white/8" />
      <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-ink-muted hover:text-white">
        <ExternalLink className="size-4.5" /> Ver tienda
      </Link>
      <button type="button" onClick={logout} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm text-ink-muted hover:text-danger">
        <LogOut className="size-4.5" /> Cerrar sesión
      </button>
    </nav>
  );

  return (
    <>
      <div className="surface-glass sticky top-0 z-40 flex h-14 items-center justify-between border-x-0 border-t-0 px-4 lg:hidden">
        <Logo width={84} href="/admin" />
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost grid size-10 place-items-center rounded-full" aria-label="Abrir menú">
          <Menu className="size-5" />
        </button>
      </div>
      <aside className="bg-space-900 sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/8 p-4 lg:flex">
        <div className="mb-8 px-2 pt-2">
          <Logo width={110} href="/admin" />
          <p className="mt-2 text-[11px] font-semibold tracking-[0.25em] text-ink-faint uppercase">Panel</p>
        </div>
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="bg-space-900 absolute inset-y-0 left-0 w-64 p-4">
            <div className="mb-6 flex items-center justify-between">
              <Logo width={96} href="/admin" />
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost grid size-10 place-items-center rounded-full" aria-label="Cerrar">
                <X className="size-5" />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
