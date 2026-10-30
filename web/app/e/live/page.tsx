import type { Metadata } from "next";
import { Suspense } from "react";
import { Radio } from "lucide-react";
import { requireEmployee } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { EmptyState, Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { Player } from "@/components/portal/player";

export const metadata: Metadata = { title: "Internal Live" };

type Session = { id: string; title: string; audience: string; embed_url: string | null; is_live: boolean; starts_at: string | null };
type Media = { id: string; title: string; summary: string | null; audience: string; embed_url: string | null; storage_key: string | null };

const AUDIENCE: Record<string, string> = { employee: "Employees only", public: "Public", client_entitled: "Entitled clients" };

async function Live() {
  await requireEmployee();
  const insforge = await createInsForgeServerClient();
  // RLS returns exactly what an employee may see (public, employee, client_entitled; never org_private).
  const [{ data: s }, { data: m }] = await Promise.all([
    insforge.database.from("live_sessions").select("id, title, audience, embed_url, is_live, starts_at").order("starts_at", { ascending: false }),
    insforge.database.from("media").select("id, title, summary, audience, embed_url, storage_key").eq("published", true).order("created_at", { ascending: false }),
  ]);
  const sessions = (s ?? []) as Session[];
  const media = (m ?? []) as Media[];
  const live = sessions.find((x) => x.is_live);
  const upcoming = sessions.filter((x) => !x.is_live);

  return (
    <>
      <PortalBand eyebrow="Internal Live" title="Where intelligence comes alive, inside Azentio." lead="Employee broadcasts, product demonstrations and recordings. Only publishers can configure what appears here." />
      <Section className="py-12">
        <div className="grid gap-8">
          <Panel title={live ? live.title : "Live now"} action={live && <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">● LIVE · {AUDIENCE[live.audience]}</span>}>
            {live ? (
              <Player title={live.title} embedUrl={live.embed_url} />
            ) : (
              <div className="on-dark grid aspect-video place-items-center rounded-[10px] bg-[radial-gradient(circle,#1d4d52,#171b3a_65%)] text-center text-white">
                <div>
                  <Radio className="mx-auto size-10 text-green" aria-hidden />
                  <p className="mt-3 text-lg font-bold">Nothing live right now.</p>
                </div>
              </div>
            )}
          </Panel>
          {upcoming.length > 0 && (
            <Panel title="Scheduled sessions">
              <ul className="grid grid-cols-1 gap-2">
                {upcoming.map((x) => (
                  <li key={x.id} className="flex items-center justify-between rounded-lg bg-light px-4 py-3 text-sm">
                    <span className="font-bold">{x.title}</span>
                    <span className="text-xs text-slate">{AUDIENCE[x.audience]}{x.starts_at ? ` · ${new Date(x.starts_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : ""}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Recordings">
            {media.length ? (
              <ul className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
                {media.map((x) => (
                  <li key={x.id} className="grid gap-3">
                    <Player title={x.title} embedUrl={x.embed_url} mediaId={x.storage_key ? x.id : undefined} />
                    <div>
                      <p className="font-bold">{x.title}</p>
                      <p className="text-xs text-slate">{AUDIENCE[x.audience]}{x.summary ? ` · ${x.summary}` : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No recordings yet" body="Published recordings appear here for the audiences they're shared with." />
            )}
          </Panel>
        </div>
      </Section>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Live />
    </Suspense>
  );
}
