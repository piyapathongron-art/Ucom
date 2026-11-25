# Apply runbook: SF/consignment guards and RPC audit fixes (2026-11-25)

Two migrations, merged to `main` in PR #6 and PR #7. Neither has been applied to production yet. Both applied cleanly to a fresh Supabase in CI (PR #8): all 37 migrations, 26 pgTAP tests passing.

| Order | File | SHA-256 (as on `main`) |
|---|---|---|
| 1 | `supabase/migrations/20261125090000_sf_consign_device_guards.sql` | `37e75670347bb2c98e9f3f18ce88571af8a50e26bc0cf64c012cd60c2d838b3c` |
| 2 | `supabase/migrations/20261125120000_rpc_audit_fixes.sql` | `ebf8d8fb82d6df7e815f0922a9744f627f17e0f206324fd677d569bf46699155` |

Follow ADR 0008:
- **Never run `supabase db push`.** Production's migration history is shared with DailyGold and does not match this repo's filenames.
- Apply only these two files.
- Record only their two versions in the migration history.
- Read the result back afterwards.

## 0. Before anything

- [ ] **Merge PR #9** (stock form always sends qty). Without it, the stock form deployed from `main` omits an unchanged qty, and production's current `rpc_upsert_product` writes 0, so a product edit zeroes its stock. Apply migration 2 soon after, then restore the omission.
- [ ] **Take a fresh backup** of `public` and the schema history, the same way as the 2026-10-09 release (`docs/pos/release-line-daily-deposits-2026-10-09.md`). The free plan has no automatic daily backup (ADR 0009).
- [ ] **Confirm the project ref** in the dashboard URL is `bihgcdceovfettoxmgme`.

## 1. Read-only preflight (SQL editor)

Run these and keep the output with the release notes.

```sql
-- Server version (also tells us whether supabase/config.toml's major_version = 17 is right)
show server_version;

-- Neither migration is recorded yet
select version, name from supabase_migrations.schema_migrations
 where version in ('20261125090000', '20261125120000');

-- Rule from migration 1: unpaid SF devices with a cost, or with a missing / zero tag or shop price
select id, imei, model_name, status, cost, list_price, sale_price
  from public.device_units
 where acquisition = 'sf_credit' and sf_paid_full_at is null
   and (cost is not null or list_price is null or list_price <= 0 or sale_price <= 0);

-- Rule from migration 2: existing NaN values in any numeric column
do $$
declare r record; n bigint;
begin
  for r in select c.table_name, c.column_name from information_schema.columns c
             join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
            where c.table_schema = 'public' and t.table_type = 'BASE TABLE' and c.data_type = 'numeric'
  loop
    execute format('select count(*) from public.%I where %I = ''NaN''::numeric', r.table_name, r.column_name) into n;
    if n > 0 then raise notice '% .% has % NaN rows', r.table_name, r.column_name, n; end if;
  end loop;
end $$;

-- Cash book state (migration 2 changes the repair guard that applies once the book is open)
select epoch is not null as book_open, version, receiving_paused from public.ucom_cash_book;

-- Staff bills that would now be refused: queued sales older than 48 h are posted by the owner
select count(*) as sales_last_48h from public.sales where sold_at > now() - interval '48 hours';
```

**Stop and decide with the owner** if the SF query returns rows, or if the NaN block prints any notice. Neither migration changes existing values. The SF rows keep their cost, and NaN rows stay as they are until someone fixes them by hand.

## 2. Apply migration 1

In the SQL editor, paste the whole of `20261125090000_sf_consign_device_guards.sql` between these lines and run it as one script:

```sql
begin;
-- <paste the full file here>
insert into supabase_migrations.schema_migrations (version, name)
values ('20261125090000', 'sf_consign_device_guards');
notify pgrst, 'reload schema';
commit;
```

If any statement fails, the whole transaction rolls back and nothing changes.

## 3. Apply migration 2

Same wrapper, with `20261125120000_rpc_audit_fixes.sql`:

```sql
begin;
-- <paste the full file here>
insert into supabase_migrations.schema_migrations (version, name)
values ('20261125120000', 'rpc_audit_fixes');
notify pgrst, 'reload schema';
commit;
```

## 4. Read back

```sql
-- Both versions recorded
select version, name from supabase_migrations.schema_migrations
 where version in ('20261125090000', '20261125120000') order by version;

-- New triggers exist
select tgname, tgrelid::regclass from pg_trigger
 where tgname in ('device_units_guard_sf_unpaid_cost', 'sales_guard_sold_at');

-- NaN constraints were added (one per numeric column)
select count(*) from pg_constraint where conname like '%\_not\_nan' escape '\';

-- Function grants: authenticated may execute, anon may not
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('anon', p.oid, 'execute') as anon
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('rpc_upsert_device', 'rpc_receive_sf_order', 'rpc_update_sf_order',
                     'rpc_close_repair_job', 'rpc_upsert_product',
                     'pos_guard_sf_unpaid_cost', 'pos_sf_device_row_valid', 'pos_guard_sale_sold_at');
```

Expected results:
- 2 history rows.
- 2 triggers.
- The constraint count equals the number of numeric columns.
- The five `rpc_*` functions show authenticated = true and anon = false.
- The three helpers (`pos_guard_*`, `pos_sf_device_row_valid`) show false for both.

## 5. Smoke test in the shop (owner present)

- Stock: edit a product's name only. Its quantity must stay the same.
- Stock: open an SF device. The cost field is hidden and the explanation is shown.
- SF+: receive a bill with a tag price of 0. The form must refuse it.
- POS: scan an SF device. It must not go into the cart; staff choose ขายสด or ผ่อน SF on its card.
- Repairs: mark a test job ลูกค้าทิ้งเครื่อง. It must succeed.

## 6. After it is live

- Follow-up PR: the stock form sends `qty` only when it changed (undo PR #9's workaround).
- Record the applied versions, the hashes above, the backup file and the preflight output in a release note, as for 2026-10-09.
