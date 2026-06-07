import pytest
from pydantic import ValidationError

from app.schemas import (
    FinalizeRequest,
    GenerateRequest,
    JobInputRequest,
    ProfileInput,
    ProfileProject,
    ProfileRates,
    RefineRequest,
)


def test_job_title_too_short():
    with pytest.raises(ValidationError):
        JobInputRequest(title="x", description="a" * 50)


def test_level_too_long():
    with pytest.raises(ValidationError):
        JobInputRequest(title="ok title", description="a" * 50, level="x" * 51)


def test_thread_id_max_64_generate():
    with pytest.raises(ValidationError):
        GenerateRequest(thread_id="x" * 65, should_apply=True)


def test_thread_id_max_64_refine():
    with pytest.raises(ValidationError):
        RefineRequest(thread_id="x" * 65, instruction="valid instruction here")


def test_thread_id_max_64_finalize():
    with pytest.raises(ValidationError):
        FinalizeRequest(thread_id="x" * 65)


def test_profile_skills_over_limit():
    with pytest.raises(ValidationError):
        ProfileInput(title="Dev", bio="a" * 10, skills=["skill"] * 61, rates=ProfileRates())


def test_profile_skill_item_too_long():
    with pytest.raises(ValidationError):
        ProfileInput(title="Dev", bio="a" * 10, skills=["x" * 101], rates=ProfileRates())


def test_profile_projects_over_limit():
    projects = [ProfileProject(name="P", description="D")] * 21
    with pytest.raises(ValidationError):
        ProfileInput(title="Dev", bio="a" * 10, skills=["ok"], projects=projects, rates=ProfileRates())
