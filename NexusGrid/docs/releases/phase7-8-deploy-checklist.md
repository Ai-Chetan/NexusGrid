# Phase 7-8 Deploy Checklist

Date: 2026-03-08
Branch: `feature/multi-tenant-local-first`

## 1. Pre-deploy

- Confirm target branch is up to date and CI checks pass.
- Confirm backup exists for control-plane DB and critical tenant DBs.
- Verify required env vars are set:
  - `MULTI_TENANT_ENABLED`
  - `MULTI_TENANT_BASE_DOMAIN`
  - `MULTI_TENANT_CONTROL_HOSTS`
  - `PROVISION_TENANT_RATE_LIMIT_SECONDS`
  - `DEPROVISION_TENANT_RATE_LIMIT_SECONDS`
  - `NEXUSGRID_REQUEST_LOG_LEVEL`
- Confirm Redis/cache configuration for throttling behavior in production (`USE_REDIS=true` recommended).

## 2. Database rollout

Run migrations:

```powershell
python manage.py migrate --noinput
```

Expected migrations in this release:

- `api_v1.0002_rename_api_v1_noti_recipie_b5ef40_idx_api_v1_noti_recipie_653b7c_idx_and_more`
- `tenant_control.0002_auditevent`

Validate migration cleanliness:

```powershell
python manage.py makemigrations --check --dry-run
```

Expected: `No changes detected`.

## 3. Post-deploy smoke checks

Run:

```powershell
python manage.py check
```

API health checks:

- `GET /api/v1/health/control/` -> 200 + `status=ok`
- `GET /api/v1/health/tenant/` -> 200 + `status=ok` (under tenant host)

Capability and gating checks:

- `GET /api/v1/auth/capabilities/` under two tenant hosts returns tenant-specific features/permissions.
- `GET /api/v1/rbac/permissions/` returns 403 for tenant with `rbac` feature disabled.

## 4. Observability checks

- Confirm request logs include:
  - `request_id`
  - `tenant_slug`
  - `tenant_id`
  - `status_code`
  - `duration_ms`
- Confirm `tenant_control_auditevent` receives events for:
  - provisioning/deprovisioning lifecycle
  - RBAC mutations
  - feature override changes

## 5. Backup and restore readiness

Backup script:

```powershell
./scripts/backup_tenant_db.ps1 -ConnectionString "<tenant_db_url>" -OutputFile "./backups/<tenant>-<date>.sql"
```

Restore script:

```powershell
./scripts/restore_tenant_db.ps1 -ConnectionString "<tenant_db_url>" -InputFile "./backups/<tenant>-<date>.sql"
```

## 6. Rollback guidance

- If app-level issue only: rollback app deployment first.
- If migration issue: restore from DB backup and redeploy previous stable app revision.
- Keep `MULTI_TENANT_ENABLED=false` as emergency fallback if needed.
