from typing import Optional, Literal
from pydantic import BaseModel, Field


# --- Request Models ---

class JobInputRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=150)
    description: str = Field(..., min_length=150, max_length=8000)
    budget: str = Field("", max_length=30)
    timeline: str = Field("", max_length=20)
    level: str
    platform: str

class GenerateRequest(BaseModel):
    thread_id: str
    should_apply: bool


class RefineRequest(BaseModel):
    thread_id: str
    instruction: str


class FinalizeRequest(BaseModel):
    thread_id: str


class ReviseRequest(BaseModel):
    thread_id: str
    feedback: str


# --- Response Models ---

class FitReportResponse(BaseModel):
    thread_id: str
    fit_score: int
    suggested_price: str
    matched_skills: list[str]
    missing_skills: list[str]
    recommendation: Literal["Strong Apply", "Apply Carefully", "Not Recommended"]


class ProposalResponse(BaseModel):
    proposal_draft: str
    quality_score: int
    critic_feedback: Optional[str] = None
    iteration_count: int


class FinalResponse(BaseModel):
    final_proposal: str


class HealthResponse(BaseModel):
    status: str
    chromadb_connected: bool
    gemini_reachable: bool
