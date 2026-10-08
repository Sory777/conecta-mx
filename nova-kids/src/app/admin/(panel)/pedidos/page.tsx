import { AdminHeader } from "@/components/admin/admin-header";
import { OrdersTable } from "@/components/admin/orders-table";
import { repo } from "@/lib/data";

export const metadata = { title: "Pedidos" };

export default async function OrdersPage() {
  const orders = await repo().listOrders();
  return (
    <>
      <AdminHeader title="Pedidos" description={`${orders.length} pedidos`} />
      <OrdersTable orders={orders} />
    </>
  );
}
