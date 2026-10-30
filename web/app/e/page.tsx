import type { Metadata } from "next";
import { Suspense } from "react";
import { requireEmployee } from "@/lib/authz";
import { Section } from "@/components/portal/primitives";
import { PortalBand, Tile } from "@/components/portal/portal";

export const metadata: Metadata = { title: "Employee portal" };

async function EmployeeHome() {
  const s = await requireEmployee();
  const name = s.user.email.split("@")[0].split("+").pop();
  return (
    <>
      <PortalBand
        eyebrow="Employee portal · Azentio"
        title={<>Welcome back, <em className="text-green not-italic">{name}</em>.</>}
        lead="Internal experiments, sessions and the improvement work assigned to you. Employee-only content never appears in client or public views."
      />
      <Section className="py-14">
        <div className="grid grid-cols-3 gap-5 max-[959px]:grid-cols-2 max-sm:grid-cols-1">
          <Tile title="Playground" body="Guided product workflows on synthetic scenarios. Every output is labelled simulated." href="/e/playground" />
          <Tile title="Internal Live" body="Employee-only broadcasts and past recordings." href="/e/live" />
          <Tile title="Experiments" body="Submit and follow internal experiments and hackathon team spaces." badge="Phase 7" />
          <Tile title="Shared learning" body="Approved, de-identified market observations and themes." badge="Phase 6" />
          <Tile
            title="Improvement ideas"
            body={s.grants.includes("product_owner") ? "Ideas you own, linked to permitted evidence." : "Ideas and their status across offerings."}
            badge="Phase 6"
          />
          <Tile title="Your account" body="Organisations, permissions and sign-out." href="/account" />
        </div>
      </Section>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <EmployeeHome />
    </Suspense>
  );
}
