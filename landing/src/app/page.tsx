import type { Metadata } from "next";
import Landing from "@/components/Landing";

export const metadata: Metadata = {
  title: "HOLU — Software para Restaurantes | Carta QR, Pedidos y Cocina en Tiempo Real",
  description: "Conecta mesas, camareros, cocina y administración en una sola app. Carta digital QR, pedidos en tiempo real, caja, propinas, boletas y analítica. Prueba 30 días gratis, sin tarjeta de crédito.",
  keywords: [
    "software para restaurantes",
    "sistema POS restaurante",
    "carta digital QR restaurante",
    "app para restaurantes",
    "gestión restaurante online",
    "pedidos en tiempo real restaurante",
    "cocina conectada restaurante",
    "camareros tablet restaurante",
    "sistema de pedidos restaurante",
    "software cocina restaurante",
    "carta digital para restaurante",
    "programa para restaurantes",
    "HOLU restaurante",
  ],
  metadataBase: new URL("https://holu.pro"),
  alternates: {
    canonical: "https://holu.pro",
  },
  openGraph: {
    title: "HOLU — Software para Restaurantes | Prueba 30 días gratis",
    description: "Mesas QR, pedidos, cocina, caja y administración conectados en tiempo real. Sin papel, sin caos. Prueba 30 días gratis sin tarjeta.",
    url: "https://holu.pro",
    siteName: "HOLU",
    locale: "es_CL",
    type: "website",
    images: [
      {
        url: "https://assets.zyrosite.com/rvH9B7W9kUvvSHwW/holu-logo-cIEzv6scenVM9k3O.png",
        width: 1200,
        height: 630,
        alt: "HOLU — Software para Restaurantes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HOLU — Software para Restaurantes",
    description: "Mesas QR, pedidos, cocina, caja y administración conectados en tiempo real. Prueba 30 días gratis.",
    images: ["https://assets.zyrosite.com/rvH9B7W9kUvvSHwW/holu-logo-cIEzv6scenVM9k3O.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "HOLU",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Software para restaurantes que conecta mesas, camareros, cocina y administración en tiempo real. Carta digital QR, pedidos, caja, propinas y analítica. Sin instalación, funciona desde el navegador.",
  url: "https://holu.pro",
  offers: {
    "@type": "Offer",
    price: "15",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    description: "Plan completo con 30 días gratis al registrarte",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    reviewCount: "48",
  },
  featureList: [
    "Carta digital QR por mesa",
    "Pedidos en tiempo real",
    "Panel de camareros",
    "Pantalla de cocina",
    "Caja y turnos",
    "Propinas y reseñas",
    "Analítica de ventas",
    "Tótem de autoservicio",
  ],
};

export default function Page() {
  const n8nBase = process.env.N8N_WEBHOOK_BASE_URL ?? "";
  const adminUrl = process.env.ADMIN_URL ?? "";
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Landing n8nBase={n8nBase} adminUrl={adminUrl} />
    </>
  );
}
