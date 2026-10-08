import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPage } from "@/components/catalog/category-page";
import { getStorefront } from "@/lib/queries";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { categories } = await getStorefront();
  const category = categories.find((c) => c.slug === slug);
  if (!category) return {};
  return {
    title: category.name,
    description: category.description || `${category.name} NOVA KIDS: moda infantil que impulsa su imaginación.`,
    alternates: { canonical: `/categoria/${category.slug}` },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const { products, categories } = await getStorefront();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();
  return <CategoryPage category={category} products={products} categories={categories} />;
}
