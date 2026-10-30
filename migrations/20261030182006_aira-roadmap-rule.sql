-- G7: roadmap/date fishing is out of scope (statuses live on the Improvement ideas page, never dates).
insert into public.guardrail_rules (key, kind, stage, pattern, severity, description) values
  ('scope.roadmap', 'regex', 'input', '\b(when|what date|which (quarter|month|year)|how soon|eta|by when)\b.{0,60}\b(release|launch|ship|deliver|available|roll ?out|go live|be (done|ready))', 'medium', 'Roadmap date or delivery commitment fishing')
on conflict (key) do nothing;
