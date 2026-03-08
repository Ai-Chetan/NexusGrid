# NexusGrid SaaS Multi-Tenant Conversion Plan

## 1. Objective and Constraints

Convert the existing single-tenant NexusGrid application into a SaaS platform with:

- Strict tenant data isolation using **database-per-tenant**.
- Automated buyer onboarding with database provisioning and first superuser bootstrap.
- Dynamic tenant-level RBAC (custom roles, granular permissions, user-role assignment).
- Package/feature control per tenant.

Current stack context (from codebase):

- Backend: Django 5.x + DRF + PostgreSQL (`psycopg2-binary`)
- Auth: Session auth + CSRF, custom user model (`login_manager.User`)
- Frontend: React + Vite
- Cache/queue candidate: Redis is already available in settings.

## 2. Target Architecture

### 2.1 Logical Components

1. **Control Plane (shared database)**
   - Tenant registry and domain mapping
   - Billing package/subscription records
   - Feature entitlements and overrides
   - Provisioning job state and audit

2. **Tenant Runtime (isolated tenant databases)**
   - Existing business data (`system_layout`, `faults`, `resources`, `monitoring`, etc.)
   - Tenant users and RBAC tables
   - Tenant-local activity/audit data

3. **Request Router Layer (in Django app)**
   - Tenant resolution from host/subdomain/custom domain
   - Dynamic database alias registration
   - Database router for app-level DB routing

4. **Provisioning Worker**
   - Creates DB/user
   - Runs migrations
   - Seeds baseline RBAC + superuser
   - Activates tenant

### 2.2 Isolation Model

- **Control-plane data** stays in `default` DB.
- **Tenant business/auth/RBAC data** stays in each tenant DB.
- No cross-tenant joins.
- No tenant identifier in shared business tables because isolation is physical (DB-level).

## 3. Tenant Identification and API Routing

### 3.1 Tenant Resolution Strategy

Primary approach:

- Production runtime requests use subdomains, e.g. `acme.nexusgrid.com`.
- Map `host -> tenant` through control-plane table `TenantDomain`.
- Optionally support custom domains (`ops.acme.edu`) via same table.

Resolution precedence:

1. Exact domain match in `TenantDomain`.
2. Subdomain extraction (`{slug}.nexusgrid.com`) fallback.
3. Reject unknown host (404 or 400 depending on policy).

### 3.2 Middleware Responsibilities

Create middleware (example path: `NexusGrid/tenant/middleware.py`) to:

- Read host via `request.get_host()`.
- Resolve tenant in control plane.
- Store tenant context in request + contextvar/thread-local.
- Register dynamic DB config for current tenant alias if not present.

Suggested request attributes:

- `request.tenant` -> control-plane tenant model
- `request.tenant_db_alias` -> database alias string

### 3.3 Database Router

Create router (example: `NexusGrid/tenant/router.py`):

- `db_for_read` and `db_for_write`:
  - Control-plane apps -> `default`
  - Tenant apps -> current tenant alias
- `allow_migrate`:
  - Control-plane apps migrate only on `default`
  - Tenant apps migrate on tenant aliases

Tenant-scoped apps in this project:

- `login_manager`
- `api_v1`
- `system_layout`
- `faults`
- `resources`
- `monitoring`

Control-plane apps (new):

- `tenant_control`
- optional `billing`, `saas_audit`

### 3.4 Security Rules for Tenant Resolution

- Derive tenant from host for runtime APIs.
- Do not trust `tenant_id` from body/query for runtime endpoints.
- Internal control-plane APIs may accept explicit tenant identifiers but must require strong admin/service auth.

## 4. Control-Plane Data Model (Shared DB)

Create app: `tenant_control` with these core models.

### 4.1 Core Models

- `Tenant`
  - `id`, `slug`, `name`, `status` (`provisioning|active|suspended|deleted`)
  - DB connection metadata (`db_name`, `db_host`, `db_port`, `db_user`, encrypted password)
  - `schema_version`, timestamps

- `TenantDomain`
  - `tenant` FK
  - `domain` unique
  - `is_primary`, `verified_at`

- `Package`
  - `code`, `name`, `description`, `is_active`

- `Feature`
  - `code` unique (e.g. `faults`, `monitoring`, `reports.advanced`)
  - `module_key`, `description`

- `PackageFeature`
  - `package` FK
  - `feature` FK
  - `enabled` bool

- `TenantSubscription`
  - `tenant` FK
  - `package` FK
  - `status`, `starts_at`, `ends_at`

- `TenantFeatureOverride`
  - `tenant` FK
  - `feature` FK
  - `enabled`

- `ProvisioningJob`
  - `tenant` FK
  - `state` (`pending|running|failed|completed`)
  - `step`, `error_payload`, timestamps

### 4.2 Secrets Handling

