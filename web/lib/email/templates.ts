// Plain, branded transactional emails. Titles and links only: private content never leaves the portal.
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type P = Record<string, unknown>;
type Tpl = { subject: (p: P) => string; lead: (p: P) => string; path: (p: P) => string; cta: string };

const STATUS: Record<string, string> = {
  proposed: "Proposed", under_review: "Under review", planned: "Planned",
  in_progress: "In progress", released: "Released", not_proceeding: "Not proceeding",
};

export const TEMPLATES: Record<string, Tpl> = {
  "contribution.return": {
    subject: () => "A moderator asked for changes to your observation",
    lead: (p) => `A moderator reviewed <strong>${esc(p.title)}</strong> and asked for a clarification before it can be shared.`,
    path: () => "/account", cta: "Open the portal",
  },
  "contribution.reject": {
    subject: () => "Your observation wasn't accepted for the community",
    lead: (p) => `<strong>${esc(p.title)}</strong> wasn't accepted for the shared community. The moderator's reason is in the portal.`,
    path: () => "/account", cta: "See the reason",
  },
  "contribution.publish": {
    subject: () => "Your observation is now shared with the community",
    lead: (p) => `A de-identified version of <strong>${esc(p.title)}</strong> is now in the shared learning feed.`,
    path: () => "/learning", cta: "View the feed",
  },
  "idea.update": {
    subject: (p) => `Update on an idea you contributed to: ${STATUS[String(p.status)] ?? "updated"}`,
    lead: (p) => `<strong>${esc(p.title)}</strong> is now <strong>${esc(STATUS[String(p.status)] ?? p.status)}</strong>.${p.public_update ? ` ${esc(p.public_update)}` : ""} A status isn't a delivery commitment.`,
    path: () => "/learning/ideas", cta: "See improvement ideas",
  },
  "report.decided": {
    subject: () => "Your report has been reviewed",
    lead: () => "A moderator has reviewed the shared contribution you reported and recorded a decision.",
    path: () => "/learning", cta: "Open the portal",
  },
  invite: {
    subject: (p) => `You're invited to ${esc(p.org)} on azentio.ai`,
    lead: (p) => `You've been invited to join <strong>${esc(p.org)}</strong>'s workspace. The link works once, only for this email address, and expires in 7 days.`,
    path: (p) => String(p.path ?? "/login"), cta: "Accept invitation",
  },
};

export function render(template: string, payload: P, base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100") {
  const t = TEMPLATES[template];
  if (!t) throw new Error(`unknown email template ${template}`);
  const href = new URL(t.path(payload), base).toString();
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7f9;font-family:Arial,sans-serif;color:#102031">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:10px;overflow:hidden">
<tr><td style="background:#171b3a;padding:20px 28px;font-size:22px;font-weight:800;color:#fff"><span style="color:#69D393">a</span>zent<span style="color:#69D393">i</span>o<span style="color:#69D393">.ai</span></td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.65">${t.lead(payload)}
<p style="margin:24px 0 0"><a href="${esc(href)}" style="display:inline-block;background:#69D393;color:#171b3a;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:5px">${esc(t.cta)}</a></p></td></tr>
<tr><td style="padding:0 28px 24px;font-size:12px;color:#607080">You're receiving this because of activity on your azentio.ai account. Details stay in the portal.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: t.subject(payload), html };
}
