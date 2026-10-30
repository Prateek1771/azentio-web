-- Publishers keep the existing boundary (no org_private content), so they don't need org names.
drop policy if exists orgs_select_publisher on public.orgs;
