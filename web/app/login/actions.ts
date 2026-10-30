"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAuthActions, createServerClient } from "@insforge/sdk/ssr";
import { DEMO_PERSONAS, demoEmail, demoLoginEnabled, demoPassword } from "@/lib/auth/demo";

export type AuthState = { step: "email" | "code"; email?: string; error?: string; info?: string };

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const codeSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your email.");

// Binds email-keyed provisioning (allow-list, client memberships, grants) to the new session.
async function claimAccess() {
  const insforge = createServerClient({ cookies: await cookies() });
  await insforge.database.rpc("claim_provisioned_access");
}

export async function requestCode(_: AuthState, form: FormData): Promise<AuthState> {
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { step: "email", error: "Enter a valid email address." };
  const auth = createAuthActions({ cookies: await cookies() });
  const { error } = await auth.signInWithOtp({ email: email.data });
  // Same message whether or not the account exists (no enumeration).
  if (error && error.statusCode !== 404) return { step: "email", email: email.data, error: "We couldn't send a code right now. Try again in a minute." };
  return { step: "code", email: email.data, info: "If this email can sign in, a 6-digit code is on its way." };
}

export async function verifyCode(_: AuthState, form: FormData): Promise<AuthState> {
  const email = emailSchema.safeParse(form.get("email"));
  const code = codeSchema.safeParse(form.get("code"));
  if (!email.success) return { step: "email", error: "Enter a valid email address." };
  if (!code.success) return { step: "code", email: email.data, error: code.error.issues[0].message };
  const auth = createAuthActions({ cookies: await cookies() });
  const { error } = await auth.verifyOtp({ email: email.data, otp: code.data });
  if (error) return { step: "code", email: email.data, error: "That code is invalid or has expired. Request a new one." };
  await claimAccess();
  redirect("/account");
}

export async function demoSignIn(_: AuthState, form: FormData): Promise<AuthState> {
  if (!demoLoginEnabled()) return { step: "email", error: "Demo sign-in is disabled." };
  const alias = String(form.get("alias") ?? "");
  // Only whitelisted personas; never accept an arbitrary email or password from the browser.
  if (!DEMO_PERSONAS.some((p) => p.alias === alias)) return { step: "email", error: "Unknown demo account." };
  const password = demoPassword(alias);
  if (!password) return { step: "email", error: "This demo account isn't configured on the server." };
  const auth = createAuthActions({ cookies: await cookies() });
  const { error } = await auth.signInWithPassword({ email: demoEmail(alias), password });
  if (error) {
    const unverified = /verif/i.test(error.message ?? "");
    return {
      step: "email",
      error: unverified ? "This demo account's email hasn't been verified yet." : "Demo sign-in failed. Try again.",
    };
  }
  await claimAccess();
  redirect("/account");
}

export async function signOut() {
  const auth = createAuthActions({ cookies: await cookies() });
  await auth.signOut();
  redirect("/login");
}
