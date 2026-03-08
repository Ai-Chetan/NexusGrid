import json
import logging
import time
import uuid

from .context import clear_current_request_id, get_current_tenant, set_current_request_id


logger = logging.getLogger("nexusgrid.request")


class RequestContextLoggingMiddleware:
    """
    Attach request IDs and emit structured request-completion logs.

    Log payload fields include request_id, tenant_slug, tenant_id, method, path,
    status_code, duration_ms, user_id, and client_ip.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.monotonic()
        request_id = (request.headers.get("X-Request-ID") or "").strip() or str(uuid.uuid4())
        request.request_id = request_id
        req_token = set_current_request_id(request_id)

        response = None
        try:
            response = self.get_response(request)
            return response
        finally:
            duration_ms = round((time.monotonic() - start) * 1000, 2)
            tenant = get_current_tenant() or getattr(request, "tenant", None)
            user = getattr(request, "user", None)

            payload = {
                "event": "request_complete",
                "request_id": request_id,
                "tenant_slug": getattr(tenant, "slug", None),
                "tenant_id": getattr(tenant, "id", None),
                "method": request.method,
                "path": request.path,
                "status_code": getattr(response, "status_code", 500),
                "duration_ms": duration_ms,
                "user_id": getattr(user, "id", None) if getattr(user, "is_authenticated", False) else None,
                "client_ip": request.META.get("REMOTE_ADDR"),
            }
            logger.info(json.dumps(payload, separators=(",", ":"), default=str))

            if response is not None:
                response["X-Request-ID"] = request_id

            clear_current_request_id(req_token)
