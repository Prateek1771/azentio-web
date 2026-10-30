# Prototype routes and page structure

These were crawled from <https://azentio-ai-ipad.ssaha999.chatgpt.site/> on 2026-10-30. The full text outline of every page is in [`page-outlines.txt`](page-outlines.txt).

## Sitemap
| Route | Title | Next.js segment | Access in prototype | Access in our build |
|---|---|---|---|---|
| `/` | Build Intelligence. Create Impact. | `app/page` | public | public |
| `/products` | Products | `products` | public | public |
| `/products/[slug]` | 8 product pages (below) | `products/[slug]` | public | public (+ entitled sandbox for clients) |
| `/solutions` | Solutions | `[slug]` | public | public |
| `/lab` | AI Lab | `[slug]` | public | public (internal experiments move to the employee portal) |
| `/technology` | Technology & Trust | `[slug]` | public | public |
| `/media` | Media & Videos | `media` | public | public (approved media only; audience-gated videos via `/api/media`) |
| `/insights` | Insights | `[slug]` | public | public |
| `/about` | About | `[slug]` | public | public |
| `/connect` | Connect (demo request / enquiry) | `connect` | public | public |
| `/hackathon/register` | Hackathon registration | `hackathon/register` | public | public |
| `/live` | Live Streaming | `live` | **public** ⚠ | employee or audience-gated |
| `/playground` | Employee Playground | `playground` | **public** ⚠ | employee (`/e/playground`) + client sandboxes |
| `/configurator` | Admin: "Your publishing workspace" | `configurator` | **public** ⚠ | publisher grant only (`/s/publisher`) |
| `/login` | → 302 redirect | — | — | email OTP login |
| `/auth/email/logout` | (renders configurator) | — | — | sign-out route |

⚠ = public in the prototype only "for demonstration convenience". The brief requires these to be enforced on the server (REQUIREMENTS §01).

## Navigation
**Header** (sticky navy): logo · Products · **Innovation ▾** (AI Lab, Technology, Hackathons) · **Explore ▾** (Solutions, Media & Videos, Insights, About) · **Admin ⋮** (Configurator, Playground, Live Streaming) · **Request Demo** button. On mobile, a drawer with inline mega-panels.

**Footer**
- Explore: Products, Solutions, AI Lab, Technology
- Discover: Media, Live, Insights, About
- Collaborate: Connect, Request Demo, Contact
- Admin: Playground

**Floating:** the AIRA assistant button appears on every page.

## Page anatomy
**Home `/`**
1. Hero carousel with 2 slides:
   - "Build Intelligence. Create Impact." with `banners/intelligence.svg`
   - "Your next idea. Our next breakthrough." with `banners/hackathon.svg`
   - CTA: "Explore our products ↗"
2. "Intelligence, Engineered for the Real World." (intro copy)
3. "Intelligence in Every Layer.": 6 capability flip cards
   - Intelligent Decisioning
   - Document Intelligence
   - AI Agents & Automation
   - Analytics & Insights
   - Configurable AI Platforms
   - Trusted Enterprise AI
4. "Built to Work. Designed to Evolve.": 4 featured product cards + "View all products"
5. "Don't Just Imagine What AI Can Do. See It.": cinematic media band + "Watch Product Showcases"
6. "Innovation Without Compromising Trust.": trust grid
7. "Ideas in Motion.": news grid
8. CTA: "The Next Intelligent Idea Starts Here." + "Start a Conversation"

**Products `/products`**: page hero, then three categories, then a disclaimer.

| Category | Products |
|---|---|
| Credit Intelligence | credit-strategy-simulator, sme-credit-decisioning, similar-portfolio-intelligence, rejection-intelligence |
| Reporting & Analytics | riva, financial-analysis |
| AI Applications | document-intelligence, persona-newsroom |

**Product detail `/products/[slug]`**: "← All Products", hero headline + "Request a Demo", name + summary, workflow (flow steps), benefits (with the "intended outcomes" disclaimer), "See how this solution could fit…" CTA.

