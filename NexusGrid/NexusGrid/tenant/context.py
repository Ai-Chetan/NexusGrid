from contextvars import ContextVar


_current_tenant = ContextVar("current_tenant", default=None)
_current_tenant_db_alias = ContextVar("current_tenant_db_alias", default=None)
_current_request_id = ContextVar("current_request_id", default=None)


def set_current_tenant(tenant, db_alias=None):
    tenant_token = _current_tenant.set(tenant)
    alias_token = _current_tenant_db_alias.set(db_alias)
    return tenant_token, alias_token


def clear_current_tenant(tenant_token=None, alias_token=None):
    if alias_token is not None:
        _current_tenant_db_alias.reset(alias_token)
    else:
        _current_tenant_db_alias.set(None)

    if tenant_token is not None:
        _current_tenant.reset(tenant_token)
    else:
        _current_tenant.set(None)


def get_current_tenant():
    return _current_tenant.get()


def get_current_tenant_db_alias():
    return _current_tenant_db_alias.get()


def set_current_request_id(request_id: str | None):
    return _current_request_id.set(request_id)


def clear_current_request_id(token=None):
    if token is not None:
        _current_request_id.reset(token)
    else:
        _current_request_id.set(None)


def get_current_request_id():
    return _current_request_id.get()
