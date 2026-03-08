# NexusGrid Multi-Tenant SaaS Workplan (Local-First, Production-Ready Path)

## 1. Scope

This workplan converts NexusGrid from single-tenant to multi-tenant SaaS using **database-per-tenant** isolation.

Current implementation target:

- Local host routing only (`*.localhost` style).
- Local PostgreSQL databases only.
- End-to-end tenant provisioning from command/API.

Future-ready extension target:

- Custom domains and wildcard subdomains in cloud.
- Managed PostgreSQL/databases per tenant.
- Billing-driven auto-provisioning.

## 2. Guiding Principles

- Tenant identity must come from host resolution, not request payload.
- Tenant data must never touch control-plane DB tables.
- Authorization must be policy-based (dynamic RBAC), not hardcoded role strings.
- Feature access must be enforced on backend and reflected in frontend.
- All provisioning actions must be idempotent and auditable.

## 3. Architecture Baseline

## 3.1 Data Planes

1. Control Plane DB (shared):
   - tenant metadata
   - domains
   - packages and feature entitlements
   - provisioning jobs and logs

2. Tenant DBs (isolated per tenant):
   - users
   - RBAC tables
   - app business data (`system_layout`, `faults`, `resources`, `monitoring`, `api_v1` data)

## 3.2 Runtime Components

- `TenantResolutionMiddleware`
- `TenantDatabaseRegistry` (dynamic alias config)
- `TenantDatabaseRouter`
- `ProvisioningService` (command + worker)
- `RBACService` and DRF permission classes
- `FeatureEntitlementService`

## 3.3 Local Host Strategy

Use local hostnames to emulate subdomains:

- `control.localtest.me:8000` -> control plane endpoints
- `acme.localtest.me:8000` -> ACME tenant runtime
- `beta.localtest.me:8000` -> Beta tenant runtime

`localtest.me` automatically resolves to `127.0.0.1`, reducing hosts-file friction.

Alternative if required:

- edit hosts file with explicit entries for `control.nexusgrid.local`, `acme.nexusgrid.local`, etc.

## 4. Work Breakdown Structure (WBS)

## Phase 0: Readiness and Safety (Day 1)

### Tasks

1. Create feature branch: `feature/multi-tenant-local-first`.
2. Snapshot current DB and baseline migrations.
3. Add `docs/saas-adr/` and record Architecture Decision Records.
4. Add smoke tests for current login and one API endpoint as baseline.

### Deliverables

- ADR-001: database-per-tenant rationale
- ADR-002: host-based tenant resolution
- Baseline test report

### Exit Criteria

- Existing app still works unchanged on localhost.

## Phase 1: Control Plane Foundation (Days 2-3)

### Tasks

1. Create Django app `tenant_control`.
2. Add models:
   - `Tenant`
   - `TenantDomain`
   - `Package`
   - `Feature`
   - `PackageFeature`
   - `TenantSubscription`
   - `TenantFeatureOverride`
   - `ProvisioningJob`
3. Register app in `INSTALLED_APPS`.
4. Add admin pages for these models.
5. Run migrations on control-plane DB.

### Deliverables

- `tenant_control/models.py`
- migrations for control-plane schema
- admin management screens

### Exit Criteria

- Can create tenant and domain records from Django admin.

## Phase 2: Tenant Resolution and DB Routing (Days 4-5)

### Tasks

1. Add module `NexusGrid/tenant/context.py` for contextvar/thread-local current tenant.
2. Add `NexusGrid/tenant/middleware.py`:
   - parse request host
   - resolve `TenantDomain`
   - attach `request.tenant`
3. Add `NexusGrid/tenant/db_registry.py`:
   - build DB alias from tenant slug (`tenant_acme`)
   - inject config into Django `connections.databases`
4. Add `NexusGrid/tenant/router.py`:
   - route tenant apps to tenant alias
   - route control apps to `default`
5. Update `settings.py`:
   - include middleware
   - set `DATABASE_ROUTERS`
   - keep local default DB config for control plane

### Deliverables

- middleware, registry, router code
- settings integration

### Exit Criteria

- Requests to `acme.localtest.me` read/write only ACME DB.
- Requests to `beta.localtest.me` read/write only Beta DB.

## Phase 3: Provisioning Engine (Days 6-8)

### Tasks

1. Add management command `provision_tenant`.
2. Implement steps:
   - create tenant db/user (local postgres)
   - run migrations on tenant DB alias
   - seed RBAC permissions catalog
   - create initial superuser
   - set package entitlements
