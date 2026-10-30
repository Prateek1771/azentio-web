import type { Metadata } from "next";
import Image from "next/image";
import { Eyebrow } from "@/components/portal/primitives";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Hackathon registration",
  description: "Register your interest in the upcoming azentio.ai hackathon.",
};

export default function Page() {
  return (
    <section className="on-dark relative overflow-hidden bg-navy py-24 text-white max-md:py-16">
      <Image src="/banners/hackathon.svg" alt="" fill priority className="object-cover opacity-60" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#171b3af2,#171b3acc_45%,#171b3a66)]" aria-hidden />
      <div className="container-x relative grid grid-cols-[1.1fr_minmax(0,460px)] items-center gap-14 max-[959px]:grid-cols-1">
        <div>
          <Eyebrow>Upcoming azentio.ai hackathon</Eyebrow>
          <h1 className="h-page my-6">
            Start with <em>an idea.</em>
          </h1>
          <p className="lead max-w-[540px]">
            Register your interest in building, experimenting, and collaborating. Dates and participation details will be announced.
          </p>
        </div>
        <RegisterForm />
      </div>
    </section>
  );
}
