-- v_sf_order_devices is auto-updatable and runs with definer rights (security_invoker = false),
-- so a write through it would bypass the owner-only RLS on device_units and defeat the
-- status = 'in_stock' guard in rpc_update_sf_order. Reads only; every write goes through the RPC.
--
-- The privileges being revoked here were never granted by hand — they come from Supabase's
-- default privileges on the public schema, which apply to every newly created object.
revoke insert, update, delete, truncate, references on public.v_sf_order_devices from authenticated;
