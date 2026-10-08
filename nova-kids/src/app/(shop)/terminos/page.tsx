import type { Metadata } from "next";
import { ProsePage } from "@/components/ui/prose-page";
import { pages } from "@/content/pages";

const page = pages["terminos"];

export const metadata: Metadata = { title: page.title, description: page.description, alternates: { canonical: "/terminos" } };

export default function Page() {
  return <ProsePage {...page} />;
}
