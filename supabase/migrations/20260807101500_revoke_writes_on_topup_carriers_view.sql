-- Close a write hole on v_pos_topup_carriers (created in 20260806093800_pos_phase4_views.sql).
--
-- That view selects one table with a plain WHERE, which makes it auto-updatable, and
-- Supabase's default privileges on `public` already grant `authenticated` INSERT,
-- UPDATE and DELETE. The phase 4 migration revoked `anon` only. Because the view is
-- `security_invoker = false`, a write through it runs as the view's owner and passes
-- straight through RLS on topup_carriers.
--
-- What that allowed: staff editing `commission_rate`, which rpc_create_sale reads to
-- derive unit_cost on every top-up line — i.e. rewriting recorded cost and profit
-- without holding a single grant on the table.
--
-- Kept as its own migration rather than an edit to the phase 4 file so the applied
-- history and the files stay in step.

revoke all on public.v_pos_topup_carriers from anon, authenticated;
grant select on public.v_pos_topup_carriers to authenticated;
