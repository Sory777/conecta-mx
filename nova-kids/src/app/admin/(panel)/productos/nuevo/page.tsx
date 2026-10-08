import { ProductForm } from "@/components/admin/product-form";
import { repo } from "@/lib/data";

export const metadata = { title: "Agregar producto" };

export default async function NewProductPage() {
  const categories = await repo().listCategories({ includeHidden: true });
  return <ProductForm product={null} categories={categories} />;
}
