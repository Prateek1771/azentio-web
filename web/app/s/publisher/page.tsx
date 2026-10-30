import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireGrant } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { products } from "@/lib/content";
import { cn } from "@/lib/utils";
import { EmptyState, Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { BannerForm, RecordingForm, StreamForm } from "./forms";
import { deleteSession, setBannerPublished, setLive, setRecordingPublished } from "./actions";

export const metadata: Metadata = { title: "Publisher workspace" };

const TABS = [
  { key: "stream", label: "Stream settings" },
  { key: "recordings", label: "Past recordings" },
  { key: "homepage", label: "Homepage" },
] as const;
const AUDIENCE: Record<string, string> = { employee: "Employees", public: "Public", client_entitled: "Entitled clients" };
const offerings = products.map((p) => ({ slug: p.slug, name: p.name }));
const rowBtn = "rounded-[5px] border border-line-strong px-3 py-1.5 text-xs font-bold hover:border-green-700";

async function Workspace({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireGrant("publish_media");
  const requested = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === requested)?.key ?? "stream";
  const db = (await createInsForgeServerClient()).database;
  const host = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").hostname;

  return (
    <>
      <PortalBand eyebrow="Publisher workspace" title="Your publishing workspace." lead="Manage the homepage, live video and past recordings in one place. Every change is audited." />
      <Section className="py-12">
        <nav aria-label="Publisher sections" className="mb-8 flex flex-wrap gap-3 border-b border-line-strong pb-3">
          {TABS.map((t) => (
            <Link key={t.key} href={`/s/publisher?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined} className={cn("rounded-lg border px-5 py-3 text-sm font-bold", tab === t.key ? "border-green bg-green text-on-green" : "border-line-strong bg-white hover:border-green-700")}>
              {t.label}
            </Link>
          ))}
        </nav>

        {tab === "stream" && (
          <div className="grid grid-cols-[1.1fr_1fr] gap-6 max-[1100px]:grid-cols-1">
            <Panel title="New stream or session"><StreamForm offerings={offerings} host={host} /></Panel>
            <Panel title="Sessions">
              <Sessions db={db} />
            </Panel>
          </div>
        )}
        {tab === "recordings" && (
          <div className="grid grid-cols-[1.1fr_1fr] gap-6 max-[1100px]:grid-cols-1">
            <Panel title="Add a recording"><RecordingForm offerings={offerings} /></Panel>
            <Panel title="Recordings"><Recordings db={db} /></Panel>
          </div>
        )}
        {tab === "homepage" && (
          <div className="grid grid-cols-[1.1fr_1fr] gap-6 max-[1100px]:grid-cols-1">
            <Panel title="Homepage announcement"><BannerForm /></Panel>
            <Panel title="Banners"><Banners db={db} /></Panel>
          </div>
        )}
      </Section>
    </>
  );
}

type Db = Awaited<ReturnType<typeof createInsForgeServerClient>>["database"];

async function Sessions({ db }: { db: Db }) {
  const { data } = await db.from("live_sessions").select("id, title, audience, is_live, embed_url").order("created_at", { ascending: false });
  const rows = (data ?? []) as { id: string; title: string; audience: string; is_live: boolean }[];
  if (!rows.length) return <EmptyState title="No sessions yet" body="Create one to show it on Live." />;
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-light px-4 py-3 text-sm">
          <span className="min-w-0">
            <span className="font-bold">{r.title}</span>
            <span className="block text-xs text-slate">{AUDIENCE[r.audience]}{r.is_live && " · LIVE NOW"}</span>
          </span>
          <span className="flex gap-2">
            <form action={setLive.bind(null, r.id, !r.is_live)}><button className={rowBtn}>{r.is_live ? "Take off Live" : "Show on Live"}</button></form>
            <form action={deleteSession.bind(null, r.id)}><button className={cn(rowBtn, "text-orange-700")}>Delete</button></form>
          </span>
        </li>
      ))}
    </ul>
  );
}

async function Recordings({ db }: { db: Db }) {
  const { data } = await db.from("media").select("id, title, audience, published, storage_key").order("created_at", { ascending: false });
  const rows = (data ?? []) as { id: string; title: string; audience: string; published: boolean; storage_key: string | null }[];
  if (!rows.length) return <EmptyState title="No recordings yet" body="Add a link or upload a file." />;
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-light px-4 py-3 text-sm">
          <span className="min-w-0">
            <span className="font-bold">{r.title}</span>
            <span className="block text-xs text-slate">{AUDIENCE[r.audience]} · {r.storage_key ? "Uploaded file" : "Embedded"} · {r.published ? "Published" : "Draft"}</span>
          </span>
          <form action={setRecordingPublished.bind(null, r.id, !r.published)}><button className={rowBtn}>{r.published ? "Unpublish" : "Publish"}</button></form>
        </li>
      ))}
    </ul>
  );
}

async function Banners({ db }: { db: Db }) {
  const { data } = await db.from("content").select("id, title, published").eq("kind", "banner").order("created_at", { ascending: false });
  const rows = (data ?? []) as { id: string; title: string; published: boolean }[];
  if (!rows.length) return <EmptyState title="No banners yet" body="A published banner appears as a strip at the top of the homepage." />;
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-light px-4 py-3 text-sm">
          <span className="min-w-0 font-bold">{r.title}<span className="block text-xs font-normal text-slate">{r.published ? "Live on homepage" : "Draft"}</span></span>
          <form action={setBannerPublished.bind(null, r.id, !r.published)}><button className={rowBtn}>{r.published ? "Unpublish" : "Publish"}</button></form>
        </li>
      ))}
    </ul>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Workspace searchParams={searchParams} />
    </Suspense>
  );
}
