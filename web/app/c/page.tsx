import { Suspense } from "react";
import { redirect } from "next/navigation";
import { activeWorkspace, clientOrgs, requireUser } from "@/lib/authz";

// /c → the active (cookie, re-validated) or only workspace, else the picker.
async function Resolve(): Promise<never> {
  const s = await requireUser("/c");
  const ws = await activeWorkspace(s);
  redirect(ws ? `/c/${ws.slug}` : clientOrgs(s).length ? "/workspace" : "/account");
}

export default function Page() {
  return (
    <Suspense>
      <Resolve />
    </Suspense>
  );
}
