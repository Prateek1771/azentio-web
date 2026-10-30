import type { Metadata } from "next";
import { Eyebrow } from "@/components/portal/primitives";
import { DEMO_PERSONAS, demoEmail, demoLoginEnabled, demoPassword } from "@/lib/auth/demo";
import { LoginPanel } from "./login-panel";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  // Only personas whose password is configured on this server get a button.
  const demos = demoLoginEnabled()
    ? DEMO_PERSONAS.filter((p) => demoPassword(p.alias)).map((p) => ({ ...p, email: demoEmail(p.alias) }))
    : [];

  return (
    <section className="bg-light">
      <div className="container-x grid min-h-[calc(100dvh-84px)] grid-cols-[1fr_minmax(0,520px)] items-center gap-16 py-16 max-[959px]:grid-cols-1 max-[959px]:gap-10">
        <div className="on-dark bg-page-hero relative self-stretch overflow-hidden rounded-[14px] p-12 text-white max-[959px]:p-8">
          <div className="glow-blob" aria-hidden />
          <div className="relative flex h-full flex-col justify-between gap-12">
            <div>
              <Eyebrow>Secure portal</Eyebrow>
              <h1 className="h-section mt-4">
                Build intelligence. <em>Create shared value.</em>
              </h1>
              <p className="lead mt-4 max-w-[460px]">
                One sign-in for employee innovation and client collaboration. What you see is decided by your
                organisation, your role and your entitlements, and it&rsquo;s enforced on the server.
              </p>
            </div>
            <ul className="grid gap-3 text-sm text-on-dark-muted">
              <li>• Passwordless: a one-time code to your work email</li>
              <li>• Joining a workspace never means consenting to share or train on your data</li>
              <li>• Every privileged action is audited</li>
            </ul>
          </div>
        </div>
        <LoginPanel demos={demos} />
      </div>
    </section>
  );
}
