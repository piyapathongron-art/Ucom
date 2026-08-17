-- Least-privilege cleanup: these five views carry INSERT/UPDATE/DELETE for `authenticated`
-- purely because Supabase's default privileges on the public schema grant them to every new
-- object. All five are non-updatable (join/aggregate), so Postgres rejects writes anyway --
-- this is hygiene, not a live hole. Same treatment v_sale_profit already received.
--
-- After this, no view in `public` grants a write privilege to `authenticated`.
revoke insert, update, delete, truncate, references on public.v_pos_catalog from authenticated;
revoke insert, update, delete, truncate, references on public.v_pos_stock from authenticated;
revoke insert, update, delete, truncate, references on public.v_pos_top_products from authenticated;
revoke insert, update, delete, truncate, references on public.v_sf_due from authenticated;
revoke insert, update, delete, truncate, references on public.v_topup_wallet_balance from authenticated;
