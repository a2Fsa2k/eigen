"""
Simple request logger middleware.
"""
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("eigen-rag")
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        ms = (time.perf_counter() - start) * 1000
        logger.info(f"{request.method} {request.url.path} → {response.status_code} ({ms:.1f}ms)")
        return response
