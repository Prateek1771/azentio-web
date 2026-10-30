// Deterministic, pure demonstration engines over synthetic data. Same input → same output.
// Every result is a simulation and is labelled as such; nothing here is an approved decision.

export type Evidence = { label: string; value: string; status: "pass" | "warn" | "fail" | "info"; note?: string };
export type EngineOutput = {
  headline: string; // always ends with "(simulated)" for decision-like outputs
  tone: "positive" | "caution" | "negative" | "neutral";
  evidence: Evidence[];
  metrics?: { label: string; value: string }[];
  stepsCompleted: number;
  draft?: string;
};
type Inputs = Record<string, number | string>;

const n = (v: number | string | undefined) => Number(v ?? 0);
const fmt = (v: number, d = 2) => v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const pct = (v: number, d = 1) => `${fmt(v * 100, d)}%`;

// Seeded PRNG so synthetic portfolios are identical on every run.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smeDecision(i: Inputs): EngineOutput {
  const rules: Evidence[] = [
    { label: "Debt service coverage ≥ 1.25×", value: `${fmt(n(i.dscr))}×`, status: n(i.dscr) >= 1.25 ? "pass" : n(i.dscr) >= 1.1 ? "warn" : "fail" },
    { label: "Debt to equity ≤ 2.5×", value: `${fmt(n(i.debt_to_equity))}×`, status: n(i.debt_to_equity) <= 2.5 ? "pass" : n(i.debt_to_equity) <= 3.5 ? "warn" : "fail" },
    { label: "Trading history ≥ 24 months", value: `${n(i.months_trading)} months`, status: n(i.months_trading) >= 24 ? "pass" : "fail" },
    { label: "Revenue growth not negative", value: `${fmt(n(i.revenue_growth), 0)}%`, status: n(i.revenue_growth) >= 0 ? "pass" : "warn" },
    { label: "Collateral cover ≥ 80%", value: `${fmt(n(i.collateral_cover), 0)}%`, status: n(i.collateral_cover) >= 80 ? "pass" : "warn" },
  ];
  const fails = rules.filter((r) => r.status === "fail").length;
  const warns = rules.filter((r) => r.status === "warn").length;
  const [headline, tone] =
    fails >= 2 ? (["Decline recommended (simulated)", "negative"] as const)
    : fails === 1 || warns >= 2 ? (["Refer to a credit officer (simulated)", "caution"] as const)
    : (["Approve recommended (simulated)", "positive"] as const);
  return { headline, tone, evidence: rules, stepsCompleted: 4, metrics: [{ label: "Rules passed", value: `${rules.length - fails - warns} of ${rules.length}` }] };
}

// 200 synthetic applications: score ~ N(640, 60); PD falls with score.
function syntheticPortfolio() {
  const r = mulberry32(42);
  return Array.from({ length: 200 }, () => {
    const z = Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
    const score = Math.round(640 + 60 * z);
    return { score, pd: 1 / (1 + Math.exp((score - 560) / 40)), exposure: 50_000 + Math.round(r() * 250_000) };
  });
}

function creditStrategy(i: Inputs): EngineOutput {
  const book = syntheticPortfolio();
  const lgd = n(i.lgd) / 100;
  const stats = (cut: number) => {
    const ok = book.filter((a) => a.score >= cut);
    const el = ok.reduce((s, a) => s + a.pd * lgd * a.exposure, 0);
    const exp = ok.reduce((s, a) => s + a.exposure, 0);
    return { rate: ok.length / book.length, avgPd: ok.reduce((s, a) => s + a.pd, 0) / (ok.length || 1), elRate: exp ? el / exp : 0, count: ok.length };
  };
  const base = stats(n(i.baseline_cutoff));
  const next = stats(n(i.cutoff));
  const dRate = next.rate - base.rate;
  const dEl = next.elRate - base.elRate;
  return {
    headline: `${dRate >= 0 ? "+" : ""}${fmt(dRate * 100, 1)} pts approvals, ${dEl >= 0 ? "+" : ""}${fmt(dEl * 100, 2)} pts expected loss (simulated)`,
    tone: dEl > 0.002 ? "caution" : "neutral",
    stepsCompleted: 5,
    metrics: [
      { label: "Approval rate", value: `${pct(base.rate)} → ${pct(next.rate)}` },
      { label: "Approved applications", value: `${base.count} → ${next.count}` },
      { label: "Average PD of approved", value: `${pct(base.avgPd, 2)} → ${pct(next.avgPd, 2)}` },
      { label: "Expected loss rate", value: `${pct(base.elRate, 2)} → ${pct(next.elRate, 2)}` },
    ],
    evidence: [
      { label: "Portfolio", value: "200 synthetic applications (seeded)", status: "info" },
      { label: "Cut-off change", value: `${n(i.baseline_cutoff)} → ${n(i.cutoff)}`, status: "info" },
      { label: "Risk direction", value: dEl > 0 ? "Riskier book" : "Safer book", status: dEl > 0.002 ? "warn" : "pass" },
    ],
  };
}

