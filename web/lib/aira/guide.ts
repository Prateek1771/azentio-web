// Curated, public "portal guide" for AIRA: what the portal is, how it works, and Azentio's public offerings.
// No tenant data and no URLs (the out.url guard). Lets AIRA answer "what is this?" and how-to questions
// with citations instead of "not enough evidence". Shared learning remains the only evidence about markets.
import { capabilities, products, whoWeAre } from "../content.ts";

export type GuideEntry = { id: string; title: string; href: string; text: string; keywords: string[] };

const words = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).map((w) => w.replace(/s$/, ""));

export const GUIDE: GuideEntry[] = [
  {
    id: "overview", title: "About azentio.ai and this portal", href: "/about",
    text: `azentio.ai is Azentio's applied-AI website and secure collaboration portal. ${whoWeAre.body}
It serves three audiences: public visitors discover the products; employees use an internal playground, live sessions, experiments and a knowledge library; client organisations get a private workspace.
At its core is a governed collective-learning loop: clients contribute market observations, moderators de-identify and publish them, published items roll up into themes and improvement ideas, and AIRA answers questions from that approved evidence.`,
    keywords: ["azentio", "portal", "platform", "website", "site", "overview", "purpose", "about", "what"],
  },
  {
    id: "aira", title: "What AIRA can and can't do", href: "/learning",
    text: `AIRA is the portal's assistant. It answers questions about approved, de-identified shared learning and about how the portal works, and cites a numbered source for every claim.
It only sees what moderators approved for sharing, never your drafts or other organisations' private information. It doesn't make credit decisions, give legal or investment advice, name contributing organisations, or commit to dates. Check the linked sources before relying on an answer.`,
    keywords: ["aira", "assistant", "chatbot", "chat", "bot", "ask", "question", "answer", "citation", "cite", "help", "can", "you"],
  },
  {
    id: "contribute", title: "Contributing an observation", href: "/learning",
    text: `Client members record market observations, trends, product gaps, operational challenges, successful practices and suggestions from their workspace with a structured form. Every contribution starts as a private draft, and saving never shares it.
To propose sharing, the contributor chooses a visibility (private, their organisation, or propose for shared learning) and gives separate consents to store, publish, attribute and use for model training. A built-in check flags personal or sensitive data before submission. Contributions can be withdrawn at any time.`,
    keywords: ["contribute", "contribution", "observation", "submit", "share", "sharing", "post", "draft", "consent", "privacy", "visibility", "withdraw"],
  },
  {
    id: "moderation", title: "Moderation and de-identification", href: "/learning",
    text: `Moderators review proposals before anything reaches the community. They edit a separate shared copy to remove names and identifying details, then publish it, request clarification, or reject it. The original stays private to the contributing organisation.
Only reviewed fields are published, never tenant identifiers, internal notes or attachments. Anyone can report a published item, which temporarily unpublishes it pending a decision, and a withdrawal removes the shared copy straight away.`,
    keywords: ["moderation", "moderator", "moderate", "review", "redact", "redaction", "deidentify", "identify", "anonymous", "publish", "report", "safe"],
  },
  {
    id: "themes", title: "Themes and improvement ideas", href: "/learning/themes",
    text: `Product owners group related published observations into themes. A theme only shows how many distinct organisations support it, and counts below three are hidden so no single client can be singled out.
Themes turn into improvement ideas with an owner, priority, linked evidence and a status (proposed, under review, planned, in progress, released or not proceeding). Every status change is audited, and clients see an audience-safe update on the Improvement ideas page.`,
    keywords: ["theme", "idea", "improvement", "trend", "pattern", "status", "feedback", "product", "owner"],
  },
  {
    id: "playground", title: "Playground and sandboxes", href: "/products",
    text: `Employees have a guided playground, and entitled clients have sandboxes, for trying product workflows on synthetic scenarios. Every output is labelled as simulated and is never an approved credit or business decision. Runs can be saved with structured feedback.`,
    keywords: ["playground", "sandbox", "simulate", "simulated", "simulation", "try", "scenario", "synthetic", "experiment"],
  },
  {
    id: "federated", title: "Federated learning programme", href: "/products",
    text: `The federated learning programme is optional and separate from sharing observations. A client admin opts in with an explicit model-training consent. Each client environment trains locally and sends only clipped model updates; a coordinator averages them, and a person approves or rejects each candidate model, with rollback.
It is a demonstration on synthetic data without secure aggregation or formal privacy guarantees. Withdrawing stops future participation.`,
    keywords: ["federated", "fl", "model", "training", "train", "programme", "program", "opt", "machine", "learning"],
  },
  {
    id: "connect", title: "Requesting a demo or getting in touch", href: "/connect",
    text: `Visitors can request a product demonstration or send an enquiry through the Connect page, and register interest in the hackathon on its registration page. Client organisations join the portal by invitation from their client admin.`,
    keywords: ["demo", "contact", "connect", "enquiry", "sales", "pricing", "hackathon", "register", "join", "invite", "invitation", "access", "sign"],
  },
  {
    id: "capabilities", title: "What Azentio builds", href: "/",
    text: capabilities.map((c) => `${c.title}: ${c.subtitle} ${c.points.join("; ")}.`).join("\n"),
    keywords: ["capability", "build", "decisioning", "document", "agent", "automation", "analytic", "insight", "configurable", "trusted", "enterprise", "do"],
  },
  {
    id: "products", title: "Azentio products", href: "/products",
    text: products.map((p) => `${p.name} (${p.category}): ${p.headline}`).join("\n"),
    keywords: ["product", "offering", "solution", "catalogue", "portfolio", "list", "available", "sell"],
  },
  ...products.map((p) => ({
    id: `product:${p.slug}`, title: p.name, href: `/products/${p.slug}`,
    text: `${p.name} (${p.category}). ${p.headline} ${p.summary} Key features: ${p.features.join("; ")}.`,
    keywords: [...new Set([...words(p.name), ...words(p.slug)].filter((w) => w.length > 2 && w !== "intelligence"))],
  })),
];

