import type { Metadata } from "next";
import { Geist, Geist_Mono, Pinyon_Script } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";
import {
  LocalBusinessJsonLd,
  WebsiteJsonLd,
  BreadcrumbJsonLd,
} from "@/components/seo/JsonLd";
import { UltrasoundBackground } from "@/components/animations/UltrasoundBackground";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pinyonScript = Pinyon_Script({
  weight: "400",
  variable: "--font-pinyon-script",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const titles: Record<string, string> = {
    es: "The Rehab Studio | Fisioterapia Deportiva e Invasiva en Zaragoza",
    en: "The Rehab Studio | Sports & Invasive Physiotherapy in Zaragoza",
  };

  const descriptions: Record<string, string> = {
    es: "Centro de fisioterapia en Zaragoza especializado en fisioterapia deportiva, EPI, punción seca y ecografía MSK. Centro autorizado EPI. Calle Dr Cerrada 29.",
    en: "Physiotherapy center in Zaragoza specialized in sports physiotherapy, EPI, dry needling and MSK ultrasound. Authorized EPI center.",
  };

  return {
    metadataBase: new URL("https://therehabstudio.es"),
    title: {
      default: titles[locale] || titles.es,
      template: "%s | The Rehab Studio",
    },
    description: descriptions[locale] || descriptions.es,
    keywords: [
      "fisioterapia Zaragoza",
      "fisioterapeuta Zaragoza",
      "fisioterapia deportiva Zaragoza",
      "EPI Zaragoza",
      "electrolisis percutanea",
      "fisioterapia invasiva",
      "punción seca Zaragoza",
      "ecografía musculoesquelética",
      "rehabilitación deportiva",
      "terapia manual",
      "ejercicio terapéutico",
      "tendinopatía",
      "lesiones musculares",
      "dolor muscular",
      "centro autorizado EPI",
    ],
    authors: [{ name: "The Rehab Studio" }],
    creator: "The Rehab Studio",
    publisher: "The Rehab Studio",
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
    openGraph: {
      type: "website",
      locale: locale === "en" ? "en_US" : "es_ES",
      url: "https://therehabstudio.es",
      siteName: "The Rehab Studio",
      title: titles[locale] || titles.es,
      description: descriptions[locale] || descriptions.es,
      images: [
        {
          url: "/og-image.jpg",
          width: 1200,
          height: 630,
          alt: "The Rehab Studio - Fisioterapia en Zaragoza",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: titles[locale] || titles.es,
      description: descriptions[locale] || descriptions.es,
      images: ["/og-image.jpg"],
    },
    alternates: {
      canonical: "https://therehabstudio.es",
      languages: {
        es: "https://therehabstudio.es",
        en: "https://therehabstudio.es/en",
      },
    },
    category: "health",
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!routing.locales.includes(locale as "es" | "en")) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${pinyonScript.variable} antialiased bg-neutral-950 text-neutral-50`}
      >
        <NextIntlClientProvider messages={messages}>
          <UltrasoundBackground />
          <LocalBusinessJsonLd />
          <WebsiteJsonLd />
          <BreadcrumbJsonLd />
          {children}
          <Analytics />
          <SpeedInsights />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
