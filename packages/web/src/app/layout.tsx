import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerRegister } from "./service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ORBIT Marketing OS",
    template: "%s • ORBIT Marketing OS",
  },
  description: "منصة تشغيل تسويق Local-First بملكية محلية للبيانات الحساسة.",
  manifest: "/manifest.json",
  applicationName: "ORBIT Marketing OS",
  keywords: [
    "marketing operations",
    "CRM",
    "campaigns",
    "local-first",
    "Ollama",
  ],
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <ServiceWorkerRegister />
        {/*
          WCAG 2.4.1 (Bypass Blocks): keyboard and screen-reader users must be
          able to jump past repeated navigation. Visually hidden until focused,
          then pinned to the top edge in the reading direction of the document.
        */}
        <a className="skip-link" href="#main-content">
          تخطَّ إلى المحتوى الرئيسي
        </a>
        {children}
      </body>
    </html>
  );
}
