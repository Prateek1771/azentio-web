# azentio.ai design system

These are the design guidelines extracted from the reference prototype at <https://azentio-ai-ipad.ssaha999.chatgpt.site/>.

| File | What it holds |
|---|---|
| [`tokens.css`](tokens.css) | CSS variables |
| [`tokens.json`](tokens.json) | The same tokens as JSON |
| [`prototype.css`](prototype.css) | The original stylesheet |
| [`assets/`](assets/) | Banner, product and navigation SVGs |
| [`ROUTES.md`](ROUTES.md) | Sitemap and page structure |

## 1. Brand character
- **Confident and engineered:** a deep navy canvas, one neon-green accent, oversized tight-tracked headlines.
- **Restraint:** green appears only on CTAs, highlights, the logo letters and focus rings. Everything else is navy, ink or grey.
- **Honest copy:** every capability has a disclaimer. The prototype's own lines are "Benefits describe intended outcomes, not verified performance claims." and "Demo form only. No data is collected or transmitted."
- **Tagline:** *Build Intelligence. Create Impact.*

## 2. Logo (text wordmark, no image file)
```html
<a class="logo" href="/"><span>a</span>zent<span>i</span>o<span>.ai</span></a>
```
`.logo { font-size:27px; font-weight:800; letter-spacing:-1.5px }` and `.logo span { color: var(--green) }`. Header sizes: 25px, then 23px at ≤1250px. The letters **a**, **i** and **.ai** are green; the rest is white on navy.

## 3. Colour
| Token | Hex | Use |
|---|---|---|
| `--bg` navy | `#171b3a` | Header, heroes, dark sections, product art, AIRA border tint |
| `--green` | `#69D393` | Primary buttons, accents, `<em>` in headlines, carousel dot, focus outline |
| `--ink` | `#102031` | Body text |
| `--muted` | `#607080` | Lead and card copy |
| `--light` | `#f5f7f9` | `.section-muted` background, forms |
| green-700 | `#247447` | Eyebrows and text links on light (AA-safe green) |
| on-green | `#122015` | Text on green buttons |
| navy-900 | `#10132c` | Footer, video background |
| navy-800 | `#102233` | CTA panel |
| border | `#e4e9ed` / `#d2d8e2` | Cards / tabs and dividers |
| on-dark muted | `#c9d8e0` | Paragraphs on navy |

Alpha conventions:
- Green glows use `#69D393` at `35`, `44` or `33`.
- Navy shadows use `#171b3a` at `18`, `24` or `40`.
- White hairlines on dark use `#ffffff16`.

**Product art gradients** are radial, from centre to edge:
- teal `#416e68 → #112334`
- blue `#365b91 → #101d37`
- forest `#416d57 → #132d36`
- slate `#405c78 → #142239`

**Dark mode:** the prototype has none. It alternates navy and white sections instead. For our portal (see the artifact contract), keep this light-first scheme and add a dark theme by mapping the surfaces: surface→`#10132c`, light→`#171b3a`, ink→`#e8eef3`.

## 4. Typography
- **Family:** `Arial, Helvetica, sans-serif` (system font, no webfont). If we want more polish, use Inter at the same metrics.

| Role | Size | Weight | Tracking | Line height |
|---|---|---|---|---|
| Hero H1 | `clamp(54px,7vw,99px)` | 700 | -4px | 1.02 |
| Page-hero H1 | `clamp(45px,6vw,75px)` | 700 | -3px | 1.07, max-width 850px |
| Section H2 | `clamp(33px,4vw,52px)` (35px mobile) | 700 | -1.7px | 1.13 |
| Card H3 | 19–20px | 700 | — | 1.2 |
| Lead | 18px, `--muted` | 400 | — | 1.75 |
| Card body | 14px, `--muted` | 400 | — | 1.65 |
| Link / CTA text | 13–14px | 700–800 | — | — |
| Eyebrow | 11px, `#247447` (green on dark) | 800 | 2.2px | — |

**Headline pattern:** two short sentences, with the second often wrapped in `<em>` (rendered green, not italic). Examples: "Build Intelligence. *Create Impact.*" and "Documents In. Intelligence Out."

## 5. Layout
- **Container:** `width: min(1180px, calc(100% - 48px))`, with a 32px gutter below 550px.
- **Sections:** 100px vertical padding (70px on mobile). Alternate white and `.section-muted`.
- **Section head:** H2 on the left, intro `p` at 18px, and a `.text-link` aligned right. Stacks below the nav breakpoint.
- **Grids:**
  - `cap-grid`, `info-grid` and `product-grid` use 3 columns with a 20px gap.
  - `product-grid` goes 4 → 2 → 1 columns.
  - `trust-grid` uses 3 columns with a 16px gap.
  - All grids fall to 1 column on phones.