const STOP = new Set(words("the a an is are was be of to in on for and or how does i me my we our it its this that which who your with from tell show give please"));
// Words that add to a score but can't pull an entry in on their own ("what can you do" is META's job).
const WEAK = new Set(words("what about do you can"));
const META = /\b(what is this|what('s| is) (azentio|this (site|portal|platform|about))|about (this|azentio)|who are you|what can you|what do you do|help|hello|hi|hey|getting started|how does this work)\b/i;
// "my/our … projects/experiments/drafts": pull in the caller's own workspace items even without a topic word.
const MINE = /\b(my|our|mine|we|i)\b.*\b(projects?|experiments?|observations?|drafts?|contributions?|work|teams?|submissions?|ideas?|guides?|library|workspace)\b/i;

export type Doc = { id: string; title: string; href: string; text: string; keywords?: string[] };

// Top ≤ max docs by keyword/title overlap with the question. boost > 0 pulls a doc in on its own.
// ponytail: word-overlap ranking over a few dozen docs; switch to FTS/embeddings if these lists grow.
export function rank<T extends Doc>(docs: T[], question: string, max: number, boost: (d: T) => number = () => 0): T[] {
  const q = words(question).filter((w) => !STOP.has(w));
  return docs
    .map((d) => {
      const keys = new Set([...(d.keywords ?? []).flatMap(words), ...words(d.title).filter((w) => w.length > 3)]);
      const b = boost(d);
      const pulled = b > 0 || q.some((w) => !WEAK.has(w) && keys.has(w));
      return { d, score: pulled ? q.filter((w) => keys.has(w)).length + b : 0 };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score) // stable: ties keep input order (newest first for workspace docs)
    .slice(0, max)
    .map((s) => s.d);
}

// A meta question ("what is this about", "hi") always gets the overview.
export const matchGuide = (question: string, max = 3) => rank(GUIDE, question, max, (g) => (g.id === "overview" && META.test(question) ? 10 : 0));
export const matchWorkspace = (docs: Doc[], question: string, max = 4) => rank(docs, question, max, () => (MINE.test(question) ? 1 : 0));
