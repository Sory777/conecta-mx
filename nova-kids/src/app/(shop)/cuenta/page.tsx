import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { AccountPanel } from "@/components/checkout/account-panel";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

export default function AccountPage() {
  return (
    <>
      <PageHeader eyebrow="Tripulación NOVA" title="Mi cuenta" description="Consulta tus pedidos y tus favoritos." />
      <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
        <AccountPanel />
      </div>
    </>
  );
}
