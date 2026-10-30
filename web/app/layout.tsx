import type { Metadata } from "next";
import { SiteHeader } from "@/components/portal/site-header";
import { SiteFooter } from "@/components/portal/site-footer";
import { AiraLauncher } from "@/components/portal/aira-launcher";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "azentio.ai | Build Intelligence. Create Impact.", template: "%s | azentio.ai" },
  description:
    "Discover applied AI products, intelligent decisioning, enterprise innovation, and product demonstrations at azentio.ai.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <AiraLauncher />
        <Toaster />
      </body>
    </html>
  );
}
