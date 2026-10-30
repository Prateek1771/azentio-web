import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";

// Portal areas are private and server-gated; keep them out of indexes too.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/e", "/c", "/s", "/account", "/invite", "/workspace", "/onboarding", "/api"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
