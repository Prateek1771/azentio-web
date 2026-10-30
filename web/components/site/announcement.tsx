import Link from "next/link";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { Dismiss } from "./announcement-dismiss";

// Latest published public banner (publisher-managed). RLS hides drafts from visitors.
// `slug` holds the banner's optional internal link path.
export async function Announcement() {
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database
    .from("content")
    .select("id, title, body, slug")
    .eq("kind", "banner")
    .eq("published", true)
    .order("updated_at", { ascending: false })
    .limit(1);
  const b = (data as { id: string; title: string; body: string; slug: string | null }[] | null)?.[0];
  if (!b) return null;
  return (
    <Dismiss id={b.id}>
      <p className="text-sm">
        <strong>{b.title}</strong>
        {b.body && <span className="text-on-green/80"> · {b.body}</span>}
        {b.slug && (
          <Link href={b.slug} className="ml-2 font-bold underline underline-offset-2">
            Learn more
          </Link>
        )}
      </p>
    </Dismiss>
  );
}
