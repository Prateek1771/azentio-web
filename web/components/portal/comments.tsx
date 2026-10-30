import { createInsForgeServerClient } from "@/lib/insforge/server";
import { commentAction } from "@/lib/learning/collab";
import { CommentForm } from "./comment-form";

type C = { id: string; body: string; at: string; mine: boolean; author_label: string; hidden: boolean };

// Audience is inherited: the thread RPC re-checks that the viewer can see the parent.
export async function CommentThread({ type, parentId, back, moderator = false }: { type: "shared" | "content"; parentId: string; back: string; moderator?: boolean }) {
  const { data } = await (await createInsForgeServerClient()).database.rpc("comment_thread", { p_type: type, p_id: parentId });
  const comments = (data ?? []) as C[];
  const act = commentAction.bind(null, back);
  return (
    <section aria-labelledby={`discussion-${parentId}`} className="grid gap-4">
      <h2 id={`discussion-${parentId}`} className="text-[17px] font-bold">Discussion ({comments.length})</h2>
      {comments.length ? (
        <ol className="grid grid-cols-1 gap-3">
          {comments.map((c) => (
            <li key={c.id} className={`rounded-lg px-4 py-3 text-sm ${c.hidden ? "bg-orange-50" : "bg-light"}`}>
              <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate">
                <span><strong className="text-ink">{c.author_label}</strong> · {new Date(c.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{c.hidden && " · hidden by a moderator"}</span>
                {(c.mine || (moderator && !c.hidden)) && (
                  <form action={act}>
                    <input type="hidden" name="id" value={c.id} />
                    <button name="op" value={c.mine ? "delete" : "hide"} className="font-bold text-orange-800 hover:underline">{c.mine ? "Delete" : "Hide"}</button>
                  </form>
                )}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-slate">No comments yet.</p>
      )}
      <CommentForm type={type} parentId={parentId} back={back} />
    </section>
  );
}
