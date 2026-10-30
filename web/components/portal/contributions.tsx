import Link from "next/link";
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
