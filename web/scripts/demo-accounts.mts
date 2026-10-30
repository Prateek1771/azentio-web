// Demo accounts for one-click demo login (admin roles) and the RLS test suite.
//   npm run demo:create            → sign up each persona with a random password (saved to .env.local);
//                                    InsForge emails a verification code to each plus-address.
//   npm run demo:verify alias code → verify one persona's email with the code from the inbox.
// Passwords live only in .env.local (git-ignored). Authority still comes from provisioning, never the password.
import crypto from "node:crypto";
import fs from "node:fs";

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const anon = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!;
const INBOX = process.env.DEMO_INBOX ?? "hitliprateek5@gmail.com";
const ENV_FILE = new URL("../.env.local", import.meta.url);

export const DEMO_ALIASES = ["admin", "moderator", "publisher", "po", "acme-admin", "borealis-admin", "acme-member"] as const;
export const persona = (alias: string) => INBOX.replace("@", `+${alias}@`).toLowerCase();
export const envKey = (alias: string) => `DEMO_PASSWORD_${alias.replace(/-/g, "_").toUpperCase()}`;

async function call(path: string, body: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${anon}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

function savePassword(alias: string, password: string) {
  const env = fs.readFileSync(ENV_FILE, "utf8");
  const line = `${envKey(alias)}=${password}`;
  const re = new RegExp(`^${envKey(alias)}=.*$`, "m");
  fs.writeFileSync(ENV_FILE, re.test(env) ? env.replace(re, line) : `${env.trimEnd()}\n${line}\n`);
}

const [cmd, alias, code] = process.argv.slice(2);

if (cmd === "create") {
  for (const a of DEMO_ALIASES) {
    const email = persona(a);
    const password = process.env[envKey(a)] ?? `${crypto.randomBytes(18).toString("base64url")}Aa1!`;
    const { status, json } = await call("/api/auth/users", { email, password, name: `Demo ${a}` });
    if (status < 300) {
      savePassword(a, password);
      console.log(`✓ ${a.padEnd(15)} ${email}  → verification code emailed`);
    } else if (status === 409) {
      console.log(`• ${a.padEnd(15)} ${email}  already exists${process.env[envKey(a)] ? "" : " (no saved password!)"}`);
    } else {
      console.log(`✗ ${a.padEnd(15)} ${email}  ${status} ${json.message ?? JSON.stringify(json)}`);
    }
  }
} else if (cmd === "verify" && alias && code) {
  const { status, json } = await call("/api/auth/email/verify", { email: persona(alias), otp: code });
  console.log(status < 300 ? `✓ ${alias} verified` : `✗ ${alias}: ${status} ${json.message ?? JSON.stringify(json)}`);
} else if (cmd === "resend" && alias) {
  const { status } = await call("/api/auth/email/send-verification", { email: persona(alias) });
  console.log(status < 300 ? `✓ new code sent to ${persona(alias)}` : `✗ ${status}`);
} else {
  console.log("usage: demo-accounts.mts create | verify <alias> <code> | resend <alias>");
}
