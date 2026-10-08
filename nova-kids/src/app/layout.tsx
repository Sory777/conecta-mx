import type { Metadata, Viewport } from "next";
import { Inter, Lexend } from "next/font/google";
import { store } from "@/config/store";
import "./globals.css";

const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Lexend({ subsets: ["latin"], variable: "--font-display-face", display: "swap", weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  metadataBase: new URL(store.siteUrl),
  title: {
    default: `${store.name} · ${store.tagline}`,
    template: `%s · ${store.name}`,
  },
  description: store.description,
  applicationName: store.name,
  icons: {
    icon: [{ url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" }, { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: "/brand/apple-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: store.name,
    title: `${store.name} · ${store.tagline}`,
    description: store.description,
    images: [{ url: "/brand/og-default.jpg", width: 1200, height: 630, alt: store.name }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#04040d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
