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
        {children}
      </body>
    </html>
  );
}