function similarPortfolio(i: Inputs): EngineOutput {
  const r = mulberry32(7);
  const hist = Array.from({ length: 120 }, () => {
    const rev = 0.3 + r() * 12, yrs = Math.round(r() * 25), lev = r() * 5, margin = -5 + r() * 25;
    const risk = lev / 5 + (margin < 3 ? 0.3 : 0) + (yrs < 3 ? 0.3 : 0) + r() * 0.4;
    return { rev, yrs, lev, margin, outcome: risk > 1.1 ? "Defaulted" : risk > 0.8 ? "Late payments" : "Repaid" };
  });
  const q = { rev: n(i.revenue_m), yrs: n(i.years), lev: n(i.leverage), margin: n(i.margin) };
  const dist = (h: typeof q) => Math.hypot((h.rev - q.rev) / 12, (h.yrs - q.yrs) / 25, (h.lev - q.lev) / 5, (h.margin - q.margin) / 25);
  const cohort = hist.map((h) => ({ ...h, d: dist(h) })).sort((a, b) => a.d - b.d).slice(0, 10);
  const count = (o: string) => cohort.filter((c) => c.outcome === o).length;
  const bad = count("Defaulted");
  return {
    headline: `${count("Repaid")} of 10 comparables repaid (simulated context)`,
    tone: bad >= 3 ? "caution" : "neutral",
    stepsCompleted: 4,
    metrics: [
      { label: "Repaid", value: String(count("Repaid")) },
      { label: "Late payments", value: String(count("Late payments")) },
      { label: "Defaulted", value: String(bad) },
    ],
    evidence: cohort.slice(0, 5).map((c, k) => ({
      label: `Comparable #${k + 1}`,
      value: `${fmt(c.rev, 1)}m revenue · ${c.yrs} yrs · ${fmt(c.lev, 1)}× D/E`,
      status: c.outcome === "Repaid" ? "pass" : c.outcome === "Defaulted" ? "fail" : "warn",
      note: c.outcome,
    })),
  };
}

const RULES = ["min_months_trading", "min_dscr", "max_leverage", "bureau_score"] as const;
const RULE_LABEL: Record<string, string> = { min_months_trading: "Minimum months trading", min_dscr: "Minimum DSCR", max_leverage: "Maximum leverage", bureau_score: "Bureau score" };

function rejection(i: Inputs): EngineOutput {
  const r = mulberry32(99);
  const declines = Array.from({ length: 300 }, () => RULES.filter(() => r() < 0.38));
  declines.forEach((d) => d.length || d.push(RULES[Math.floor(r() * 4)]));
  const counts = RULES.map((rule) => ({ rule, n: declines.filter((d) => d.includes(rule)).length }));
  const relax = String(i.relax);
  const onlyThis = declines.filter((d) => d.length === 1 && d[0] === relax).length;
  return {
    headline: `${onlyThis} declines failed only on "${RULE_LABEL[relax] ?? relax}" (simulated)`,
    tone: "neutral",
    stepsCompleted: 4,
    metrics: [{ label: "Potentially eligible if relaxed", value: `${onlyThis} of 300 (${pct(onlyThis / 300)})` }],
    evidence: counts.map((c) => ({ label: RULE_LABEL[c.rule], value: `${c.n} declines`, status: c.rule === relax ? "warn" : "info" })),
  };
}

function financialAnalysis(i: Inputs): EngineOutput {
  const growth = n(i.revenue) / n(i.revenue_prev) - 1;
  const margin = n(i.net_income) / n(i.revenue);
  const current = n(i.current_assets) / n(i.current_liabilities);
  const de = n(i.total_debt) / n(i.equity);
  const icr = n(i.ebit) / n(i.interest);
  const evidence: Evidence[] = [
    { label: "Revenue growth", value: pct(growth), status: growth >= 0 ? "pass" : "warn" },
    { label: "Net margin", value: pct(margin), status: margin >= 0.05 ? "pass" : margin >= 0 ? "warn" : "fail" },
    { label: "Current ratio", value: `${fmt(current)}×`, status: current >= 1.2 ? "pass" : current >= 1 ? "warn" : "fail", note: current < 1 ? "Short-term obligations exceed current assets" : undefined },
    { label: "Debt to equity", value: `${fmt(de)}×`, status: de <= 2 ? "pass" : de <= 3.5 ? "warn" : "fail" },
    { label: "Interest coverage", value: `${fmt(icr)}×`, status: icr >= 3 ? "pass" : icr >= 1.5 ? "warn" : "fail" },
  ];
  const fails = evidence.filter((e) => e.status === "fail").length;
  return {
    headline: fails ? `${fails} ratio${fails > 1 ? "s" : ""} need attention (simulated analysis)` : "Ratios within typical ranges (simulated analysis)",
    tone: fails ? "caution" : "positive",
    stepsCompleted: 4,
    evidence,
  };
}

