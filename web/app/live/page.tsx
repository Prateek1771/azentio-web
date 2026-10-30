import type { Metadata } from "next";
import { Suspense } from "react";
import { Radio } from "lucide-react";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { EmptyState, PageHero, Section } from "@/components/portal/primitives";

export const metadata: Metadata = {
  title: "Live Streaming",
  description: "Join live conversations, experience product demonstrations, and watch past sessions.",
};

type Live = { id: string; title: string; embed_url: string | null; starts_at: string | null; is_live: boolean };

// Visitors only ever receive audience=public sessions (RLS). Employee-only broadcasts live in /e (Phase 4).
async function Sessions() {
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database
    .from("live_sessions")
    .select("id, title, embed_url, starts_at, is_live")
    .eq("audience", "public")
    .order("starts_at", { ascending: false });
  const sessions = (data ?? []) as Live[];
  const live = sessions.find((s) => s.is_live && s.embed_url);

  return (
    <div className="grid gap-10">
      <section aria-labelledby="live-zone">
        <p className="eyebrow">Live zone</p>
        <h2 id="live-zone" className="mt-2 mb-5 text-[28px] font-bold tracking-[-1px]">azentio.ai Live</h2>
        {live ? (
          <iframe src={live.embed_url!} title={live.title} className="aspect-video w-full rounded-[10px] bg-navy-900" allow="encrypted-media; picture-in-picture" allowFullScreen />
        ) : (
          <div className="on-dark grid aspect-video place-items-center rounded-[10px] bg-[radial-gradient(circle,#1d4d52,#171b3a_65%)] text-center text-white">
            <div>
              <Radio className="mx-auto size-10 text-green" aria-hidden />
              <p className="mt-4 text-xl font-bold">Nothing live right now.</p>
              <p className="mt-1 text-sm text-on-dark-muted">The next public session will appear here.</p>
            </div>
          </div>
        )}
      </section>
      <section aria-labelledby="on-demand">
        <p className="eyebrow">On demand</p>
        <h2 id="on-demand" className="mt-2 mb-5 text-[28px] font-bold tracking-[-1px]">Past recordings</h2>
        {sessions.filter((s) => !s.is_live).length ? (
          <ul className="grid grid-cols-3 gap-5 max-md:grid-cols-1">
            {sessions.filter((s) => !s.is_live).map((s) => (
              <li key={s.id} className="rounded-[10px] border border-line p-5 font-bold">{s.title}</li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No public recordings yet" body="Recordings of public sessions are published here after they air." />
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHero eyebrow="azentio.ai Live" title="Where Intelligence Comes Alive." lead="Join live conversations, experience product demonstrations, and watch past sessions." />
      <Section>
        <Suspense fallback={<p className="text-slate">Loading stream…</p>}>
          <Sessions />
        </Suspense>
      </Section>
    </>
  );
}
