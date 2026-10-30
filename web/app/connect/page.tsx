import type { Metadata } from "next";
import { Suspense } from "react";
import { Eyebrow, PageHero, Section } from "@/components/portal/primitives";
import { ConnectForm } from "./connect-form";

export const metadata: Metadata = {
  title: "Connect",
  description: "Explore a product, share an AI opportunity, or start a conversation about collaboration.",
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Connect with us"
        title="Have a Challenge? Let's Build What Comes Next."
        lead="Explore a product, share an AI opportunity, or start a conversation about collaboration."
      />
      <Section>
        <div className="grid grid-cols-[1fr_1.3fr] gap-14 max-[959px]:grid-cols-1">
          <div>
            <Eyebrow>Let&rsquo;s talk</Eyebrow>
            <h2 className="h-section mt-3.5 mb-5">Start with a Conversation.</h2>
            <p className="lead">
              Tell us what you&rsquo;re exploring. We can discuss product capabilities, integration considerations, and
              opportunities to collaborate.
            </p>
          </div>
          <Suspense>
            <ConnectForm />
          </Suspense>
        </div>
      </Section>
    </>
  );
}
