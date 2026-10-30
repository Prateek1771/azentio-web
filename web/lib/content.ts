// Public site content, ported from the reference prototype (docs/design/ROUTES.md).
// ponytail: static module; moves to the `offerings`/`content` tables in Phase 1/3.

export type ProductCategory = "Credit Intelligence" | "Reporting & Analytics" | "AI Applications";

export type Product = {
  slug: string;
  name: string;
  category: ProductCategory;
  headline: string;
  summary: string;
};

export const products: Product[] = [
  {
    slug: "credit-strategy-simulator",
    name: "Credit Strategy Simulator",
    category: "Credit Intelligence",
    headline: "Test the Strategy. Understand the Impact.",
    summary: "Simulate credit policy changes before deployment. Explore potential effects on approvals, risk exposure, and portfolio outcomes.",
  },
  {
    slug: "sme-credit-decisioning",
    name: "SME Credit Decisioning Workbench",
    category: "Credit Intelligence",
    headline: "Every Decision, Backed by Intelligence.",
    summary: "Bring financial analysis, policy evaluation, risk review, and credit recommendations into one workbench with evidence and human oversight.",
  },
  {
    slug: "similar-portfolio-intelligence",
    name: "Similar Portfolio Intelligence",
    category: "Credit Intelligence",
    headline: "Learn from Similarity. Decide with Context.",
    summary: "Compare financing applications with relevant historical portfolio segments to understand patterns, risk indicators, and comparable outcomes.",
  },
  {
    slug: "rejection-intelligence",
    name: "Rejection Intelligence",
    category: "Credit Intelligence",
    headline: "Understand Every Rejection. Discover Every Opportunity.",
    summary: "Analyze declined applications, uncover rejection patterns, and simulate changes that could improve eligible approvals.",
  },
  {
    slug: "riva",
    name: "RIVA",
    category: "Reporting & Analytics",
    headline: "From Complex Data to Confident Reporting.",
    summary: "A configurable reporting environment connecting data sources, mapping report fields, supporting validation, and simplifying reporting workflows.",
  },
  {
    slug: "financial-analysis",
    name: "Financial Analysis Intelligence",
    category: "Reporting & Analytics",
    headline: "Numbers Tell a Story. Intelligence Reveals It.",
    summary: "Turn financial statements into structured analysis, ratios, trends, and decision-ready credit insights.",
  },
  {
    slug: "document-intelligence",
    name: "Document Intelligence",
    category: "AI Applications",
    headline: "Documents In. Intelligence Out.",
    summary: "Extract, classify, structure, and validate information from financial documents, identity records, and complex inputs.",
  },
  {
    slug: "persona-newsroom",
    name: "Persona Newsroom",
    category: "AI Applications",
    headline: "Relevant News. Distinct Perspectives.",
    summary: "Discover relevant market news, match stories to executive personas, and generate editable thought-leadership drafts.",
  },
];

export const featuredProducts = products.slice(0, 4);

export type NavLink = { label: string; href: string; description?: string };
export type NavGroup = { label: string; intro: string; links: NavLink[] };

export const navGroups: NavGroup[] = [
  {
    label: "Innovation",
    intro: "Where emerging technology meets practical challenges.",
    links: [
      { label: "AI Lab", href: "/lab", description: "Experiments, prototypes and lessons learned." },
      { label: "Technology", href: "/technology", description: "Built for intelligence. Engineered for trust." },
      { label: "Hackathons", href: "/hackathon/register", description: "Build, experiment and collaborate with us." },
    ],
  },
  {
    label: "Explore",
    intro: "Ideas, stories and the thinking behind our products.",
    links: [
      { label: "Solutions", href: "/solutions", description: "Real challenges. Intelligent solutions." },
      { label: "Media & Videos", href: "/media", description: "Demonstrations, explainers and stories." },
      { label: "Insights", href: "/insights", description: "Perspectives on applied, responsible AI." },
      { label: "About", href: "/about", description: "Built on curiosity. Driven by purpose." },
    ],
  },
];

export const footerColumns: { title: string; links: NavLink[] }[] = [
  {
    title: "Explore",
    links: [
      { label: "Products", href: "/products" },
      { label: "Solutions", href: "/solutions" },
      { label: "AI Lab", href: "/lab" },
      { label: "Technology", href: "/technology" },
    ],
  },
  {
    title: "Discover",
    links: [
      { label: "Media", href: "/media" },
      { label: "Insights", href: "/insights" },
      { label: "About", href: "/about" },
    ],
  },
  {
    title: "Collaborate",
    links: [
      { label: "Connect", href: "/connect" },
      { label: "Request Demo", href: "/connect?interest=demo" },
      { label: "Hackathon", href: "/hackathon/register" },
    ],
  },
  {
    title: "Portal",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Employee portal", href: "/e" },
      { label: "Client workspace", href: "/c" },
    ],
  },
];
