import logging
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class RoleBasedAccessMiddleware(MiddlewareMixin):
    def process_request(self, request):
        if request.user.is_authenticated:
            roles = []
            if request.user.is_superuser:
                roles.append('superuser')
            if request.user.is_staff:
                roles.append('staff')
            roles.extend([g.name for g in request.user.groups.all()])

            logger.info(
                f"User {request.user.email} with roles {', '.join(roles)} "
                f"accessed {request.path}"
            )