const RIVA_SPEC: Record<string, RegExp> = {
  loan_id: /^LN-\d{6}$/,
  reporting_date: /^\d{4}-\d{2}-\d{2}$/,
  outstanding: /^\d+(\.\d{2})?$/,
  currency: /^[A-Z]{3}$/,
  sector_code: /^[A-Z]\d{2}(\.\d)?$/,
  maturity_date: /^\d{4}-\d{2}-\d{2}$/,
};

function riva(i: Inputs): EngineOutput {
  const evidence: Evidence[] = Object.entries(RIVA_SPEC).map(([k, re]) => {
    const v = String(i[k] ?? "");
    if (!v) return { label: k, value: "missing", status: "fail", note: "Required field is not mapped" };
    return re.test(v) ? { label: k, value: v, status: "pass" } : { label: k, value: v, status: "fail", note: "Value does not match the template format" };
  });
  const bad = evidence.filter((e) => e.status === "fail").length;
  return {
    headline: bad ? `${bad} validation issue${bad > 1 ? "s" : ""} block report generation (simulated)` : "Mapping valid. Report ready to generate (simulated)",
    tone: bad ? "negative" : "positive",
    stepsCompleted: bad ? 4 : 5,
    evidence,
  };
}

function documentIntelligence(i: Inputs): EngineOutput {
  const doc = String(i.document ?? "");
  const grab = (re: RegExp) => doc.match(re)?.[1]?.trim() ?? "";
  const num = (s: string) => Number(s.replace(/,/g, ""));
  const f = {
    type: /^INVOICE/m.test(doc) ? "Invoice" : "Unknown",
    number: grab(/Invoice No:\s*(.+)/),
    date: grab(/Date:\s*(\d{4}-\d{2}-\d{2})/),
    supplier: grab(/Supplier:\s*(.+)/),
    subtotal: grab(/Subtotal:\s*([\d,.]+)/),
    tax: grab(/Tax[^:]*:\s*([\d,.]+)/),
    total: grab(/Total due:\s*([\d,.]+)/),
  };
  const reconciles = Math.abs(num(f.subtotal) + num(f.tax) - num(f.total)) < 0.005;
  return {
    headline: reconciles ? "Extracted and validated (simulated)" : "Totals do not reconcile: flagged for review (simulated)",
    tone: reconciles ? "positive" : "negative",
    stepsCompleted: 5,
    evidence: [
      { label: "Document class", value: f.type, status: f.type === "Invoice" ? "pass" : "warn" },
      { label: "Invoice number", value: f.number || "not found", status: f.number ? "pass" : "fail" },
      { label: "Invoice date", value: f.date || "not found", status: f.date ? "pass" : "fail" },
      { label: "Supplier", value: f.supplier || "not found", status: f.supplier ? "pass" : "fail" },
      { label: "Subtotal + tax = total", value: `${f.subtotal} + ${f.tax} vs ${f.total}`, status: reconciles ? "pass" : "fail" },
    ],
  };
}

const NEWS = [
  { title: "Central bank holds rates; signals data-dependent path", tags: ["CFO", "CRO"] },
  { title: "SME credit demand rises for third consecutive quarter", tags: ["CFO", "CRO"] },
  { title: "Regulator consults on model risk management for AI", tags: ["CRO", "CTO"] },
  { title: "Cloud costs climb as AI workloads scale", tags: ["CTO", "CFO"] },
  { title: "Seasonal cash-flow stress hits hospitality borrowers", tags: ["CRO"] },
  { title: "Open banking APIs reach new adoption milestone", tags: ["CTO"] },
  { title: "Working-capital cycles lengthen across wholesale", tags: ["CFO"] },
  { title: "Explainability expectations tighten for credit models", tags: ["CRO", "CTO"] },
];

function personaNewsroom(i: Inputs): EngineOutput {
  const persona = String(i.persona);
  const ranked = NEWS.map((s) => ({ ...s, score: (s.tags[0] === persona ? 2 : 0) + (s.tags.includes(persona) ? 1 : 0) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return {
    headline: `${ranked.length} stories matched to the ${persona} persona (synthetic feed)`,
    tone: "neutral",
    stepsCompleted: 2,
    evidence: ranked.slice(0, 5).map((s, k) => ({ label: `#${k + 1}`, value: s.title, status: "info" as const })),
  };
}

export const engines: Record<string, (i: Inputs) => EngineOutput> = {
  "sme-credit-decisioning": smeDecision,
  "credit-strategy-simulator": creditStrategy,
  "similar-portfolio-intelligence": similarPortfolio,
  "rejection-intelligence": rejection,
  "financial-analysis": financialAnalysis,
  riva,
  "document-intelligence": documentIntelligence,
  "persona-newsroom": personaNewsroom,
};
