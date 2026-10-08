import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminHeader } from "@/components/admin/admin-header";
import { ProductTable } from "@/components/admin/product-table";
import { repo } from "@/lib/data";

export const metadata = { title: "Productos" };

export default async function AdminProducts() {
  const [products, categories] = await Promise.all([repo().listProducts({ includeInactive: true }), repo().listCategories({ includeHidden: true })]);
  return (
    <>
      <AdminHeader
        title="Productos"
        description={`${products.length} productos en total`}
        actions={
          <Link href="/admin/productos/nuevo" className="btn btn-primary btn-sm">
            <Plus className="size-4" /> Agregar producto
          </Link>
        }
      />
      <ProductTable initial={products} categories={categories} />
    </>
  );
}