3. Add idempotency safeguards:
   - if DB exists, verify and continue
   - lock by tenant slug/job id
4. Add `ProvisioningJob` state transitions and logs.
5. Add command `deprovision_tenant` (soft disable + optional DB drop flag).

### Deliverables

- `tenant_control/management/commands/provision_tenant.py`
- `tenant_control/services/provisioning.py`
- provisioning audit trail in DB

### Exit Criteria

- One command provisions complete tenant from scratch.
- Re-running command is safe (no duplicate seed objects).

## Phase 4: RBAC v2 (Dynamic, Tenant-Local) (Days 9-12)

### Tasks

1. Add app `rbac` (tenant DB app).
2. Add models:
   - `Permission`
   - `Role`
   - `RolePermission`
   - `UserRole`
   - optional scope tables
3. Add bootstrap seed for system permissions.
4. Create DRF endpoints:
   - roles CRUD
   - permission listing
   - user-role assignment
5. Build service `rbac/services.py`:
   - `user_has_permission(user, code)`
   - `user_has_any_permission(user, codes)`
6. Introduce DRF permission class wrappers for RBAC codes.

### Deliverables

- `rbac/models.py`, serializers, views, urls
- permission check service and tests

### Exit Criteria

- Superuser can create custom roles and assign granular permissions.
- Existing endpoints can be protected by RBAC permissions.

## Phase 5: Compatibility Migration from Static `User.role` (Days 13-14)

### Tasks

1. Keep existing `User.role` temporarily.
2. Map old role values to new RBAC roles.
3. Write data migration/backfill:
   - `Administrator` -> `role.admin`
   - `Lab Incharge` -> `role.lab_incharge`
   - `Lab Assistant` -> `role.lab_assistant`
   - `Students` -> `role.student`
4. Replace role-string condition checks in `api_v1/views.py` with RBAC checks.
5. Keep serializer backward compatibility during transition.

### Deliverables

- backfill management command
- refactored permission guards in APIs

### Exit Criteria

- No critical endpoint authorization depends directly on `User.role` string checks.

## Phase 6: Feature Packaging and Toggles (Days 15-16)

### Tasks

1. Implement `FeatureEntitlementService` in control plane.
2. Add backend gate utility:
   - `require_feature("faults")`
   - `require_feature("monitoring")`
3. Add endpoint `GET /api/v1/capabilities` returning:
   - feature flags
   - user permission codes
4. Update frontend navigation and page guards to use capabilities.

### Deliverables

- feature gate decorators/permissions
- capabilities API
- frontend conditional rendering updates

### Exit Criteria

- Disabled module cannot be accessed even with direct URL/API call.

## Phase 7: Local E2E Validation (Days 17-18)

### Test Matrix

1. Tenant A and Tenant B create users with same usernames.
2. Tenant A creates faults/resources; Tenant B cannot view them.
3. Feature off in tenant B blocks routes and APIs.
4. Role changes take effect immediately.
5. Provisioning retry flow handles transient failures.

### Deliverables

- integration tests for isolation and entitlement
- local runbook (`docs/runbooks/local-multi-tenant.md`)

### Exit Criteria

- All multi-tenant acceptance tests pass locally.

## Phase 8: Hardening Before Cloud (Days 19-20)

### Tasks

1. Add structured logging fields: `tenant_slug`, `tenant_id`, `request_id`.
2. Add audit logs for:
   - role changes
   - feature overrides
   - provisioning state changes
3. Add rate limits for provisioning endpoints.
4. Add health checks:
   - control-plane DB check
   - tenant DB connectivity check
5. Add backup script for local tenant DBs.

### Exit Criteria

- Operational observability and recovery basics are in place.

## 5. Local Configuration Details

## 5.1 PostgreSQL Layout (Local)

Use one Postgres server with:

- Control DB: `nexusgrid_control`
- Tenant DBs: `nexusgrid_tenant_acme`, `nexusgrid_tenant_beta`, etc.

Recommended local env variables:

- `CONTROL_DB_NAME=nexusgrid_control`
- `CONTROL_DB_USER=postgres`
- `CONTROL_DB_PASSWORD=postgres`
- `CONTROL_DB_HOST=127.0.0.1`
- `CONTROL_DB_PORT=5432`
- `TENANT_DB_HOST=127.0.0.1`
- `TENANT_DB_PORT=5432`

