// Synthetic, clearly fictional scenarios for the guided Playground. No real customers or data.

export type Field = {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
  min?: number;
  max?: number;
  editable?: boolean;
  options?: string[];
};

export type Scenario = {
  key: string;
  title: string;
  entity: string;
  summary: string;
  fields: Field[];
  document?: string; // Document Intelligence input
  synthetic: true;
};

export const scenarios: Record<string, Scenario[]> = {
  "sme-credit-decisioning": [
    {
      key: "riverside-bakery",
      title: "Working-capital line for a growing bakery",
      entity: "Riverside Bakery Ltd (fictional)",
      summary: "A three-year-old bakery asks for a working-capital facility to fund a second store.",
      synthetic: true,
      fields: [
        { key: "dscr", label: "Debt service coverage", value: 1.32, unit: "×", min: 0.5, max: 3, editable: true },
        { key: "debt_to_equity", label: "Debt to equity", value: 1.8, unit: "×", min: 0, max: 6, editable: true },
        { key: "months_trading", label: "Months trading", value: 38, unit: "months", min: 0, max: 240, editable: true },
        { key: "revenue_growth", label: "Revenue growth (YoY)", value: 14, unit: "%", min: -50, max: 200, editable: true },
        { key: "collateral_cover", label: "Collateral cover", value: 92, unit: "%", min: 0, max: 300, editable: true },
      ],
    },
    {
      key: "northwind-logistics",
      title: "Fleet expansion for a young logistics firm",
      entity: "Northwind Logistics (fictional)",
      summary: "An 18-month-old logistics start-up wants to finance six vans against thin cash flow.",
      synthetic: true,
      fields: [
        { key: "dscr", label: "Debt service coverage", value: 1.05, unit: "×", min: 0.5, max: 3, editable: true },
        { key: "debt_to_equity", label: "Debt to equity", value: 3.4, unit: "×", min: 0, max: 6, editable: true },
        { key: "months_trading", label: "Months trading", value: 18, unit: "months", min: 0, max: 240, editable: true },
        { key: "revenue_growth", label: "Revenue growth (YoY)", value: 42, unit: "%", min: -50, max: 200, editable: true },
        { key: "collateral_cover", label: "Collateral cover", value: 70, unit: "%", min: 0, max: 300, editable: true },
      ],
    },
  ],
  "credit-strategy-simulator": [
    {
      key: "tighten-cutoff",
      title: "Tighten the SME score cut-off",
      entity: "Synthetic SME portfolio · 200 applications",
      summary: "Risk wants to know what raising the minimum score from 620 would do to approvals and expected loss.",
      synthetic: true,
      fields: [
        { key: "baseline_cutoff", label: "Current cut-off", value: 620, min: 500, max: 800 },
        { key: "cutoff", label: "Proposed cut-off", value: 660, min: 500, max: 800, editable: true },
        { key: "lgd", label: "Loss given default", value: 45, unit: "%", min: 5, max: 100, editable: true },
      ],
    },
    {
      key: "loosen-cutoff",
      title: "Loosen the cut-off to grow volume",
      entity: "Synthetic SME portfolio · 200 applications",
      summary: "Sales asks whether lowering the cut-off to 590 is worth the extra risk.",
      synthetic: true,
      fields: [
        { key: "baseline_cutoff", label: "Current cut-off", value: 620, min: 500, max: 800 },
        { key: "cutoff", label: "Proposed cut-off", value: 590, min: 500, max: 800, editable: true },
        { key: "lgd", label: "Loss given default", value: 45, unit: "%", min: 5, max: 100, editable: true },
      ],
    },
  ],
  "similar-portfolio-intelligence": [
    {
      key: "cafe-chain",
      title: "Find comparables for a café chain",
      entity: "Harbour Coffee Co. (fictional)",
      summary: "Underwriting wants the outcomes of the ten most similar historical loans.",
      synthetic: true,
      fields: [
        { key: "revenue_m", label: "Annual revenue", value: 2.4, unit: "m", min: 0.1, max: 50, editable: true },
        { key: "years", label: "Years in business", value: 5, unit: "yrs", min: 0, max: 40, editable: true },
        { key: "leverage", label: "Debt to equity", value: 1.6, unit: "×", min: 0, max: 6, editable: true },
        { key: "margin", label: "Net margin", value: 7, unit: "%", min: -30, max: 50, editable: true },
      ],
    },
    {
      key: "machine-shop",
      title: "Comparables for a leveraged machine shop",
      entity: "Ironbridge Fabrication (fictional)",
      summary: "A capital-heavy manufacturer with high leverage and thin margins.",
      synthetic: true,
      fields: [
        { key: "revenue_m", label: "Annual revenue", value: 6.8, unit: "m", min: 0.1, max: 50, editable: true },
        { key: "years", label: "Years in business", value: 12, unit: "yrs", min: 0, max: 40, editable: true },
        { key: "leverage", label: "Debt to equity", value: 3.9, unit: "×", min: 0, max: 6, editable: true },
        { key: "margin", label: "Net margin", value: 3, unit: "%", min: -30, max: 50, editable: true },
      ],
    },
  ],
  "rejection-intelligence": [
    {
      key: "trading-history",
      title: "Relax the trading-history rule",
      entity: "Synthetic declines · last quarter (300)",
      summary: "How many declined applicants failed only on minimum months trading?",
      synthetic: true,
      fields: [{ key: "relax", label: "Rule to relax", value: "min_months_trading", editable: true, options: ["min_months_trading", "min_dscr", "max_leverage", "bureau_score"] }],
    },
    {
      key: "dscr-rule",
      title: "Relax the coverage rule",
      entity: "Synthetic declines · last quarter (300)",
      summary: "Would a softer DSCR threshold change outcomes meaningfully?",
      synthetic: true,
      fields: [{ key: "relax", label: "Rule to relax", value: "min_dscr", editable: true, options: ["min_months_trading", "min_dscr", "max_leverage", "bureau_score"] }],
    },
  ],
  "financial-analysis": [
    {
      key: "seasonal-retailer",
      title: "Two years of statements for a seasonal retailer",
      entity: "Lakeside Outdoor Supplies (fictional)",
      summary: "Strong summers, weak winters: what do the ratios say?",
      synthetic: true,
      fields: [
        { key: "revenue_prev", label: "Revenue (prior year)", value: 3.1, unit: "m", editable: true, min: 0, max: 100 },
        { key: "revenue", label: "Revenue (latest year)", value: 3.5, unit: "m", editable: true, min: 0, max: 100 },
        { key: "net_income", label: "Net income", value: 0.21, unit: "m", editable: true, min: -50, max: 50 },
        { key: "current_assets", label: "Current assets", value: 1.2, unit: "m", editable: true, min: 0, max: 100 },
        { key: "current_liabilities", label: "Current liabilities", value: 0.95, unit: "m", editable: true, min: 0.01, max: 100 },
        { key: "total_debt", label: "Total debt", value: 1.4, unit: "m", editable: true, min: 0, max: 100 },
        { key: "equity", label: "Equity", value: 1.1, unit: "m", editable: true, min: 0.01, max: 100 },
        { key: "ebit", label: "EBIT", value: 0.38, unit: "m", editable: true, min: -50, max: 50 },
        { key: "interest", label: "Interest expense", value: 0.11, unit: "m", editable: true, min: 0.001, max: 50 },
      ],
    },
    {
      key: "stretched-distributor",
      title: "A distributor under liquidity pressure",
      entity: "Meridian Wholesale (fictional)",
      summary: "Growing fast, but short-term obligations are piling up.",
      synthetic: true,
      fields: [
        { key: "revenue_prev", label: "Revenue (prior year)", value: 8.2, unit: "m", editable: true, min: 0, max: 100 },
        { key: "revenue", label: "Revenue (latest year)", value: 10.9, unit: "m", editable: true, min: 0, max: 100 },
        { key: "net_income", label: "Net income", value: 0.12, unit: "m", editable: true, min: -50, max: 50 },
        { key: "current_assets", label: "Current assets", value: 2.1, unit: "m", editable: true, min: 0, max: 100 },
        { key: "current_liabilities", label: "Current liabilities", value: 2.6, unit: "m", editable: true, min: 0.01, max: 100 },
        { key: "total_debt", label: "Total debt", value: 4.8, unit: "m", editable: true, min: 0, max: 100 },
        { key: "equity", label: "Equity", value: 1.3, unit: "m", editable: true, min: 0.01, max: 100 },
        { key: "ebit", label: "EBIT", value: 0.42, unit: "m", editable: true, min: -50, max: 50 },
        { key: "interest", label: "Interest expense", value: 0.31, unit: "m", editable: true, min: 0.001, max: 50 },
      ],
    },
  ],
  riva: [
    {
      key: "regulatory-return",
      title: "Map a core-banking extract to a regulatory template",
      entity: "Synthetic loan-book extract",
      summary: "Check required fields, types and duplicates before generating the return.",
      synthetic: true,
      fields: [
        { key: "loan_id", label: "Loan ID ← LN_REF", value: "LN-000481" },
        { key: "reporting_date", label: "Reporting date ← RPT_DT", value: "2026-09-30" },
        { key: "outstanding", label: "Outstanding amount ← BAL_AMT", value: "1250000.00" },
        { key: "currency", label: "Currency ← CCY", value: "USD" },
        { key: "sector_code", label: "Sector code ← (unmapped)", value: "" },
        { key: "maturity_date", label: "Maturity date ← MAT_DT", value: "30/09/2029" },
      ],
    },
    {
      key: "clean-mapping",
      title: "A fully mapped extract",
      entity: "Synthetic loan-book extract",
      summary: "Every required field is mapped with the right type.",
      synthetic: true,
      fields: [
        { key: "loan_id", label: "Loan ID ← LN_REF", value: "LN-000482" },
        { key: "reporting_date", label: "Reporting date ← RPT_DT", value: "2026-09-30" },
        { key: "outstanding", label: "Outstanding amount ← BAL_AMT", value: "84000.00" },
        { key: "currency", label: "Currency ← CCY", value: "EUR" },
        { key: "sector_code", label: "Sector code ← NACE", value: "C25.6" },
        { key: "maturity_date", label: "Maturity date ← MAT_DT", value: "2028-03-31" },
      ],
    },
  ],
  "document-intelligence": [
    {
      key: "supplier-invoice",
      title: "Extract and validate a supplier invoice",
      entity: "Synthetic invoice · Fictional Supplies GmbH",
      summary: "Classify the document, pull key fields and check the totals add up.",
      synthetic: true,
      fields: [],
      document:
        "INVOICE\nInvoice No: INV-2026-0912\nDate: 2026-09-14\nSupplier: Fictional Supplies GmbH\nBill to: Riverside Bakery Ltd (fictional)\nSubtotal: 4,200.00\nTax (20%): 840.00\nTotal due: 5,040.00\nPayment terms: 30 days",
    },
    {
      key: "mismatched-totals",
      title: "An invoice whose totals don't reconcile",
      entity: "Synthetic invoice · Example Traders Ltd",
      summary: "The total doesn't equal subtotal plus tax. Will validation catch it?",
      synthetic: true,
      fields: [],
      document:
        "INVOICE\nInvoice No: INV-2026-1044\nDate: 2026-10-02\nSupplier: Example Traders Ltd (fictional)\nBill to: Northwind Logistics (fictional)\nSubtotal: 1,900.00\nTax (20%): 380.00\nTotal due: 2,380.00\nPayment terms: 14 days",
    },
  ],
  "persona-newsroom": [
    {
      key: "cfo-brief",
      title: "Morning brief for a CFO",
      entity: "Synthetic news feed · 8 stories",
      summary: "Rank the day's stories for a finance-focused executive and draft a post.",
      synthetic: true,
      fields: [{ key: "persona", label: "Persona", value: "CFO", editable: true, options: ["CFO", "CRO", "CTO"] }],
    },
    {
      key: "cro-brief",
      title: "Risk-focused brief for a CRO",
      entity: "Synthetic news feed · 8 stories",
      summary: "Same feed, different lens.",
      synthetic: true,
      fields: [{ key: "persona", label: "Persona", value: "CRO", editable: true, options: ["CFO", "CRO", "CTO"] }],
    },
  ],
};

export const scenarioFor = (offering: string, key: string) => scenarios[offering]?.find((s) => s.key === key);
