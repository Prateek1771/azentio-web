import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { CtaLink, Section } from "@/components/portal/primitives";
import { PortalBand } from "@/components/portal/portal";
import { signOut } from "../../login/actions";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

// Accepting happens on an explicit POST (not on page load), so link previews and prefetching can't consume it.
async function acceptInvite(token: string) {
  "use server";
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database.rpc("accept_invitation", { p_token: token });
  const r = (data ?? {}) as { ok?: boolean; reason?: string; org_slug?: string };
  if (r.ok && r.org_slug) redirect(`/c/${r.org_slug}`); // the terms gate runs on first entry
  redirect(`/invite/${encodeURIComponent(token)}?error=${r.reason ?? "invalid_or_expired"}`);
}

const ERRORS: Record<string, { title: string; body: string }> = {
  invalid_or_expired: { title: "This invitation can't be used.", body: "It may have expired, been revoked, or already been accepted. Ask your administrator for a new one." },
  wrong_account: { title: "This invitation is for a different email.", body: "Sign out, then sign in with the email address the invitation was sent to." },
};

async function Invite({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const s = await getSession();
  if (!s && !error) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  const err = error ? (ERRORS[error] ?? ERRORS.invalid_or_expired) : null;

  return (
    <>
      <PortalBand eyebrow="Invitation" title={err ? err.title : "You've been invited to a client workspace."} />
      <Section className="py-14">
        <div className="mx-auto grid max-w-[560px] gap-5 rounded-[14px] border border-line bg-white p-8">
          {err ? (
            <>
              <p className="text-slate">{err.body}</p>
              <div className="flex flex-wrap gap-3">
                {error === "wrong_account" ? (
                  <form action={signOut}>
                    <button className="rounded-[5px] bg-green px-5 py-3 text-sm font-bold text-on-green">Sign out</button>
                  </form>
                ) : (
                  <CtaLink href="/account" icon={false}>Go to your account</CtaLink>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-slate">
                Signed in as <strong className="text-ink">{s?.user.email}</strong>. Accepting adds you to the
                organisation with the role in the invitation. It doesn&rsquo;t share any of your data.
              </p>
              <form action={acceptInvite.bind(null, token)}>
                <button className="w-full rounded-[5px] bg-green px-5 py-3.5 text-sm font-bold text-on-green transition hover:-translate-y-0.5">
                  Accept invitation
                </button>
              </form>
            </>
          )}
        </div>
      </Section>
    </>
  );
}

export default function Page(props: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Checking invitation…</p></Section>}>
      <Invite {...props} />
    </Suspense>
  );
}
