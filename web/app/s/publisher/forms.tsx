"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { toEmbed } from "@/lib/media/embed";
import { type ActionState, addRecording, createBanner, saveSession } from "./actions";

const field =
  "w-full rounded-md border border-[#d7e1e8] bg-white px-3.5 py-3 text-[15px] text-ink outline-none focus:border-green-700 focus:ring-3 focus:ring-green/30";
const label = "grid gap-2 text-[13px] font-bold";

type Offering = { slug: string; name: string };

function Result({ s }: { s: ActionState }) {
  if (s.error) return <p role="alert" className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">{s.error}</p>;
  if (s.ok) return <p role="status" className="rounded-md bg-green-050 px-3 py-2 text-sm font-bold text-green-700">{s.ok}</p>;
  return null;
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button disabled={pending} className="inline-flex items-center gap-2 justify-self-start rounded-[5px] bg-green px-5 py-3 text-sm font-bold text-on-green disabled:opacity-60">
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

function AudienceFields({ offerings }: { offerings: Offering[] }) {
  const [aud, setAud] = useState("employee");
  return (
    <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
      <label className={label}>
        Audience
        <select name="audience" value={aud} onChange={(e) => setAud(e.target.value)} className={field}>
          <option value="employee">Employees only</option>
          <option value="public">Public website</option>
          <option value="client_entitled">Clients entitled to an offering</option>
        </select>
      </label>
      {aud === "client_entitled" && (
        <label className={label}>
          Offering
          <select name="offering" className={field} required>
            {offerings.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

export function StreamForm({ offerings, host }: { offerings: Offering[]; host: string }) {
  const [state, action, pending] = useActionState(saveSession, {});
  const [url, setUrl] = useState("");
  const embed = url ? toEmbed(url, host) : null;
  return (
    <form action={action} className="grid gap-5">
      <label className={label}>
        Video title
        <input name="title" required maxLength={200} className={field} />
      </label>
      <label className={label}>
        Platform video or embed URL
        <input name="url" required value={url} onChange={(e) => setUrl(e.target.value)} className={field} placeholder="https://www.youtube.com/watch?v=…" />
        <span className="text-xs font-normal text-slate">YouTube, Twitch and Vimeo links are converted automatically. Direct https MP4 and WebM URLs also work.</span>
      </label>
      {url && (
        <p className={`text-xs font-bold ${embed ? "text-green-700" : "text-orange-700"}`} data-testid="embed-preview">
          {embed ? `Embeds as: ${embed.url}` : "Not a supported video URL."}
        </p>
      )}
      <AudienceFields offerings={offerings} />
      <div className="grid grid-cols-2 items-end gap-4 max-sm:grid-cols-1">
        <label className={label}>
          Starts at (optional)
          <input type="datetime-local" name="starts_at" className={field} />
        </label>
        <label className="flex items-center gap-3 pb-3 text-sm font-bold">
          <input type="checkbox" name="is_live" className="size-4 accent-[#247447]" />
          Display this video on Live now
        </label>
      </div>
      <Result s={state} />
      <Submit pending={pending}>Save stream settings</Submit>
    </form>
  );
}

export function RecordingForm({ offerings }: { offerings: Offering[] }) {
  const [state, action, pending] = useActionState(addRecording, {});
  return (
    <form action={action} className="grid gap-5">
      <label className={label}>
        Title
        <input name="title" required maxLength={200} className={field} />
      </label>
      <label className={label}>
        Summary (optional)
        <input name="summary" maxLength={500} className={field} />
      </label>
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <label className={label}>
          Video URL
          <input name="url" className={field} placeholder="https://vimeo.com/…" />
        </label>
        <label className={label}>
          …or upload a file (mp4/webm, ≤ 200 MB)
          <input name="file" type="file" accept="video/mp4,video/webm" className={`${field} py-2.5`} />
        </label>
      </div>
      <AudienceFields offerings={offerings} />
      <Result s={state} />
      <Submit pending={pending}>Add recording</Submit>
    </form>
  );
}

export function BannerForm() {
  const [state, action, pending] = useActionState(createBanner, {});
  return (
    <form action={action} className="grid gap-5">
      <label className={label}>
        Announcement
        <input name="title" required maxLength={200} className={field} placeholder="Hackathon registrations are open" />
      </label>
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <label className={label}>
          Detail (optional)
          <input name="body" maxLength={300} className={field} />
        </label>
        <label className={label}>
          Link (optional site path)
          <input name="link" className={field} placeholder="/hackathon/register" />
        </label>
      </div>
      <Result s={state} />
      <Submit pending={pending}>Save banner</Submit>
    </form>
  );
}
