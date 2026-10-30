import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireEmployee } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { products } from "@/lib/content";
import { EmptyState, Section } from "@/components/portal/primitives";
import { Panel, PortalBand, Tile } from "@/components/portal/portal";
import { SimulatedBanner } from "@/components/portal/simulated-banner";

export const metadata: Metadata = { title: "Playground" };

type Run = { id: string; scenario_key: string; mode: string; created_at: string; output: { headline: string }; feedback: unknown; offerings: { name: string; slug: string } };

async function Playground() {
  await requireEmployee();
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database
    .from("playground_runs")
    .select("id, scenario_key, mode, created_at, output, feedback, offerings(name, slug)")
    .order("created_at", { ascending: false })
    .limit(10);
  const runs = (data ?? []) as unknown as Run[];

  return (
    <>
      <PortalBand eyebrow="Employee Playground" title={<>Explore. Experiment. <em className="text-green not-italic">Evolve.</em></>} lead="A guided space to explore product workflows on synthetic scenarios. Pick an offering, inspect the inputs, run it, review the evidence and tell us what you think." />
      <Section className="py-12">
        <div className="grid gap-8">
          <SimulatedBanner />
          <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-sm:grid-cols-1">
            {products.map((p) => (
              <Tile key={p.slug} title={p.name} body={p.summary} href={`/e/playground/${p.slug}`} />
            ))}
          </div>
          <Panel title="Your recent runs">
            {runs.length ? (
              <ul className="grid gap-2">
                {runs.map((r) => (
                  <li key={r.id}>
                    <Link href={`/e/playground/${r.offerings.slug}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-light px-4 py-3 text-sm hover:bg-green-050">
                      <span className="min-w-0">
                        <span className="font-bold">{r.offerings.name}</span>
                        <span className="text-slate"> · {r.output.headline}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-slate">
                        <span className="rounded-full bg-white px-2 py-0.5 font-bold">{r.mode === "ai_assisted" ? "AI-assisted" : "Deterministic"}</span>
                        {r.feedback ? <span className="font-bold text-green-700">Feedback given</span> : null}
                        {new Date(r.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No runs yet" body="Choose an offering above to run your first simulated scenario." />
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
      <Playground />
    </Suspense>
  );
}
