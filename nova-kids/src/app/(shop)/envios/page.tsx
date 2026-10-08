import type { Metadata } from "next";
import { ProsePage } from "@/components/ui/prose-page";
import { pages } from "@/content/pages";

const page = pages["envios"];

export const metadata: Metadata = { title: page.title, description: page.description, alternates: { canonical: "/envios" } };

export default function Page() {
  return <ProsePage {...page} />;
}
