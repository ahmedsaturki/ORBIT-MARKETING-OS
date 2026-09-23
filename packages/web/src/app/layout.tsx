import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerRegister } from "./service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "ORBIT Marketing OS",
  description: "Local-first marketing operations platform.",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
