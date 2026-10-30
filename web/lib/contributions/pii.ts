// Mirrors public.pii_scan() in the database (the server truth) so the form can warn before saving.
const RULES: [flag: string, label: string, re: RegExp][] = [
  ["aadhaar", "an Aadhaar-style number", /\b\d{4} \d{4} \d{4}\b/],
  ["card_or_account", "a card or account number", /\b(\d[ -]?){12,18}\d\b/],
  ["email", "an email address", /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i],
  ["iban", "an IBAN", /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/],
  ["pan", "a PAN", /\b[A-Z]{5}\d{4}[A-Z]\b/],
  ["phone", "a phone number", /(\+\d{1,3}[ -]?)?\b(\d[ -]?){9,11}\d\b/],
];

export const piiLabel = Object.fromEntries(RULES.map(([f, l]) => [f, l]));

export function scanPii(text: string): string[] {
  return RULES.filter(([, , re]) => re.test(text)).map(([f]) => f);
}