- **Breakpoints:** 1250 (hide the desktop CTA), 1100 (tighter nav gap), 959/960 (mobile nav), 800, 550 (phone), 400, 370.
- **Header height:** 84px, then 76px at ≤1250px and 66px at ≤950px. Sticky, navy, with a `#ffffff16` bottom hairline.

## 6. Components
| Component | Spec |
|---|---|
| **Button `.btn`** | Green fill and border, text `#122015`, 700 14px, padding 15×23, radius 5px, gap 12px with a trailing ↗/→ icon. Hover: `translateY(-2px)`, .2s. |
| **Text link `.learn` / `.text-link`** | `#247447`, 800 13px, inline-flex with an arrow |
| **Back link** | `#d1e4d0` on navy, 13px, "← All Products" |
| **Eyebrow** | Small caps label above every H1/H2 |
| **Page hero `.page-hero`** | Navy radial gradient (`#234c49 → #171b3a`), padding 110/115px, eyebrow + H1 + lead, green blur blob (`.glow`, 360px, blur 95px) at top right |
| **Home hero `.hero`** | Min-height 680px, 2-slide carousel with a full-bleed SVG banner, left-to-right navy shade, dots (active = 28px green pill), prev/next/pause |
| **Product card** | 1px `#e4e9ed` border, radius 10, navy art header with SVG, body with category, title, 14px muted copy and a "Learn more" link. Hover lifts 6px with a card shadow. |
| **Info / cap card** | Border `#e2e8ed`, radius 10, padding 31, min-height 200–225 |
| **Capability flip card** (`.cap-flip`) | Front: white, green icon, title and subtitle, "Hover or tap to explore ↗". Back: rotateY(180°) navy with a green border, eyebrow + bullet points. |
| **Flow step** | Bordered tile, green step number, bold 13px label, green chevron. Used for product workflows. |
| **CTA panel `.cta`** | `#102233`, radius 14, padding 70/60, green glow. "The Next Intelligent Idea Starts Here." + "Start a Conversation". |
| **Footer** | `#10132c`, 4-column grid (Explore / Discover / Collaborate / Admin), links `#b5c2d0` 13px, bottom bar "© 2026 azentio.ai · Product information is indicative and subject to validation." + Privacy · Terms · Accessibility |
| **Mega menu** | White panel under the header, 3px green top border, 240px label column + links with thumbnails, radius 0 0 14 14. Inline in the mobile drawer. |
| **Forms `.contact-form`** | `#f5f7f9` panel, radius 12, padding 32, gap 20. Labels 700 13px. Inputs padding 14, border `#d7e1e8`, radius 6. Honeypot field. `.form-note` disclaimer. |
| **Tabs `.config-tabs`** | Bordered buttons, radius 8; selected = green fill |
| **Video card** | 16:9 video on `#10132c`, bordered card body |
| **AIRA assistant** | Floating 58px round green toggle at bottom right, labelled "AIRA" (800 13px). Opens a 380×510 white panel with radius 16 and the panel shadow. |
| **Intro animation** | "azentio.ai is powering on": an AI core with orbit rings, energy pulse and quote reveal (`ai-*` keyframes). Fully replaced under reduced motion. |
| **Disclaimer** | 12px `#7a8790` under product grids and forms |

## 7. Motion
- Hover: buttons lift 2px, cards lift 6px; transitions .15–.25s.
- Flip cards rotate in .55s.
- Keyframes: `float`, `ai-rings-form`, `ai-orbit-clockwise/counter`, `ai-network-energy`, `ai-core-awaken`, `ai-energy-pulse`, `ai-quote-arrive`, `ai-status-arrive`, `ai-screen-reveal`, `ai-home-enter`, `ai-ready-breathe`.
- `prefers-reduced-motion: reduce` turns transitions off and uses `ai-reduced-*` fades.

## 8. Accessibility already in place (keep it)
- Skip link
- `aria-expanded` / `aria-controls` on nav disclosures
- Carousel pause control and labelled slides
- Focus ring: 3px solid green with 4px offset on dark, `#247447` on light
- `aria-label` on icon buttons ("Open AIRA", "Open navigation")

## 9. Voice and copy patterns
- Two-beat headlines: "Explore. Experiment. Evolve." and "Built to Work. Designed to Evolve."
- Benefits are framed as *intended outcomes*, never guarantees.
- Every playground or demo is labelled: "This is a local scenario preview; it does not run a model or process enterprise data. Use fictional examples only."