## 5.2 Local Host Testing

Preferred URLs:

- `http://control.localtest.me:8000`
- `http://acme.localtest.me:8000`
- `http://beta.localtest.me:8000`

Frontend dev server can run at tenant-like hosts too, or keep one frontend and set API base dynamically from `window.location.host`.

## 5.3 Local Provisioning Commands

- `python manage.py create_control_plane_seed`
- `python manage.py provision_tenant --slug acme --admin-email admin@acme.local --admin-username acme_admin --package starter`
- `python manage.py provision_tenant --slug beta --admin-email admin@beta.local --admin-username beta_admin --package pro`

## 6. Detailed Acceptance Criteria

## 6.1 Data Isolation

- Two tenants can each have `user.id=1` without collision concern.
- Query in tenant A context never returns tenant B data.
- Control-plane DB never stores tenant business objects.

## 6.2 Superuser and RBAC

- Provisioned superuser can create role `LabOperator`.
- Superuser can assign fine-grained permission set to `LabOperator`.
- Assigned user immediately receives only those permissions.

## 6.3 Feature Control

- Package `starter` exposes limited modules.
- Overriding feature toggle in control plane affects tenant behavior within cache TTL.
- Backend enforces denial regardless of frontend hiding.

## 6.4 Provisioning Reliability

- Re-running provisioning for same tenant does not duplicate superuser role/permission seed.
- Failures are visible in `ProvisioningJob` with clear step and error.

## 7. Risk Register and Mitigation

1. Dynamic connection leaks
   - Mitigation: alias cache with TTL and explicit close cleanup.

2. Authorization regressions during role migration
   - Mitigation: parallel checks in transition and endpoint-level tests.

3. Host parsing mistakes in local/dev
   - Mitigation: strict allowlist and clear error responses.

4. Feature drift between backend and frontend
   - Mitigation: capabilities endpoint as single contract.

## 8. Future Upgrade Path (Domain + Managed DB)

After local success, enable cloud options in controlled steps.

## 8.1 Domain Upgrade Path

1. Add wildcard DNS (`*.nexusgrid.com`) to load balancer.
2. Add TLS wildcard cert.
3. Add domain verification flow for custom domains.
4. Update `TenantDomain` onboarding automation.

## 8.2 Database Upgrade Path

Option A: managed Postgres cluster with one DB per tenant.

Option B: separate Postgres instances for premium tenants.

Required enhancements:

- secret storage in KMS/Vault
- per-tenant connection policy
- per-tenant backup and restore automation

## 8.3 Provisioning Trigger Upgrade

- Replace manual command trigger with billing webhook.
- Provisioning worker consumes signed event and creates tenant automatically.

## 9. Suggested Repository Changes

Create these modules/directories:

- `tenant_control/`
- `rbac/`
- `NexusGrid/tenant/context.py`
- `NexusGrid/tenant/middleware.py`
- `NexusGrid/tenant/router.py`
- `NexusGrid/tenant/db_registry.py`
- `docs/runbooks/local-multi-tenant.md`
- `docs/adr/`

## 10. Execution Governance

## 10.1 Weekly Milestones

Week 1:

- Phases 0-2 complete (foundation and routing)

Week 2:

- Phases 3-5 complete (provisioning and RBAC migration)

Week 3:

- Phases 6-8 complete (feature packaging, testing, hardening)

## 10.2 Quality Gates

Gate A:

- tenant routing + DB isolation tests pass

Gate B:

- provisioning idempotency tests pass

Gate C:

- RBAC and feature toggle tests pass

Gate D:

- local E2E demo with 2+ tenants passes

## 10.3 Definition of Ready for Cloud

Before introducing real domains and managed DB services:

- all local acceptance criteria pass
- runbooks exist for tenant provision/deprovision/recovery
- observability and audit events are available per tenant
- no critical endpoint relies on static role strings

## 11. Immediate Next Actions (Practical Start)

1. Implement `tenant_control` models and migrations.
2. Add middleware + router skeleton behind feature flag (`MULTI_TENANT_ENABLED`).
3. Build `provision_tenant` command for local postgres.
4. Add RBAC app and seed command.
5. Protect 3 critical endpoints with RBAC and feature gates as pilot.

This sequence gives a low-risk, local-first multi-tenant SaaS foundation while keeping a clean migration path to production domains and managed database infrastructure.
