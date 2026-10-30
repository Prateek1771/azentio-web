export type Shared = {
  id: string;
  title: string;
  body: string;
  type: string;
  offering_id: string | null;
  industry: string | null;
  region: string | null;
  period_start: string | null;
  period_end: string | null;
  attributed_org_name: string | null;
  published_at: string;
};

export const SHARED_COLS = "id, title, body, type, offering_id, industry, region, period_start, period_end, attributed_org_name, published_at";

export type ThemeStat = { theme_id: string; evidence_count: number; org_count: number | null; small_sample: boolean; period_start: string | null; period_end: string | null };

// Plain language for clients: a status, never a promise.
export const IDEA_STATUS: Record<string, { label: string; plain: string; cls: string }> = {
  proposed: { label: "Proposed", plain: "Logged for consideration.", cls: "bg-light text-slate" },
  under_review: { label: "Under review", plain: "The product team is assessing it. This is not a delivery commitment.", cls: "bg-amber-50 text-amber-800" },
  planned: { label: "Planned", plain: "Accepted into planning. Timing isn't confirmed.", cls: "bg-green-050 text-green-700" },
  in_progress: { label: "In progress", plain: "Being worked on now.", cls: "bg-green-050 text-green-700" },
  released: { label: "Released", plain: "Available in the product.", cls: "bg-green text-on-green" },
  not_proceeding: { label: "Not proceeding", plain: "Considered and not taken forward.", cls: "bg-light text-slate" },
};

export const orgCountLabel = (s?: ThemeStat) =>
  !s || s.org_count === null ? "Small sample: fewer than 3 organisations" : `${s.org_count} organisations`;

export const period = (a: string | null, b: string | null) => (a ? `${a.slice(0, 7)} → ${b ? b.slice(0, 7) : "ongoing"}` : "Period not stated");
