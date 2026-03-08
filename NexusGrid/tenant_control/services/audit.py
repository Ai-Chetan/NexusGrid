from tenant_control.models import AuditEvent
from NexusGrid.tenant.context import get_current_request_id, get_current_tenant


def record_audit_event(
    *,
    category: str,
    action: str,
    source: str = "system",
    tenant=None,
    actor_user=None,
    actor_user_id=None,
    actor_username: str = "",
    object_type: str = "",
    object_id: str = "",
    payload: dict | None = None,
    request_id: str | None = None,
):
    tenant_obj = tenant or get_current_tenant()
    user_obj = actor_user

    resolved_actor_id = actor_user_id
    resolved_actor_username = (actor_username or "").strip()

    if user_obj is not None:
        resolved_actor_id = getattr(user_obj, "id", resolved_actor_id)
        resolved_actor_username = resolved_actor_username or getattr(user_obj, "username", "")

    AuditEvent.objects.create(
        tenant=tenant_obj,
        category=category,
        action=action,
        actor_user_id=resolved_actor_id,
        actor_username=resolved_actor_username,
        request_id=request_id or (get_current_request_id() or ""),
        source=source,
        object_type=object_type,
        object_id=str(object_id or ""),
        payload=payload or {},
    )
