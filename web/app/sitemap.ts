import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, products } from "@/lib/content";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";

export default function sitemap(): MetadataRoute.Sitemap {
  return [...PUBLIC_ROUTES, ...products.map((p) => `/products/${p.slug}`)].map((path) => ({ url: `${base}${path}` }));
}
