from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AuthOtpAnonThrottle(AnonRateThrottle):
    scope = "auth_otp_anon"


class AuthOtpUserThrottle(UserRateThrottle):
    scope = "auth_otp_user"


class RbacMutationUserThrottle(UserRateThrottle):
    scope = "rbac_mutation_user"
