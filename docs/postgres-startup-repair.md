# PostgreSQL listener missing after a VPS reboot

On 2026-11-06 at 03:14 IST, PostgreSQL started before Docker assigned
172.17.0.1. PostgreSQL logged `Cannot assign requested address`, continued
listening only on loopback, and left the API unable to connect to the database.
`SHOW listen_addresses` still included the address, and `/api/healthz` still
returned OK; neither check proved the bridge listener was working.

`scripts/deploy/repair-postgres-startup.sh` installs a cluster-specific systemd
drop-in ordering PostgreSQL after Docker, plus a bounded pre-start check for
the bridge address. It backs up existing configuration under
`/var/backups/rzfixer/postgres-startup-*`, reloads systemd, validates the unit,
and restarts only the PostgreSQL cluster if its bridge listener is missing.
It verifies the listener, application database readiness, public site status,
and Docker health. It never changes database data, authentication rules,
credentials, or the website availability setting.

Run the reviewed script as root on the VPS:

```bash
bash scripts/deploy/repair-postgres-startup.sh
```

The bootstrap script calls it with `--configure-only`, then applies and
verifies PostgreSQL's listener configuration itself. `PG_VERSION` and
`BRIDGE_GW` default to `16` and `172.17.0.1`.

The repair restores its previous drop-in and guard if installation or listener
recovery fails. Later application-check failures leave the recovered database
and startup protection in place for diagnosis. A failed application check must
not be reported as a fully successful recovery. No host reboot is performed;
the unit dependency graph and the actual service restart are checked instead.

## Production recovery verified on 2026-11-06

At approximately 17:19 IST, the repair installed the drop-in and address guard,
validated the systemd unit, and restarted only `postgresql@16-main.service`.
The configuration backup is
`/var/backups/rzfixer/postgres-startup-20261106-114859-391068` on the VPS.

Verified outcomes:

- PostgreSQL accepts connections on `172.17.0.1:5432` and still listens on loopback.
- The application database readiness command passed.
- All three production containers report healthy.
- The public `/api/site-status` returns HTTP 200 with `{"enabled":true}`.
- The homepage returns HTTP 200. Browser rendering was not verified because
  permission to open the browser preview was declined.
- The 33 targeted regression tests passed locally.

No host reboot, customer-data change, schema migration, or availability-setting
change was performed. The systemd repair was installed directly on the
production VPS; this repository records the repair and bootstrap prevention.

Targeted regression checks:

```bash
node --test scripts/ci/postgres-startup.test.mjs scripts/ci/deploy-contract.test.mjs
```