| Slug | Name | Hero headline | Summary |
|---|---|---|---|
| credit-strategy-simulator | Credit Strategy Simulator | Test the Strategy. Understand the Impact. | Simulate credit policy changes before deployment. Explore effects on approvals, risk exposure and portfolio outcomes. |
| sme-credit-decisioning | SME Credit Decisioning Workbench | Every Decision, Backed by Intelligence. | Financial analysis, policy evaluation, risk review and credit recommendations in one workbench with evidence and human oversight. |
| similar-portfolio-intelligence | Similar Portfolio Intelligence | Learn from Similarity. Decide with Context. | Compare applications with historical portfolio segments: patterns, risk indicators, comparable outcomes. |
| rejection-intelligence | Rejection Intelligence | Understand Every Rejection. Discover Every Opportunity. | Analyse declined applications, uncover rejection patterns, simulate changes to improve eligible approvals. |
| riva | RIVA | From Complex Data to Confident Reporting. | Configurable reporting: connect sources, map report fields, validate, simplify reporting workflows. |
| financial-analysis | Financial Analysis Intelligence | Numbers Tell a Story. Intelligence Reveals It. | Turn financial statements into structured analysis, ratios, trends and decision-ready credit insights. |
| document-intelligence | Document Intelligence | Documents In. Intelligence Out. | Extract, classify, structure and validate information from financial documents, identity records and complex inputs. |
| persona-newsroom | Persona Newsroom | Relevant News. Distinct Perspectives. | Discover market news, match stories to executive personas, generate editable thought-leadership drafts. |

Product art: `assets/products/<slug>.svg`

**Content pages** (all use the generic `[slug]` template: page hero, info-card grid, CTA)

| Route | H1 | Cards |
|---|---|---|
| `/solutions` | Real Challenges. Intelligent Solutions. | Credit assessment · Policy scenarios · Data mapping & reporting · Historical patterns · Workflow automation · Contextual outputs |
| `/lab` | Experiment Boldly. Engineer Purposefully. | Rapid prototyping · Emerging tech (agentic AI, SLMs, multimodal) · Prototypes & lessons · Hackathons |
| `/technology` | Built for Intelligence. Engineered for Trust. | Integration · Orchestration · Security (SSO, RBAC, encryption, audit) · Governance |
| `/insights` | Ideas Worth Exploring. Perspectives Worth Sharing. | Evidence & oversight · Configurable reporting · Deployment & governance · Lessons from experiments |
| `/about` | Built on Curiosity. Driven by Purpose. | Mission · Vision · Build with Purpose · Engineer for Trust |
| `/media` | See the Thinking. Experience the Technology. | 4 video cards (approach, products in action, credit decisioning, experiments) |

**Forms**
- `/connect` ("Have a Challenge? Let's Build What Comes Next."):
  - Fields: interest (Request a product demo / Explore a collaboration / Submit an AI challenge / General enquiry), name, work email, organisation, message
  - Button: "Submit Enquiry"
  - Note: "Demo form only"
- `/hackathon/register` ("Start with an idea."):
  - Fields: name, email, website (honeypot), consent checkbox
  - Button: "Register interest →"
  - Notes: private-storage notice, "No confirmation email is sent to you."

**Ops pages**
- `/playground` ("Explore. Experiment. Evolve."): choose a product (one of the 8), describe the scenario, "Preview workflow →". Labelled as a local preview with no model run.
- `/live` ("Where Intelligence Comes Alive."): azentio.ai Live player, "Configure Live →", past recordings, "Refresh videos".
- `/configurator` ("Your publishing workspace."):
  - Tabs: Stream settings / Past recordings / Homepage
  - Fields: video title, platform/embed URL (YouTube, Twitch and Vimeo are auto-converted; MP4 and WebM work directly), "Display this video on Live"

## Mapping to our build (from LLD §3.1)
- Keep every public route and its copy as-is under `app/(public)`.
- `/playground` → `/e/playground` (employee) and `/c/[org]/sandboxes/[offering]` (entitled clients)
- `/live` → `/e/live` + audience-gated sessions; the public `/live` shows public sessions only
- `/configurator` → `/s/publisher` (needs the `publish_media` grant)
- `/connect` and `/hackathon/register` → persisted, validated, rate-limited server actions
- AIRA floating panel → `/api/aira` (RAG over approved shared learning)
