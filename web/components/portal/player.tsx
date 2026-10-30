import { isDirectVideo } from "@/lib/media/embed";

// Renders an already-authorised embed (the caller fetched it through RLS).
export function Player({ title, embedUrl, mediaId }: { title: string; embedUrl?: string | null; mediaId?: string }) {
  const cls = "aspect-video w-full rounded-[10px] bg-navy-900";
  // Uploaded files stream through the audience-checked /api/media route.
  if (mediaId && !embedUrl) return <video controls preload="metadata" className={cls} src={`/api/media/${mediaId}`} aria-label={title} />;
  if (!embedUrl) return null;
  return isDirectVideo(embedUrl) ? (
    <video controls preload="metadata" className={cls} src={embedUrl} aria-label={title} />
  ) : (
    <iframe src={embedUrl} title={title} className={cls} allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
  );
}
