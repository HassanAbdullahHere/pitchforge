from datetime import datetime
from typing import Annotated, Optional, Literal
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
    is_admin: bool = False


# --- Request Models ---

class JobInputRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    description: str = Field(..., min_length=50, max_length=8000)
    budget: str = Field("", max_length=30)
    timeline: str = Field("", max_length=20)
    level: str = Field("", max_length=50)
    platform: str = Field("", max_length=50)

class GenerateRequest(BaseModel):
    thread_id: str = Field(..., max_length=64)
    should_apply: bool


class RefineRequest(BaseModel):
    thread_id: str = Field(..., max_length=64)
    instruction: str = Field(..., min_length=5, max_length=2000)


class FinalizeRequest(BaseModel):
    thread_id: str = Field(..., max_length=64)


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


class ProposalDetailResponse(BaseModel):
    id: UUID
    thread_id: str
    job_title: str
    platform: Optional[str] = None
    budget: Optional[str] = None
    timeline: Optional[str] = None
    fit_score: Optional[int] = None
    suggested_price: Optional[str] = None
    matched_skills: Optional[list[str]] = None
    missing_skills: Optional[list[str]] = None
    recommendation: Optional[str] = None
    quality_score: Optional[int] = None
    iteration_count: Optional[int] = None
    final_proposal: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UsageResponse(BaseModel):
    used: int
    limit: int


class HealthResponse(BaseModel):
    status: str
    db_connected: bool
    pgvector_extension: bool


# --- Profile Models ---

class ProfileRates(BaseModel):
    hourly_min: int = Field(0, ge=0)
    hourly_max: int = Field(0, ge=0)
    fixed_min: int = Field(0, ge=0)


class ProfileProject(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: str = Field(..., min_length=1, max_length=1000)
    tech: list[str] = Field(default_factory=list)
    outcome: Optional[str] = Field(None, max_length=500)


_BoundedStr100 = Annotated[str, Field(min_length=1, max_length=100)]
_BoundedStr200 = Annotated[str, Field(min_length=1, max_length=200)]


class ProfileInput(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    bio: str = Field(..., min_length=10, max_length=1000)
    skills: list[_BoundedStr100] = Field(..., min_length=1, max_length=60)
    projects: list[ProfileProject] = Field(default_factory=list, max_length=20)
    experience: list[_BoundedStr200] = Field(default_factory=list, max_length=20)
    niches: list[_BoundedStr100] = Field(default_factory=list, max_length=20)
    rates: ProfileRates = Field(default_factory=ProfileRates)


class ProfileResponse(BaseModel):
    title: Optional[str] = None
    bio: Optional[str] = None
    skills: list[str] = Field(default_factory=list)
    projects: list[dict] = Field(default_factory=list)
    experience: list[str] = Field(default_factory=list)
    niches: list[str] = Field(default_factory=list)
    rates: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ResumeParseResponse(BaseModel):
    parsed: Optional[dict] = None
    error: Optional[str] = None


# --- Admin Models ---

class AdminPhaseBreakdown(BaseModel):
    phase: str
    total_input_tokens: int
    total_output_tokens: int
    total_cost_usd: float


class AdminDailyCount(BaseModel):
    date: str   # "YYYY-MM-DD"
    count: int


class AdminDailyCost(BaseModel):
    date: str
    cost_usd: float


class AdminBucket(BaseModel):
    label: str
    count: int


class AdminPlatformBreakdown(BaseModel):
    platform: str
    count: int


class AdminRecommendationBreakdown(BaseModel):
    recommendation: str
    count: int


class AdminStatsResponse(BaseModel):
    total_users: int
    total_proposals: int
    total_cost_usd: float
    proposals_today: int
    phase_breakdown: list[AdminPhaseBreakdown]
    avg_fit_score: Optional[float]
    avg_quality_score: Optional[float]
    avg_iterations: Optional[float]
    finalization_rate: float
    total_revisions: int
    daily_proposals: list[AdminDailyCount]
    daily_cost: list[AdminDailyCost]
    daily_signups: list[AdminDailyCount]
    fit_score_dist: list[AdminBucket]
    recommendation_breakdown: list[AdminRecommendationBreakdown]
    platform_breakdown: list[AdminPlatformBreakdown]
    iteration_dist: list[AdminBucket]


class AdminUserItem(BaseModel):
    id: UUID
    email: str
    name: str
    is_active: bool
    is_admin: bool
    created_at: datetime
    last_login_at: Optional[datetime]
    proposal_count: int
    total_cost_usd: float


class AdminUserPatch(BaseModel):
    is_active: bool
