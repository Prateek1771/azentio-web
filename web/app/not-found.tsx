import { CtaLink, Section } from "@/components/portal/primitives";

export default function NotFound() {
  return (
    <Section>
      <div className="mx-auto max-w-[560px] text-center">
        <p className="eyebrow">404</p>
        <h1 className="h-section mt-4">We couldn&rsquo;t find that page.</h1>
        <p className="lead mt-4">It may have moved, or it isn&rsquo;t available to your account.</p>
        <div className="mt-8 flex justify-center gap-3">
          <CtaLink href="/" icon={false}>
            Back to home
          </CtaLink>
        </div>
      </div>
    </Section>
  );
}
