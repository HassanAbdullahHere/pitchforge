from fastapi import APIRouter, HTTPException

from backend.app.schemas import (
    JobInputRequest,
    FitReportResponse,
    GenerateRequest,
    ProposalResponse,
    RefineRequest,
    FinalizeRequest,
    FinalResponse,
)
from backend.app.runner import run_analysis, run_generation, run_revise, run_finalize

router = APIRouter(prefix="/proposal", tags=["proposals"])


@router.post("/analyze", response_model=FitReportResponse)
def analyze(job: JobInputRequest) -> FitReportResponse:
    try:
        result = run_analysis(job.model_dump())
        return FitReportResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate", response_model=ProposalResponse)
def generate(body: GenerateRequest) -> ProposalResponse:
    try:
        result = run_generation(body.thread_id, body.should_apply)
        if not result.get("proposal_draft"):
            raise HTTPException(status_code=400, detail="User cancelled")
        return ProposalResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/revise", response_model=ProposalResponse)
def revise(body: RefineRequest) -> ProposalResponse:
    try:
        result = run_revise(body.thread_id, body.instruction)
        return ProposalResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/finalize", response_model=FinalResponse)
def finalize(body: FinalizeRequest) -> FinalResponse:
    try:
        result = run_finalize(body.thread_id)
        return FinalResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
