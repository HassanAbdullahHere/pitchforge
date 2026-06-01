from datetime import datetime
from typing import Optional, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


# --- Auth Models ---

class GoogleAuthRequest(BaseModel):
    access_token: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: Optional[str] = None


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


class ProposalHistoryItem(BaseModel):
    id: UUID
    thread_id: str
    job_title: str
    platform: Optional[str] = None
    budget: Optional[str] = None
    fit_score: Optional[int] = None
    recommendation: Optional[str] = None
    quality_score: Optional[int] = None
    final_proposal: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HealthResponse(BaseModel):
    status: str
    db_connected: bool
    chromadb_connected: bool
    gemini_reachable: bool
