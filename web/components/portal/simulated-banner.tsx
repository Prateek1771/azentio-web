import { FlaskConical } from "lucide-react";

// Mandatory label on every sandbox surface (brief §05: label sample data and simulated outputs).
export function SimulatedBanner() {
  return (
    <div role="note" className="flex items-start gap-3 rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <strong>Sandbox · synthetic data · simulated output.</strong> Nothing here is an approved credit or business
        decision. Use fictional examples only.
      </p>
    </div>
  );
}
