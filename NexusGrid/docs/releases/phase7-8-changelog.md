# Phase 7-8 Changelog

Date: 2026-03-08

## Added

- Multi-tenant integration tests for host-based isolation:
  - capabilities isolation by host
  - faults/resources cross-tenant non-visibility
  - RBAC feature-gate denial path
- Health endpoints:
  - `/api/v1/health/control/`
  - `/api/v1/health/tenant/`
- Structured request-context middleware:
  - request ID generation/propagation (`X-Request-ID`)
  - JSON request-completion logs with tenant metadata
- Audit logging subsystem:
  - new `AuditEvent` control-plane model
  - audit capture for provisioning lifecycle, RBAC mutations, feature override changes
- Throttling:
  - OTP endpoint throttle classes
  - RBAC mutation endpoint throttles
  - command-level rate limits for `provision_tenant` and `deprovision_tenant`
- Backup and restore scripts:
  - `scripts/backup_tenant_db.ps1`
  - `scripts/restore_tenant_db.ps1`

## Changed

- Applied new migrations:
  - `api_v1.0002_rename_api_v1_noti_recipie_b5ef40_idx_api_v1_noti_recipie_653b7c_idx_and_more`
  - `tenant_control.0002_auditevent`
- Expanded runbooks:
  - `docs/runbooks/local-multi-tenant.md`
  - `docs/runbooks/backup-restore-tenant-db.md`
  - `docs/runbooks/phase7-8-validation-report.md`

## Validation

Executed successfully:

- `python manage.py check`
- `python manage.py makemigrations --check --dry-run`
- `python manage.py test api_v1 tenant_control faults resources login_manager monitoring system_layout rbac --keepdb --noinput`

## Known notes

- In this repository, unlabeled `manage.py test` may report zero tests; use explicit app labels for reliable suite execution.
- `staticfiles` warning can appear in tests when static root directory is absent; this is non-blocking for backend test results.
