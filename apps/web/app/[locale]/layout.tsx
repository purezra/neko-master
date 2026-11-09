import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/lib/auth";
import { AuthGuard } from "@/components/features/auth/auth-guard";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { ServiceWorkerRegister } from "@/components/common";
import { Toaster } from "@/components/ui/sonner";
import { BRAND_ASSET_VERSION } from "@/lib/project-info";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("title"),
    description: t("description"),
    icons: {
      icon: `/logo.ico?v=${BRAND_ASSET_VERSION}`,
      shortcut: `/logo.ico?v=${BRAND_ASSET_VERSION}`,
      apple: `/icons/icon-192x192.png?v=${BRAND_ASSET_VERSION}`,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: t("applicationName"),
    },
    applicationName: t("applicationName"),
  };
}

export const viewport: Viewport = {
  // Defaults from globals.css: :root is the light theme, .dark is Catppuccin
  // Mocha. ThemeAttributeSync rewrites these once the user picks a palette.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fa" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1e2e" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};



export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href={`/icons/icon-192x192.png?v=${BRAND_ASSET_VERSION}`} />

        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        {/*
          Load runtime config (real external ports/URLs written by
          docker-start.sh) BEFORE the app bundle, so the WebSocket client reads
          window.__RUNTIME_CONFIG__.WS_PORT instead of racing and falling back
          to the build-time default. See issue #61.
        */}
        <Script src="/runtime-config.js" strategy="beforeInteractive" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            <AuthProvider>
              <NextIntlClientProvider messages={messages}>
                <AuthGuard />
                {children}
              </NextIntlClientProvider>
            </AuthProvider>
          </QueryProvider>
          <Toaster position="top-center" />
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
