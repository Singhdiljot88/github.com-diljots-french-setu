import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SwRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  title: { default: "French Setu — 120 Days to TEF", template: "%s · French Setu" },
  description: "A structured 120-day French course for English- and Hindi-speaking beginners preparing for TEF Canada.",
  applicationName: "French Setu",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "French Setu", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#1f726b" }, { media: "(prefers-color-scheme: dark)", color: "#121615" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <a href="#main" className="skip-link">Skip to main content</a>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
