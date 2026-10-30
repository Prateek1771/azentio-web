import type { Metadata } from "next";
import { contentPages } from "@/lib/content";
import { ContentPage } from "@/components/site/content-page";

const data = contentPages.solutions;
export const metadata: Metadata = { title: "Solutions", description: data.lead };

export default function Page() {
  return <ContentPage data={data} />;
}
