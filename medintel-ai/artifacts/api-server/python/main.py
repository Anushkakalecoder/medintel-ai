import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routes.upload import router as upload_router
from routes.chat import router as chat_router
from routes.documents import router as documents_router
from routes.analytics import router as analytics_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MedIntel AI API",
    description="Multi-Agent Clinical Intelligence Platform",
    version="1.0.0",
    root_path="/api",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    logger.info("Initializing database...")
    init_db()
    logger.info("MedIntel AI API started")


@app.get("/healthz")
async def health():
    return {"status": "ok", "version": "1.0.0"}


app.include_router(upload_router)
app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(analytics_router)
