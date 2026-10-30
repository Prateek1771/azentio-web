// Converts a pasted video URL into an embeddable player URL. Mirrors the DB trigger
// guard_embed_url(): anything not recognised returns null and is rejected.

export type Embed = { url: string; kind: "iframe" | "video" };

const YT_ID = /^[A-Za-z0-9_-]{6,20}$/;

export function toEmbed(input: string, parentHost = "localhost"): Embed | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const id =
      u.pathname === "/watch" ? u.searchParams.get("v")
      : u.pathname.match(/^\/(embed|shorts|live)\/([^/]+)/)?.[2];
    return id && YT_ID.test(id) ? { url: `https://www.youtube.com/embed/${id}`, kind: "iframe" } : null;
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    return YT_ID.test(id) ? { url: `https://www.youtube.com/embed/${id}`, kind: "iframe" } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.match(/(\d{3,15})/)?.[1];
    return id ? { url: `https://player.vimeo.com/video/${id}`, kind: "iframe" } : null;
  }
  if (host === "twitch.tv" || host === "player.twitch.tv") {
    const channel = host === "twitch.tv" ? u.pathname.split("/")[1] : u.searchParams.get("channel");
    return channel && /^[A-Za-z0-9_]{3,25}$/.test(channel)
      ? { url: `https://player.twitch.tv/?channel=${channel}&parent=${encodeURIComponent(parentHost)}`, kind: "iframe" }
      : null;
  }
  if (/\.(mp4|webm)$/i.test(u.pathname)) return { url: u.toString(), kind: "video" };
  return null;
}

export const isDirectVideo = (url: string) => /\.(mp4|webm)(\?|$)/i.test(url);
