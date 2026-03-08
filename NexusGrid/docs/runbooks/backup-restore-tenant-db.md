# Tenant DB Backup and Restore Runbook

## Scope

This runbook covers local and ops-safe backup/restore for a single tenant database.

## Scripts

- Backup: `scripts/backup_tenant_db.ps1`
- Restore: `scripts/restore_tenant_db.ps1`

## Prerequisites

- PostgreSQL client tools are installed and available in PATH (`pg_dump`, `psql`).
- You have a valid PostgreSQL connection string for the target tenant DB.

## Backup Command

```powershell
./scripts/backup_tenant_db.ps1 `
  -ConnectionString "postgresql://tenant_user:tenant_password@127.0.0.1:5432/nexusgrid_tenant_acme_local" `
  -OutputFile "./backups/acme-local-20260308.sql"
```

Expected:
- SQL dump file exists at the output path.
- Script exits without errors.

## Restore Command

```powershell
./scripts/restore_tenant_db.ps1 `
  -ConnectionString "postgresql://tenant_user:tenant_password@127.0.0.1:5432/nexusgrid_tenant_acme_local" `
  -InputFile "./backups/acme-local-20260308.sql"
```

Expected:
- Restore completes without SQL errors.
- Tenant data is available in the target DB.

## Recommended Restore Safety Flow

1. Restore into a staging copy first.
2. Run application smoke checks (`/api/v1/health/tenant/` and key module list endpoints).
3. If valid, perform production restore in maintenance window.

## Post-Restore Validation

- `GET /api/v1/health/control/` returns `status=ok`.
- `GET /api/v1/health/tenant/` on tenant host returns `status=ok`.
- `GET /api/v1/auth/capabilities/` returns expected feature flags and permissions.
