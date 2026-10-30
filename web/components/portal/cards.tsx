import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/content";
import { CtaLink, Eyebrow, TextLink } from "./primitives";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="lift group flex flex-col overflow-hidden rounded-[10px] border border-line bg-white"
    >
      <div className="bg-navy">
        <Image
          src={`/products/${product.slug}.svg`}
          alt=""
          width={640}
          height={360}
          className="aspect-video w-full object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-6">
        <p className="eyebrow">{product.tagline}</p>
        <h3 className="text-[19px] leading-tight font-bold">{product.name}</h3>
        <p className="flex-1 text-sm leading-[1.65] text-slate">{product.summary}</p>
        <span className="mt-2 text-[13px] font-extrabold text-green-700 group-hover:underline">Explore product ↗</span>
      </div>
    </Link>
  );
}

export function InfoCard({ title, body, href }: { title: string; body: string; href?: string }) {
  return (
    <div className="flex min-h-[225px] flex-col rounded-[10px] border border-[#e2e8ed] bg-white p-[31px]">
      <h3 className="text-[19px] font-bold">{title}</h3>
      <p className="mt-3 flex-1 text-sm leading-[1.65] text-slate">{body}</p>
      {href && <TextLink href={href} className="mt-4">Explore</TextLink>}
    </div>
  );
}

export function CtaPanel({
  eyebrow = "Collaborate",
  title = "The Next Intelligent Idea Starts Here.",
  body = "Explore our products, share a challenge, or collaborate to turn ambitious ideas into working AI solutions.",
  href = "/connect",
  action = "Start a Conversation",
}: {
  eyebrow?: string;
  title?: string;
  body?: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="container-x">
      <div className="on-dark relative mt-[75px] mb-[85px] overflow-hidden rounded-[14px] bg-navy-800 px-[60px] py-[70px] text-white max-md:px-7 max-md:py-12">
        <div className="glow-blob" aria-hidden />
        <div className="relative">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="h-section mt-3.5 mb-6 max-w-[720px]">{title}</h2>
          <p className="mb-8 max-w-[590px] leading-[1.6] text-on-dark-muted">{body}</p>
          <CtaLink href={href}>{action}</CtaLink>
        </div>
      </div>
    </div>
  );
}
