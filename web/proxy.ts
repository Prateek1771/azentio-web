import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@insforge/sdk/ssr/middleware";
import { products } from "@/lib/content";

const SLUGS = new Set(products.map((p) => p.slug));
// Catalogue routes with a closed set of slugs. Cache Components streams the shell before
// notFound() can run, so unknown slugs get their real 404 status here instead.
const CATALOGUE = /^\/(?:products|e\/playground)\/([^/]+)\/?$/;

export async function proxy(request: NextRequest) {
  const slug = request.nextUrl.pathname.match(CATALOGUE)?.[1];
  if (slug && !SLUGS.has(slug)) {
    return NextResponse.rewrite(new URL("/__not-found", request.url), { status: 404 });
  }

  // Refresh the InsForge session cookies before Server Components render.
  const response = NextResponse.next({ request });
  await updateSession({ requestCookies: request.cookies, responseCookies: response.cookies });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|banners/|products/.*\\.svg|navigation/).*)"],
};
