from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

app = FastAPI(
    title="PostgreSQL Data Lineage & FDW Visualizer",
    version="1.0.0",
    description="Automated cross-database data lineage discovery via postgres_fdw and pg_hba rules"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
def root():
    return {
        "message": "PostgreSQL Data Lineage API is running",
        "docs": "/docs",
        "health": "/api/health"
    }