- Encrypt DB password before storing (Fernet/KMS/Vault-backed key).
- Decrypt only in runtime path that builds Django DB config.
- Never log raw credentials.

## 5. Automated Provisioning Flow

## 5.1 Trigger

Provisioning starts when payment/contract event is confirmed:

- Event source: billing webhook, admin panel action, or CRM integration.
- Create `Tenant` row with `status=provisioning`.
- Create `ProvisioningJob` row.

## 5.2 Worker Execution Steps

1. Acquire idempotency lock by tenant slug/job id.
2. Create PostgreSQL role/user for tenant DB.
3. Create PostgreSQL database.
4. Grant least-privilege rights on that DB.
5. Persist encrypted DB credentials into `Tenant` row.
6. Register temporary DB alias in Django process.
7. Run migrations against tenant alias.
8. Seed baseline data:
   - Initial superuser
   - Permission catalog
   - Optional starter roles
   - Feature cache baseline
9. Mark tenant `active`.
10. Send activation and credential-setup email.

## 5.3 Idempotency and Failure Recovery

- If DB exists, verify expected owner/permissions and continue.
- If migration fails:
  - mark job failed
  - include failed step and traceback summary
  - keep tenant in `provisioning_failed`
- Optional cleanup command to drop partial tenant DBs after manual approval.

## 5.4 Suggested Worker Technology

- Prefer Celery + Redis for retry, scheduling, and observability.
- Alternative: management command queue with cron if simpler bootstrap is needed.

## 5.5 Provisioning Management Command

Suggested command: `python manage.py provision_tenant --slug acme --email owner@acme.com --package pro`

Command responsibilities:

- Validate slug/domain uniqueness.
- Create tenant + domain record.
- Enqueue provisioning task.
- Return tracking id.

## 6. Tenant RBAC Design (Inside Tenant DB)

Current code uses static role choices in `login_manager.User.role`. Replace with dynamic RBAC while preserving compatibility during transition.

### 6.1 RBAC Tables

Add a new tenant-side app, e.g. `rbac`:

- `Permission`
  - `code` unique per tenant DB, e.g. `faults.view`, `faults.resolve`, `users.manage`
  - `module`, `action`, `description`

- `Role`
  - `name` unique
  - `is_system` (protected roles)
  - `created_by`, timestamps

- `RolePermission`
  - FK role
  - FK permission
  - unique constraint (`role`, `permission`)

- `UserRole`
  - FK user
  - FK role
  - unique constraint (`user`, `role`)

Optional for scoped permissions:

- `RoleScope` (`scope_type`: building/floor/lab/system, `scope_ref_id`)
- `UserRoleScope`

### 6.2 Superuser Rules

- First buyer user is created with tenant superuser role and `is_superuser=True`.
- Superuser can:
  - create/update/delete roles
  - map permissions to roles
  - assign users to roles
- Guardrails:
  - At least one superuser must exist
  - Prevent accidental removal of the last active superuser

### 6.3 Authorization Service Layer

Implement centralized checks instead of inline role comparisons:

- `has_permission(user, "faults.resolve")`
- `has_any_permission(user, [...])`
- DRF permission class wrapper for route-level use

This replaces hardcoded role checks currently present in `api_v1/views.py` and serializers.

### 6.4 Migration from Existing Static Roles

Phase migration:

1. Keep `User.role` field temporarily for compatibility.
2. Create RBAC tables and seed equivalent permissions for current roles.
3. Backfill user-role mapping from existing `User.role` values.
4. Replace API checks to RBAC service.
5. Deprecate and remove static role field after full adoption.

## 7. Feature Toggling and Packaging

### 7.1 Entitlement Sources

Effective feature state for a tenant should be resolved by precedence:

1. Tenant override (`TenantFeatureOverride`)
2. Active package mapping (`PackageFeature` via `TenantSubscription`)
3. Default off

### 7.2 Backend Enforcement

Create DRF feature gate permission/decorator:

- `@require_feature("faults")`
- `@require_feature("monitoring")`

Behavior:

- Return `403` for disabled feature on authenticated tenant.
- Optionally return `404` if you prefer opaque behavior.

### 7.3 Frontend Consumption

Add endpoint:

- `GET /api/v1/capabilities`

Response includes:

- enabled feature codes
- user permission codes

Frontend uses this to hide nav/pages/actions, but backend remains source of truth.

### 7.4 Caching

- Cache effective feature map by tenant for short TTL (e.g. 60s).
- Invalidate cache on subscription or override updates.

## 8. Django Settings and Runtime Changes

### 8.1 Settings Split

Current `DATABASES` uses single `DATABASE_URL`. Refactor to:

- `default`: control-plane DB
- dynamic aliases inserted at runtime for tenant DBs

Add:

- `DATABASE_ROUTERS = ["NexusGrid.tenant.router.TenantDatabaseRouter"]`
- tenant middleware in `MIDDLEWARE` before auth-dependent logic.

