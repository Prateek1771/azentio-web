import { z } from "zod";

export type ContribState = "draft" | "submitted" | "returned" | "published" | "unpublished" | "rejected" | "withdrawn";
export type Visibility = "private" | "org" | "propose_shared";

export type Contribution = {
  id: string;
  org_id: string;
  author_id: string;
  type: string;
  title: string;
  body: string;
  offering_id: string | null;
  industry: string | null;
  region: string | null;
  period_start: string | null;
  period_end: string | null;
  evidence_type: string;
  confidence: string;
  visibility_choice: Visibility;
  state: ContribState;
  version: number;
  pii_flags: string[];
  moderator_reason: string | null;
  updated_at: string;
};

export const TYPES = {
  observation: "Observation",
  trend: "Trend",
  gap: "Gap",
  challenge: "Challenge",
  practice: "Practice",
  suggestion: "Suggestion",
} as const;

export const EVIDENCE = {
  internal_data: "Internal data",
  client_feedback: "Client feedback",
  market_report: "Market report",
  regulatory: "Regulatory",
  anecdotal: "Anecdotal",
} as const;

export const CONFIDENCE = { low: "Low", med: "Medium", high: "High" } as const;

export const VISIBILITY: Record<Visibility, { label: string; hint: string }> = {
  private: { label: "Private note", hint: "Only you. It can never be shared from this setting." },
  org: { label: "My organisation", hint: "Members of your organisation, once you choose to share it. No moderation." },
  propose_shared: {
    label: "Propose to the community",
    hint: "Reviewed by Azentio moderators before anything is shared, de-identified unless you allow attribution.",
  },
};

export const STATE: Record<ContribState, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-light text-slate" },
  submitted: { label: "In review", cls: "bg-amber-50 text-amber-800" },
  returned: { label: "Changes requested", cls: "bg-orange-50 text-orange-800" },
  published: { label: "Published", cls: "bg-green-050 text-green-700" },
  unpublished: { label: "Unpublished", cls: "bg-light text-slate" },
  rejected: { label: "Not accepted", cls: "bg-orange-50 text-orange-800" },
  withdrawn: { label: "Withdrawn", cls: "bg-light text-slate" },
};

const opt = (max: number) =>
  z.string().trim().max(max).transform((v) => v || null);
const date = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date.");

export const contributionSchema = z
  .object({
    type: z.enum(Object.keys(TYPES) as [keyof typeof TYPES]),
    title: z.string().trim().min(5, "Title needs at least 5 characters.").max(140, "Keep the title under 140 characters."),
    body: z.string().trim().min(20, "Describe the observation in at least 20 characters.").max(5000, "Keep it under 5,000 characters."),
    offering_id: z.union([z.literal(""), z.string().uuid()]).transform((v) => v || null),
    industry: opt(80),
    region: opt(80),
    period_start: date,
    period_end: date,
    evidence_type: z.enum(Object.keys(EVIDENCE) as [keyof typeof EVIDENCE]),
    confidence: z.enum(["low", "med", "high"]),
    visibility_choice: z.enum(["private", "org", "propose_shared"]),
  })
  .refine((v) => !v.period_start || !v.period_end || v.period_end >= v.period_start, {
    message: "The period must end after it starts.",
    path: ["period_end"],
  });

export type Consents = { store: boolean; publish: boolean; attribute: boolean; train: boolean };

export const CONSENTS: Record<keyof Consents, string> = {
  store: "Store this contribution in Azentio's learning repository",
  publish: "Publish a de-identified version to the shared learning community once approved",
  attribute: "Show my organisation's name on the shared version",
  train: "Allow it to be used to improve Azentio models and analytics",
};

// Plain-language audience for the current version: what the RLS policies actually allow.
export function whoCanSee(c: Pick<Contribution, "state" | "visibility_choice">, orgName: string): string {
  if (c.state === "withdrawn") return "Only you. Withdrawn and removed from every shared view.";
  if (c.state === "draft" || c.visibility_choice === "private") return "Only you. Drafts are never shared.";
  if (c.visibility_choice === "org") return `You and members of ${orgName}.`;
  switch (c.state) {
    case "submitted":
    case "returned":
      return `You, members of ${orgName}, and Azentio moderators reviewing it. Not in the shared community.`;
    case "published":
      return `You, members of ${orgName}, Azentio moderators, and the shared learning community (de-identified unless you allowed attribution).`;
    case "unpublished":
      return `You, members of ${orgName}, and Azentio moderators. Temporarily removed from the community.`;
    default:
      return `You and members of ${orgName}. Not shared with the community.`;
  }
}

export const NOTIFY: Record<string, string> = {
  "contribution.share_org": "Shared with your organisation",
  "contribution.submit": "Submitted for review",
  "contribution.resubmit": "Resubmitted for review",
  "contribution.amend": "Updated: new version",
  "contribution.return": "A moderator requested changes",
  "contribution.reject": "Not accepted for the community",
  "contribution.publish": "Published to the community",
  "contribution.unpublish": "Temporarily unpublished",
  "contribution.restore": "Restored to the community",
  "contribution.withdraw": "Withdrawn",
  "review.pending": "New contribution awaiting review",
};
