import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { repo } from "@/lib/data";

export const metadata = { title: "Editar producto" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([repo().getProductById(id), repo().listCategories({ includeHidden: true })]);
  if (!product) notFound();
  return <ProductForm key={product.updatedAt} product={product} categories={categories} />;
}
