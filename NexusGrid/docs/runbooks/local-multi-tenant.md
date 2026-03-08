# Local Multi-Tenant Validation Runbook

This runbook validates DB-per-tenant provisioning, RBAC sync, and feature gating in a local-first setup.

## Prerequisites

- PostgreSQL running locally.
- Control-plane DB configured via `DATABASE_URL`.
- Local host routing enabled in Django settings (`*.localtest.me`).
- Python dependencies installed from `requirements.txt`.
- Frontend dependencies installed in `frontend/`.

## 1. Baseline Health Checks

```powershell
python manage.py check
python manage.py migrate
```

Expected:
- `System check identified no issues`.
- Migrations apply cleanly.

## 2. Seed RBAC and Features (Control Plane)

```powershell
python manage.py seed_rbac_permissions --database default
python manage.py seed_feature_catalog
```

Expected:
- RBAC permissions/roles are created or updated idempotently.
- Feature catalog command reports success without duplicate failures.

## 3. Provision a Tenant Database

```powershell
python manage.py provision_tenant ^
  --slug acme-local ^
  --name "ACME Local" ^
  --domain acme.localtest.me:5173 ^
  --db-name nexusgrid_tenant_acme_local ^
  --db-user nexusgrid_tenant_acme_local ^
  --db-password "ChangeMe123!" ^
  --admin-username acmeadmin ^
  --admin-email admin@acme.local ^
  --admin-password "AdminPass#123" ^
  --package starter
```

Expected:
- Tenant row created in control plane.
- Tenant DB/user created.
- Tenant migrations completed.
- Tenant superuser created.
- Provisioning command can be re-run safely (idempotent behavior for existing resources).

## 4. Sync Legacy User Roles into Canonical RBAC

```powershell
python manage.py sync_tenant_rbac --tenant acme-local
```

Expected:
- Existing tenant users with legacy `User.role` get canonical RBAC roles (for example `role.admin`).
- Re-running does not create duplicate memberships.

## 5. Validate Capabilities API

With backend running locally, call:

```text
GET /api/v1/auth/capabilities/
```

Expected response shape:

```json
{
  "tenant": {
    "slug": "acme-local",
    "name": "ACME Local"
  },
  "features": {
    "faults": true,
    "monitoring": false
  },
  "permissions": ["..."]
}
```

Validation points:
- `features` reflect package + overrides.
- `permissions` reflect RBAC grants for current user.

## 6. Validate Backend Feature Gates

- Call feature-protected endpoints with a user in tenant `acme-local`.
- Disable a feature through `TenantFeatureOverride` and retry the endpoint.

Expected:
- Enabled feature: endpoint succeeds (200/expected business response).
- Disabled feature: endpoint denied (permission failure).

## 7. Validate Frontend Route/Nav Gating

```powershell
cd frontend
npm run build
npm run dev
```

Open `http://acme.localtest.me:5173`.

Expected:
- Sidebar only shows modules enabled by capability flags.
- Feature-protected routes redirect/block when disabled.
- No forced logout unless API returns `401`.

## 8. Tenant Isolation Smoke Test

Provision a second tenant with a different DB name and domain, then compare:
- Capabilities output between tenants.
- Core resources (faults/requests/systems) created in one tenant are not visible in the other.

Expected:
- Data remains isolated per tenant DB alias.

## 9. Deprovision Lifecycle

```powershell
python manage.py deprovision_tenant --slug acme-local --drop-db --yes
```

Expected:
- Tenant status transitions to deleted state.
- Runtime DB and role are dropped when flags are provided.
- Control-plane audit trail remains available.

## Troubleshooting

- If migrations fail only on tenant DBs, verify historical migrations use `schema_editor.connection.alias` and avoid hardcoded `default`.
- If dynamic DB alias errors occur, verify the tenant DB config contains all required keys (`ENGINE`, `NAME`, `USER`, `PASSWORD`, `HOST`, `PORT`, `TIME_ZONE`, and option defaults).
- If a user lacks expected RBAC grants after provisioning, run `sync_tenant_rbac` for that tenant.
