// Public site content, transcribed verbatim from the reference prototype (docs/design/ROUTES.md).
// ponytail: static module. Public marketing copy changes with deploys; publisher-managed
// banners/media live in the DB (`content`, `media`) from Phase 4.

export type ProductCategory = "Credit Intelligence" | "Reporting & Analytics" | "AI Applications";

export type Product = {
  slug: string;
  name: string;
  category: ProductCategory;
  headline: string;
  summary: string;
  tagline: string;
  status: string;
  features: string[];
  flow: string[];
  benefits: string[];
};

export const products: Product[] = [
  {
    slug: "credit-strategy-simulator",
    name: "Credit Strategy Simulator",
    category: "Credit Intelligence",
    headline: "Test the Strategy. Understand the Impact.",
    summary: "Simulate credit policy changes before deployment. Explore potential effects on approvals, risk exposure, and portfolio outcomes.",
    tagline: "Credit Policy Intelligence",
    status: "Prototype",
    features: ["Policy scenario configuration", "Approval and risk impact comparison", "Evidence-led simulation"],
    flow: ["Select a portfolio", "Define a strategy", "Run scenarios", "Review impact", "Refine and approve"],
    benefits: ["Evaluate strategy before rollout", "Compare scenarios consistently", "Support informed policy reviews"],
  },
  {
    slug: "sme-credit-decisioning",
    name: "SME Credit Decisioning Workbench",
    category: "Credit Intelligence",
    headline: "Every Decision, Backed by Intelligence.",
    summary: "Bring financial analysis, policy evaluation, risk review, and credit recommendations into one workbench with evidence and human oversight.",
    tagline: "Explainable Credit Intelligence",
    status: "Prototype",
    features: ["Policy and exception evaluation", "Explainable recommendations", "Human decision controls"],
    flow: ["Capture application", "Collect evidence", "Evaluate policies", "Review recommendation", "Approve or refer"],
    benefits: ["Streamline reviews", "Improve consistency", "Preserve accountability"],
  },
  {
    slug: "similar-portfolio-intelligence",
    name: "Similar Portfolio Intelligence",
    category: "Credit Intelligence",
    headline: "Learn from Similarity. Decide with Context.",
    summary: "Compare financing applications with relevant historical portfolio segments to understand patterns, risk indicators, and comparable outcomes.",
    tagline: "Contextual Portfolio Insights",
    status: "Prototype",
    features: ["Peer cohort discovery", "Portfolio comparisons", "Historical outcome context"],
    flow: ["Select application", "Identify comparable cohort", "Compare indicators", "Review insights"],
    benefits: ["Add context to underwriting", "Reveal comparable patterns", "Support informed review"],
  },
  {
    slug: "rejection-intelligence",
    name: "Rejection Intelligence",
    category: "Credit Intelligence",
    headline: "Understand Every Rejection. Discover Every Opportunity.",
    summary: "Analyze declined applications, uncover rejection patterns, and simulate changes that could improve eligible approvals.",
    tagline: "Rejection Analysis & Simulation",
    status: "Prototype",
    features: ["Reason categorization", "Trend analysis", "Scenario simulation"],
    flow: ["Ingest decisions", "Classify reasons", "Explore patterns", "Simulate alternatives"],
    benefits: ["Understand rejection drivers", "Identify potential improvements", "Explore policy changes"],
  },
  {
    slug: "riva",
    name: "RIVA",
    category: "Reporting & Analytics",
    headline: "From Complex Data to Confident Reporting.",
    summary: "A configurable reporting environment connecting data sources, mapping report fields, supporting validation, and simplifying reporting workflows.",
    tagline: "Reporting Intelligence, Validation & Analytics",
    status: "Prototype",
    features: ["Multi-source data mapping", "Configurable report templates", "Validation and audit history"],
    flow: ["Connect sources", "Configure template", "Map fields", "Validate", "Generate report"],
    benefits: ["Reduce manual mapping", "Improve traceability", "Adapt reporting workflows"],
  },
  {
    slug: "financial-analysis",
    name: "Financial Analysis Intelligence",
    category: "Reporting & Analytics",
    headline: "Numbers Tell a Story. Intelligence Reveals It.",
    summary: "Turn financial statements into structured analysis, ratios, trends, and decision-ready credit insights.",
    tagline: "Financial Assessment",
    status: "Prototype",
    features: ["Statement structuring", "Financial ratios and trends", "Evidence-linked analysis"],
    flow: ["Upload statements", "Extract figures", "Analyze metrics", "Review insights"],
    benefits: ["Accelerate review", "Improve consistency", "Make trends visible"],
  },
  {
    slug: "document-intelligence",
    name: "Document Intelligence",
    category: "AI Applications",
    headline: "Documents In. Intelligence Out.",
    summary: "Extract, classify, structure, and validate information from financial documents, identity records, and complex inputs.",
    tagline: "Intelligent Extraction & Verification",
    status: "Prototype",
    features: ["Document classification", "Structured extraction", "Validation workflows"],
    flow: ["Receive document", "Classify", "Extract", "Validate", "Publish structured data"],
    benefits: ["Reduce manual entry", "Improve information quality", "Enable downstream workflows"],
  },
  {
    slug: "persona-newsroom",
    name: "Persona Newsroom",
    category: "AI Applications",
    headline: "Relevant News. Distinct Perspectives.",
    summary: "Discover relevant market news, match stories to executive personas, and generate editable thought-leadership drafts.",
    tagline: "Executive Content Intelligence",
    status: "Prototype",
    features: ["Article repository", "Persona-specific recommendations", "Editable draft generation"],
    flow: ["Discover news", "Choose persona", "Generate draft", "Review and edit"],
    benefits: ["Reduce content preparation time", "Support distinctive viewpoints", "Preserve editorial control"],
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

export const productCategories: { name: ProductCategory; id: string }[] = [
  { name: "Credit Intelligence", id: "credit-intelligence" },
  { name: "Reporting & Analytics", id: "reporting-analytics" },
  { name: "AI Applications", id: "ai-applications" },
];

export const productBySlug = (slug: string) => products.find((p) => p.slug === slug);

// ── home ────────────────────────────────────────────────────────────────
export const heroSlides = [
  {
    eyebrow: "Welcome to azentio.ai",
    title: "Build Intelligence.",
    accent: "Create Impact.",
    lead: "From ideas to intelligent products. From complexity to clarity. From AI potential to meaningful outcomes.",
    cta: { label: "Explore our products", href: "/products" },
    image: "/banners/intelligence.svg",
  },
  {
    eyebrow: "Upcoming azentio.ai hackathon",
    title: "Your next idea.",
    accent: "Our next breakthrough.",
    lead: "Register your interest in building, experimenting, and collaborating. Dates and participation details will be announced.",
    cta: { label: "Register interest", href: "/hackathon/register" },
    image: "/banners/hackathon.svg",
  },
];

export const whoWeAre = {
  eyebrow: "Who we are",
  title: "Intelligence, Engineered for the Real World.",
  body: "AI creates value when it moves beyond experimentation and becomes part of how businesses operate. We build intelligent applications combining domain understanding, advanced AI, intuitive experiences, and enterprise-grade engineering.",
};

export const capabilities = [
  { title: "Intelligent Decisioning", subtitle: "Turn policies, evidence, and data into informed recommendations.", back: "Policy to recommendation",
    points: ["Evaluate applications vs. configurable policies", "Analyze risk, financial data & historical patterns", "Simulate policy changes", "Evidence-backed recommendations"] },
  { title: "Document Intelligence", subtitle: "Extract, interpret, and validate complex information.", back: "Documents to structured data",
    points: ["Classify & extract information", "Validate across documents", "Detect inconsistencies", "Deliver structured data"] },
  { title: "AI Agents & Automation", subtitle: "Connect intelligence with workflows and human oversight.", back: "Tasks to connected workflows",
    points: ["Interpret tasks", "Coordinate connected workflows", "Automate multi-step activities", "Human approvals & audit trails"] },
  { title: "Analytics & Insights", subtitle: "Transform data into actionable intelligence.", back: "Data to actionable insight",
    points: ["Unify data sources", "Identify trends & root causes", "Compare portfolios & simulate scenarios", "Produce actionable insights"] },
  { title: "Configurable AI Platforms", subtitle: "Adapt solutions to evolving business requirements.", back: "Adapt the platform",
    points: ["Configure rules", "Map databases & APIs", "Manage templates & modules", "Track versions & approvals"] },
  { title: "Trusted Enterprise AI", subtitle: "Design for security, accountability, and traceability.", back: "Governed enterprise intelligence",
    points: ["Enterprise SSO & RBAC", "Protect data", "Maintain audit records", "Human oversight & governance"] },
];

export const trustItems = ["Identity & SSO", "Role-Based Access", "Auditability", "Data Protection", "Human Oversight", "Secure Deployment"];

export const newsItems = [
  { eyebrow: "AI Lab", title: "Experiment Boldly. Engineer Purposefully.", href: "/lab" },
  { eyebrow: "azentio.ai Live", title: "Conversations Where Intelligence Comes Alive.", href: "/live" },
  { eyebrow: "Perspectives", title: "Ideas Worth Exploring. Perspectives Worth Sharing.", href: "/insights" },
];

// ── content pages (shared ContentPage template) ─────────────────────────
export type ContentPageData = {
  eyebrow: string;
  title: string;
  lead: string;
  cards: { title: string; body: string; href?: string }[];
};

export const contentPages: Record<"solutions" | "lab" | "technology" | "insights" | "about", ContentPageData> = {
  solutions: {
    eyebrow: "Solutions",
    title: "Real Challenges. Intelligent Solutions.",
    lead: "Practical intelligence for financial services and complex enterprise workflows.",
    cards: [
      { title: "Smarter Credit Decisions", body: "Improve transparency and efficiency across credit assessment.", href: "/products/sme-credit-decisioning" },
      { title: "Adaptive Credit Strategies", body: "Evaluate policy scenarios before implementation.", href: "/products/credit-strategy-simulator" },
      { title: "Intelligent Reporting", body: "Simplify data mapping, validation, and reporting preparation.", href: "/products/riva" },
      { title: "Portfolio Intelligence", body: "Use historical patterns to strengthen decision context.", href: "/products/similar-portfolio-intelligence" },
      { title: "Operational Intelligence", body: "Connect fragmented information and repetitive workflows.", href: "/products/document-intelligence" },
      { title: "Knowledge & Content Intelligence", body: "Turn information into relevant, contextual outputs.", href: "/products/persona-newsroom" },
    ],
  },
  lab: {
    eyebrow: "AI Lab",
    title: "Experiment Boldly. Engineer Purposefully.",
    lead: "Where emerging technologies meet practical challenges. We experiment, prototype, validate, and refine ideas.",
    cards: [
      { title: "Inside the Lab", body: "Explore how we approach rapid prototyping and real-world experimentation." },
      { title: "What We’re Exploring", body: "Agentic AI, small language models, multimodal intelligence, and AI-assisted engineering." },
      { title: "Build Stories", body: "From problem statements and experiments to working prototypes and lessons learned." },
      { title: "Hackathons & Collaboration", body: "Innovation challenges, working sessions, and opportunities to build together.", href: "/hackathon/register" },
    ],
  },
  technology: {
    eyebrow: "Technology & Trust",
    title: "Built for Intelligence. Engineered for Trust.",
    lead: "Reliable data foundations, thoughtful orchestration, secure integration, controlled execution, and transparent governance.",
    cards: [
      { title: "Enterprise Integration", body: "Connect applications, data sources, business rules, and enterprise services through controlled interfaces." },
      { title: "AI Orchestration", body: "Combine models, workflows, agents, deterministic logic, and human approvals." },
      { title: "Security by Design", body: "Support institution SSO, role-based access, encrypted transport, audit trails, and secure deployment." },
      { title: "Responsible AI", body: "Support explainability, model oversight, traceability, and human control. Security testing claims require verified evidence." },
    ],
  },
  insights: {
    eyebrow: "Insights",
    title: "Ideas Worth Exploring. Perspectives Worth Sharing.",
    lead: "Practical thinking on applied AI, engineering, product innovation, and responsible enterprise intelligence.",
    cards: [
      { title: "Why Explainability Matters in Credit Decisions", body: "How evidence, oversight, and transparent recommendations shape responsible decision support." },
      { title: "From Reporting Automation to Intelligence", body: "Moving beyond templates to configurable, validated, and traceable reporting." },
      { title: "Small Language Models in Financial Services", body: "Considerations for privacy, performance, deployment, and governance." },
      { title: "Engineering Notes", body: "Lessons from experiments, prototypes, and production-oriented design." },
    ],
  },
  about: {
    eyebrow: "About azentio.ai",
    title: "Built on Curiosity. Driven by Purpose.",
    lead: "We combine domain understanding, product thinking, AI engineering, and a culture of experimentation to build intelligent solutions.",
    cards: [
      { title: "Our Mission", body: "Engineer practical, responsible, and impactful AI products that simplify complexity and enable better decisions." },
      { title: "Our Vision", body: "A future where intelligence is seamlessly embedded into everyday enterprise experiences." },
      { title: "Build with Purpose", body: "Start with real problems and measure meaningful outcomes." },
      { title: "Engineer for Trust", body: "Make security, accountability, and human oversight foundational." },
    ],
  },
};

export const architectureLayers = [
  { title: "User experience", items: "Workbenches · Copilots · APIs" },
  { title: "AI orchestration & business logic", items: "Workflows · Agents · Rules · Approvals" },
  { title: "Model intelligence · Enterprise data · System integration", items: "" },
  { title: "Trust, security & governance", items: "SSO · RBAC · Encryption · Audit · Monitoring" },
];

export const mediaShowcases = [
  { kind: "Brand", title: "The azentio.ai Story", summary: "Introducing our approach to applied AI." },
  { kind: "Products", title: "Product Showreel", summary: "An overview of intelligent products in action." },
  { kind: "Product Demo", title: "Credit Decisioning Deep Dive", summary: "Explore evidence-backed credit decisioning." },
  { kind: "AI Lab", title: "Inside the AI Lab", summary: "Experiments, prototypes, and lessons learned." },
];

export const PUBLIC_ROUTES = ["/", "/products", "/solutions", "/lab", "/technology", "/insights", "/about", "/media", "/live", "/connect", "/hackathon/register"];
