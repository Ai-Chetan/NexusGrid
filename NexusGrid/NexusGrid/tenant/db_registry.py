import re

from django.conf import settings
from django.db import connections


def _safe_alias_from_slug(slug: str) -> str:
    alias = re.sub(r"[^a-zA-Z0-9_]", "_", slug.strip().lower())
    if not alias:
        alias = "default_tenant"
    if alias[0].isdigit():
        alias = f"t_{alias}"
    return f"tenant_{alias}"


def register_tenant_database(tenant):
    """
    Dynamically register a Django DB alias for a tenant metadata record.

    This is intentionally local-first: defaults to non-SSL local Postgres unless
    a TENANT_DB_SSLMODE override is supplied.
    """
    alias = _safe_alias_from_slug(tenant.slug)
    if alias in connections.databases:
        return alias

    base_config = dict(connections.databases.get("default", {}))

    sslmode = getattr(settings, "TENANT_DB_SSLMODE", "")
    options = {}
    if sslmode:
        options["sslmode"] = sslmode

    # Copy default backend options so required keys (e.g. TIME_ZONE/AUTOCOMMIT)
    # remain present in dynamic aliases under Django 5.
    base_options = dict(base_config.get("OPTIONS", {}))
    if sslmode:
        base_options["sslmode"] = sslmode
    else:
        base_options.pop("sslmode", None)
    base_options.update(options)

    base_config.update({
        "ENGINE": "django.db.backends.postgresql",
        "NAME": tenant.db_name,
        "USER": tenant.db_user,
        "PASSWORD": tenant.db_password_ciphertext,
        "HOST": tenant.db_host,
        "PORT": str(tenant.db_port),
        "CONN_MAX_AGE": getattr(settings, "TENANT_CONN_MAX_AGE", 0),
        "OPTIONS": base_options,
    })

    connections.databases[alias] = base_config
    return alias
