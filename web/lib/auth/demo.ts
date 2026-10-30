// One-click demo personas for the login page (admin roles only). Public metadata lives here;
// passwords never leave the server (read from env inside the server action).
export type DemoPersona = { alias: string; label: string; role: string; org: string };

export const DEMO_PERSONAS: DemoPersona[] = [
  { alias: "admin", label: "Portal admin", role: "Orgs, roles, audit, configuration", org: "Azentio" },
  { alias: "moderator", label: "Learning moderator", role: "Review, redact and publish contributions", org: "Azentio" },
  { alias: "publisher", label: "Content publisher", role: "Banners, public content, live sessions", org: "Azentio" },
  { alias: "po", label: "Product owner", role: "Themes, improvement ideas, status", org: "Azentio" },
  { alias: "acme-admin", label: "Client admin", role: "Members and invitations", org: "Acme Bank" },
  { alias: "borealis-admin", label: "Client admin", role: "Members and invitations", org: "Borealis Finance" },
];

export const demoLoginEnabled = () => process.env.DEMO_LOGIN_ENABLED === "true";

export const demoEmail = (alias: string) =>
  (process.env.DEMO_INBOX ?? "hitliprateek5@gmail.com").replace("@", `+${alias}@`).toLowerCase();

export const demoPassword = (alias: string) =>
  process.env[`DEMO_PASSWORD_${alias.replace(/-/g, "_").toUpperCase()}`];
