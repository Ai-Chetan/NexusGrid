# NexusGrid Developer README

This repository contains a Django REST backend and a React + Vite frontend for the NexusGrid lab operations platform.

## Architecture Overview

- Backend: Django, Django REST Framework, session authentication, and CORS support.
- Frontend: React, TypeScript, Vite, React Router, TanStack Query, Zustand, Tailwind CSS.
- Core apps:
  - `login_manager` for the custom user model and roles.
  - `system_layout` for buildings, floors, rooms, systems, labs, assignments, and config.
  - `monitoring` for telemetry ingest, health state, and current snapshots.
  - `faults` for fault reports.
  - `resources` for resource requests.
  - `api_v1` for the public API surface.

## Prerequisites

- Python 3.x with virtual environment support.
- Node.js and npm for the frontend.
- PostgreSQL or another database supported by `DATABASE_URL`.
- Optional Redis for cache/session improvements.

## Local Setup

### Backend

1. Create and activate a Python virtual environment.
2. Install dependencies with `pip install -r requirements.txt`.
3. Set the required environment variables.
4. Run migrations with `python manage.py migrate`.
5. Create a superuser with `python manage.py createsuperuser`.
6. Start the backend with `python manage.py runserver`.

### Frontend

1. Change into the frontend directory.
2. Install dependencies with `npm install`.
3. Start the dev server with `npm run dev`.
4. Build for production with `npm run build`.

## Required Environment Variables

The backend reads configuration from `.env`.

- `SECRET_KEY`
- `DEBUG`
- `DATABASE_URL`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `USE_REDIS` if Redis is available
- `REDIS_HOST` and `REDIS_PORT` if Redis is used

Important notes:

- `SECRET_KEY` has no default and must be set.
- `DATABASE_URL` is required because the settings build the default database from it.
- When the frontend is hosted separately, cross-site session auth requires the configured CORS and CSRF origins to match the deployment URLs.

## Build And Deployment

The repository includes a `build.sh` script for Unix-like deployment environments. It:

- Installs Python dependencies.
- Runs `python manage.py collectstatic --noinput`.
- Runs offline compression when the `compress` management command is available.

For Windows or manual deployment, run the same steps directly.

## Key API Areas

The main API prefix is `api/v1/`.

- Auth: login, logout, register, OTP signup, forgot password, me.
- Dashboard: metrics and filtered summaries.
- Layout: layout items, breadcrumbs, systems, labs.
- Faults: list and detail views.
- Resources: list and detail views.
- Reports: reports, maintenance summary, replacement costs, PC status.
- Admin: staff activity, task sheet, budget summary.
- Monitoring: current monitoring view, history, uptime, analytics, config.
- Users: user list, create, detail, privileges stats, assignments, privileges config.
- Profile: update and delete account.

The monitoring ingest API lives under `api/` and serves the remote agent.

## Monitoring Agent

The agent code is in `monitoring/script.py`.

- It collects system telemetry with `psutil`.
- It includes CPU, memory, disk, network, process, uptime, and GPU data when available.
- It posts data to the ingest endpoint.
- It can be distributed through the downloadable agent and installer endpoints.

## Data Model Highlights

- `login_manager.User` is the custom auth model with role support.
- `system_layout.LayoutItem` stores the hierarchical lab layout tree.
- `system_layout.Lab` stores room-level lab metadata.
- `system_layout.System` links assets to layout items and lab context.
- `system_layout.LabAssignment` stores incharge and assistant assignments.
- `system_layout.PrivilegesConfig` stores assignment limits.
- `system_layout.MonitoringConfig` stores monitoring thresholds and retention.
- `monitoring.SystemInfo` stores historical telemetry snapshots.
- `monitoring.SystemCurrent` stores the latest known state for each host.
- `faults.FaultReport` stores issue reports and resolution details.
- `resources.ResourceRequest` stores request and provisioning workflow data.
- `api_v1.Notification` stores user notifications and system/admin alerts.

## Frontend Routes

- Public: landing, login, signup.
- Protected app: dashboard, layout, faults, resources, reports, monitoring, system detail, users, admin settings, profile.
- Role-gated routes are enforced in the client router, with backend permissions still expected to protect the API.

## Development Notes

- The backend is session-authenticated by default.
- Most API responses are JSON-only.
- `api_v1` is the main integration surface for the React app.
- `monitoring` includes the ingest and status endpoints used by remote hosts.
- Many list views rely on query annotations, prefetching, and cached queries, so preserve those patterns when extending endpoints.

## Suggested Workflow For Changes

1. Update the model or serializer first.
2. Adjust the view logic and permission checks.
3. Update frontend API calls and route-level UI.
4. Run migrations if the data model changed.
5. Rebuild the frontend and verify the changed screens.

## Useful Commands

- `python manage.py runserver`
- `python manage.py migrate`
- `python manage.py createsuperuser`
- `python manage.py collectstatic --noinput`
- `npm run dev` from `frontend/`
- `npm run build` from `frontend/`

## Notes For Future Contributors

- Keep the role model and API permissions aligned.
- Preserve the layout hierarchy rules when adding new item types.
- Preserve the telemetry ingest shape unless the agent and dashboard are updated together.
- Use the same session-based auth and CSRF flow expected by the current frontend.