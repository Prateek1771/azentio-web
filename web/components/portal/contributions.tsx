import Link from "next/link";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { type Contribution, STATE, TYPES, VISIBILITY } from "@/lib/contributions/model";
import { cn } from "@/lib/utils";

export function StateBadge({ state }: { state: Contribution["state"] }) {
  const s = STATE[state];
  return <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap", s.cls)}>{s.label}</span>;
}

const date = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function ContributionList({ rows, base }: { rows: Pick<Contribution, "id" | "title" | "type" | "state" | "visibility_choice" | "version" | "updated_at">[]; base: string }) {
  return (
    <ul className="grid grid-cols-1 gap-3">
      {rows.map((c) => (
        <li key={c.id}>
          <Link href={`${base}/${c.id}`} className="lift flex items-center justify-between gap-4 rounded-[10px] border border-line bg-white px-5 py-4 max-sm:flex-col max-sm:items-start">
            <span className="min-w-0 max-w-full">
              <span className="block truncate font-bold">{c.title}</span>
              <span className="mt-1 block text-xs text-slate">
                {TYPES[c.type as keyof typeof TYPES]} · {VISIBILITY[c.visibility_choice].label} · v{c.version} · {date(c.updated_at)}
              </span>
            </span>
            <StateBadge state={c.state} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Quality feedback totals: only the contributor and moderators ever see them (no public scores, no leaderboards).
export async function FeedbackTally({ contribution }: { contribution: string }) {
  const { data } = await (await createInsForgeServerClient()).database.rpc("feedback_counts", { p_contribution: contribution });
  const t = ((data ?? []) as { useful: number; needs_evidence: number }[])[0] ?? { useful: 0, needs_evidence: 0 };
  return (
    <section aria-label="Reader feedback" className="rounded-[10px] border border-line bg-white p-6 text-sm">
      <h2 className="text-[17px] font-bold">Reader feedback</h2>
      <p className="mt-2"><strong>{t.useful}</strong> found it useful · <strong>{t.needs_evidence}</strong> asked for more evidence</p>
      <p className="mt-1 text-xs text-slate">Only you and moderators see these totals.</p>
    </section>
  );
}
