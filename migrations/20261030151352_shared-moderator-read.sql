-- Moderators handle reports on hidden (unpublished) copies, so they can read every shared copy.
create policy shared_select_moderator on public.shared_contributions for select to authenticated
  using (public.has_grant('moderate'));
