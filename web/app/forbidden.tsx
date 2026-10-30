import { CtaLink, Section } from "@/components/portal/primitives";

export default function Forbidden() {
  return (
    <Section>
      <div className="mx-auto max-w-[560px] text-center">
        <p className="eyebrow">403 · Not permitted</p>
        <h1 className="h-section mt-4">This area isn&rsquo;t part of your access.</h1>
        <p className="lead mt-4">
          Access depends on your organisation, role and permissions. If you think you should see this, ask your
          administrator.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <CtaLink href="/account" icon={false}>
            Go to your account
          </CtaLink>
        </div>
      </div>
    </Section>
  );
}
