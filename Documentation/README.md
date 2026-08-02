# NexusGrid

NexusGrid is a unified lab operations and monitoring platform for schools, colleges, and multi-lab environments. It combines live system monitoring, floor-plan based asset management, fault tracking, resource requests, reporting, notifications, and role-based access control in one web application.

The goal of NexusGrid is simple: help administrators, instructors, assistants, students, and stakeholders understand what is happening across every lab, respond faster when something breaks, and make better decisions with clear operational data.

## Who It Is For

- Administrators who need full oversight of labs, users, systems, faults, resources, and analytics.
- Lab Incharge users who manage lab operations and assignments.
- Lab Assistants who help monitor systems, handle requests, and keep labs running.
- Students who need a place to raise issues and request resources.
- Stakeholders and decision-makers who want a clear picture of infrastructure health, utilisation, and maintenance needs.

## What NexusGrid Solves

- Brings monitoring, asset mapping, reporting, and support workflows into one platform.
- Replaces scattered spreadsheets, manual follow-ups, and disconnected tools.
- Gives live visibility into system health and lab structure.
- Improves accountability with tracked fault and resource workflows.
- Supports faster decisions through dashboards, analytics, and exportable reports.

## Complete Feature List

### Public And Account Features

- Public landing page that introduces the platform and its value.
- Login and logout.
- New user registration.
- Signup OTP verification.
- Forgot password request and verification.
- Profile update.
- Account deletion.
- Session-based authentication with CSRF protection.
- Role-aware access control.

### Dashboard And Overview

- Role-aware dashboard experience.
- High-level fleet and lab metrics.
- Filters by building, floor, room, and date range.
- Real-time activity summaries.
- Quick links into systems, faults, resources, and reports.
- Visual charts for operational trends.

### Lab Layout And Asset Mapping

- Interactive hierarchy for buildings, floors, rooms, and systems.
- Drag-and-drop style layout management for lab planning.
- Breadcrumb navigation through the layout tree.
- Quick info for rooms and devices.
- System detail pages for individual assets.
- Live status overlays on mapped devices.
- Support for common lab asset types such as computers, servers, switches, routers, printers, UPS units, and racks.

### Monitoring And Health Tracking

- Agent-based telemetry collection from managed systems.
- Live system status updates.
- CPU metrics, including usage, cores, and frequency.
- Memory metrics, including total, used, available, swap, and percentage usage.
- Disk metrics, including total, used, free, read bytes, write bytes, and percentage usage.
- Network metrics, including bytes sent and received.
- Logged-in users and user counts.
- Top process snapshots.
- GPU availability and GPU statistics.
- Operating system and hardware metadata.
- Boot time and uptime tracking.
- Daily uptime tracking.
- Monitoring history.
- Monthly uptime view.
- Yearly, monthly, daily, and intraday analytics.
- Configurable monitoring thresholds and retention settings.
- Automatic online and offline state detection.

### Fault Management

- Fault creation for hardware, software, and network issues.
- System-linked fault reporting.
- Severity or risk factor assignment.
- Status workflow for unaddressed, in-progress, scheduled, resolved, and ignored faults.
- Resolution summary and resolution metadata.
- Fault detail views.
- Fault reporting pages.
- Maintenance summaries and PC status summaries.
- Replacement cost and maintenance reporting.

### Resource Requests

- Resource request creation.
- System-linked request tracking.
- Quantity and cost tracking.
- Fulfillment and denial workflow.
- Provision summary and fulfillment metadata.
- Resource detail views.

### Users, Roles, And Privileges

- Built-in roles for Administrator, Lab Incharge, Lab Assistant, Students, and No Roles.
- User list and user detail management.
- Admin user creation.
- User privilege statistics.
- Lab assignment management for incharges and assistants.
- Time-bounded lab assignments.
- Configurable assignment limits per role and per lab.
- User-role aware routing and visibility.

### Notifications And Alerts

- Notification inbox for users.
- Read and unread notification tracking.
- Mark-all-read support.
- Admin messages.
- System alerts.
- Notification links for related faults and resource requests.

### Reports And Administration

- Reports dashboard.
- Detailed report views.
- Staff activity reporting.
- Task sheet generation.
- Budget summary reporting.
- Maintenance and replacement-cost reporting.
- Admin settings for monitoring and privilege configuration.

### Remote Monitoring Agent

- Downloadable monitoring script for managed systems.
- Windows installer download endpoint.
- Linux installer download endpoint.
- Status endpoint for monitored hosts.
- Ingest endpoint for telemetry submission.

## Main User Flow

1. Sign in or create an account.
2. Open the dashboard to see the current state of the environment.
3. Drill into the layout to find buildings, rooms, and devices.
4. Check live system status and historical monitoring trends.
5. Report faults or request resources when needed.
6. Follow notifications and reports to see what changed and what was resolved.

## Why It Matters

NexusGrid is designed to reduce downtime, improve visibility, and make lab management easier to understand at a glance. For stakeholders, it shows operational maturity and measurable control. For users, it provides a clear place to report issues, request help, and follow the status of systems they depend on.

## Platform Notes

- Backend: Django and Django REST Framework.
- Frontend: React with Vite and TypeScript.
- Database-backed lab, fault, resource, monitoring, and user workflows.
- Designed for role-based access across the platform.

## Support And Contact

For assistance with NexusGrid, use the contact path provided by your deployment or organization.