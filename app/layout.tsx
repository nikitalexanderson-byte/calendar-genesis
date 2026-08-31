import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: {
      default: "GENESIS — сакральный календарь",
      template: "%s · GENESIS",
    },
    description:
      "Современный эллинистический альманах: 360 дней порядка, Апейрон и планирование в ритме стихий.",
    applicationName: "GENESIS",
    manifest: "/manifest.webmanifest",
    category: "productivity",
    keywords: ["календарь", "планировщик", "эллинизм", "лунный календарь", "GENESIS"],
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "GENESIS",
    },
    icons: {
      icon: [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    },
    openGraph: {
      title: "GENESIS — сакральный календарь",
      description: "360 дней порядка, Апейрон и лунный ритм.",
      type: "website",
      url: origin,
      images: [{ url: `${origin}/og.png`, width: 1732, height: 899, alt: "GENESIS — сакральный календарь" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "GENESIS — сакральный календарь",
      description: "360 дней порядка, Апейрон и лунный ритм.",
      images: [`${origin}/og.png`],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07171b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
