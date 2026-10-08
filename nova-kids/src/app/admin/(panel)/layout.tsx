import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { isAdmin } from "@/lib/admin-guard";
import { dataProvider, repo } from "@/lib/data";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const orders = await repo().listOrders();
  const pending = orders.filter((o) => o.status === "pendiente" || o.status === "pagado").length;
  return (
    <div className="lg:flex">
      <AdminNav pendingOrders={pending} />
      <div className="min-w-0 flex-1">
        {dataProvider() === "local" && process.env.NODE_ENV === "production" && (
          <p className="bg-warning/10 px-6 py-2 text-xs text-warning">
            Modo de datos local: asegúrate de que el servidor tenga disco persistente o configura DATA_PROVIDER=supabase.
          </p>
        )}
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">{children}</div>
      </div>
    </div>
  );
}
