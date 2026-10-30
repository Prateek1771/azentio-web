import type { Metadata } from "next";
import { contentPages } from "@/lib/content";
import { ContentPage } from "@/components/site/content-page";

const data = contentPages.lab;
export const metadata: Metadata = { title: "AI Lab", description: data.lead };

export default function Page() {
  return <ContentPage data={data} />;
}
