import type { Metadata } from "next";
import { Geist_Mono, Lexend } from "next/font/google";

import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const themeScript = `
(() => {
  const storageKey = "ag-theme";
  const root = document.documentElement;
  const storedTheme = localStorage.getItem(storageKey);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = storedTheme === "light" || storedTheme === "dark"
    ? storedTheme
    : prefersDark
      ? "dark"
      : "light";

  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
})();
`;

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteIconVersion = "20260417";
const shouldLoadAdobeFontStylesheet = process.env.UI_SMOKE_ENABLED !== "1";

export const metadata: Metadata = {
  title: "Accelerate Global",
  description: "Access shared people group datasets for Accelerate Global.",
  manifest: "/manifest.webmanifest",
  icons: {
    shortcut: [{ url: `/ag-site-favicon.ico?v=${siteIconVersion}` }],
    icon: [
      {
        url: `/ag-site-icon-32.png?v=${siteIconVersion}`,
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: `/ag-site-icon-192.png?v=${siteIconVersion}`,
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: `/ag-site-icon-512.png?v=${siteIconVersion}`,
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: `/ag-apple-touch-icon.png?v=${siteIconVersion}`,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${lexend.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {shouldLoadAdobeFontStylesheet ? (
          <link rel="stylesheet" href="https://use.typekit.net/nyp5ner.css" />
        ) : null}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