### 8.2 Session/Cookie Strategy

Given your current session auth with CSRF:

- Prefer host-only cookies per tenant subdomain for strict isolation.
- For shared auth domain, enforce tenant consistency checks in session data.
- Keep CSRF trusted origins aligned with tenant domain policy.

### 8.3 Connection Pooling

DB-per-tenant increases connection cardinality.

Recommendations:

- Use PgBouncer in transaction pooling mode.
- Keep `CONN_MAX_AGE` conservative.
- Implement idle alias cleanup strategy if runtime aliases become very large.

## 9. API and Code Refactor Map for This Repository

Priority files based on current structure:

1. `NexusGrid/settings.py`
   - Add routers/middleware/config for control-plane + dynamic tenant DBs.

2. `NexusGrid/urls.py`
   - Keep runtime API stable, add control-plane admin/provision endpoints as separate namespace.

3. `login_manager/models.py`
   - Transition from static `role` enum to RBAC-backed role assignments.

4. `api_v1/views.py`
   - Replace direct role checks with `has_permission` and feature gates.

5. `api_v1/serializers.py`
   - Remove reliance on static `role` field in payload contracts.

6. Frontend `frontend/src/lib/apiClient.ts` and route guards
   - Tenant-aware host handling
   - Capabilities bootstrap and conditional navigation.

## 10. Rollout and Migration Strategy

### Phase 0: Foundation

- Add control-plane app and models.
- Add tenant resolver middleware and DB router behind feature flag.
- No production traffic change yet.

### Phase 1: Provisioning

- Implement provisioning command and worker.
- Provision internal sandbox tenant and run migrations.
- Add health checks and job audit endpoints.

### Phase 2: RBAC Core

- Add tenant-side RBAC models.
- Seed permission catalog.
- Build admin APIs for role/permission/user-role management.

### Phase 3: Compatibility Bridge

- Backfill existing users to RBAC roles from static role field.
- Route all authz checks through RBAC service layer.
- Keep old role field as read-only fallback.

### Phase 4: Feature Packaging

- Add package/feature mapping in control plane.
- Implement runtime feature gate checks and capability endpoint.
- Update frontend conditional rendering.

### Phase 5: Pilot and Hardening

- Onboard 1-2 pilot tenants.
- Validate backup/restore, observability, and support flows.
- Remove deprecated static role logic.

## 11. Testing Strategy

### 11.1 Unit Tests

- Tenant resolver host parsing
- DB router app routing
- RBAC permission evaluator
- Feature entitlement resolver precedence

### 11.2 Integration Tests

- Provision tenant end-to-end: create DB, migrate, seed superuser
- Login and basic operations isolated by tenant
- Cross-tenant isolation test (same user id in different DBs)
- Feature disabled path returns expected response

### 11.3 Security Tests

- Host header tampering
- Tenant mismatch attacks
- Privilege escalation attempts
- Last-superuser removal protections

### 11.4 Performance Tests

- Provisioning concurrency
- API latency under many tenant aliases
- Connection pool saturation and recovery behavior

## 12. Operations and SRE Checklist

- Per-tenant backup schedule and restore drill runbook
- Tenant lifecycle commands: suspend, resume, deprovision
- Schema version dashboard by tenant
- Alerting on failed provisioning jobs
- Audit log for role/permission and feature changes

## 13. Risks and Mitigations

1. **Connection explosion**
   - Mitigation: PgBouncer, capped workers, alias cleanup

2. **Authorization regression during migration**
   - Mitigation: dual-check transition window + regression tests

3. **Provisioning partial failures**
   - Mitigation: idempotent jobs + explicit rollback command

4. **Feature drift between frontend/backend**
   - Mitigation: backend enforcement mandatory, frontend only for UX

## 14. Implementation Backlog (Actionable)

1. Create `tenant_control` app + migrations.
2. Add tenant middleware + context manager.
3. Add DB router and dynamic alias registry utility.
4. Add provisioning models + command + worker task.
5. Add tenant-side `rbac` app + models + migrations.
6. Seed permissions command.
7. Build RBAC service and DRF permission classes.
8. Build feature entitlement service and decorators.
9. Add `/api/v1/capabilities` endpoint.
10. Refactor `api_v1` endpoints to use RBAC/feature gates.
11. Add end-to-end provisioning and isolation tests.
12. Pilot tenant rollout and observability dashboards.

## 15. Definition of Done

The SaaS conversion is complete when:

- Every buyer is provisioned into a dedicated PostgreSQL database.
- Runtime requests are correctly tenant-routed by domain/subdomain.
- Superuser can fully manage roles, permissions, and users within tenant DB.
- Feature access is controlled by package entitlements with backend enforcement.
- Cross-tenant data access is impossible by design and verified by tests.
- Provisioning, migrations, and operations runbooks are production-ready.
