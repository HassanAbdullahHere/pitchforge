from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routers.proposals import router as proposals_router

app = FastAPI(title="PitchForge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(proposals_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
