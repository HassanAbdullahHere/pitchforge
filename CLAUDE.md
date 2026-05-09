# PitchForge — Claude Code Context

## What This Is
AI pipeline that takes a job posting (Upwork, Freelancer, etc.) and produces a personalized proposal. Uses RAG to pull relevant experience, scores job fit, generates a draft, critiques and refines in a loop, then outputs a final approved proposal.

---

## Monorepo Structure
```
PitchForge/
├── pitchforge/   # LangGraph core pipeline  → see pitchforge/CLAUDE.md
├── backend/      # FastAPI middle layer      → see backend/CLAUDE.md
├── frontend/     # React + Vite UI           → see frontend/CLAUDE.md
└── CLAUDE.md
```

---

## Stack
| Layer | Tech |
|-------|------|
| Orchestration | LangGraph |
| LLM | Gemini 2.5 Flash |
| Embeddings | Google gemini-embedding-2-preview |
| Vector store | ChromaDB (local, persistent) |
| LLM wrapper | LangChain Google GenAI |
| Backend | FastAPI |
| Frontend | React 18 + Vite |
| Dependency mgmt | uv (Python), npm (JS) |

---

## Pipeline Flow
```
analyzer → retriever → scorer → fit_checkpoint
                                      ↓
                             [interrupt: apply? y/n]
                              /               \
                            "n"              "y"
                             ↓                ↓
                            END           generator → critic
                                               ↓
                               score>=70 OR iter>=3 OR is_human_revision?
                                /                          \
                              YES                          NO
                                ↓                          ↓
                         human_checkpoint             generator (loop)
                                ↓
                   [interrupt: "y" approve or type feedback]
                    /                        \
                  "y"                   feedback text
                    ↓                        ↓
                   END              generator → critic → human_checkpoint
                                         ← loop repeats ←
```

---

## State Schema
```python
class PitchforgeState(TypedDict):
    job_posting: str
    job_analysis: dict
    profile_matches: list
    proposal_draft: str
    critic_feedback: str
    iteration_count: int
    quality_score: int
    fit_score: int
    suggested_price: str
    matched_skills: list
    missing_skills: list
    clarifying_questions: list
    final_proposal: str
    should_apply: bool
    human_approved: bool
    human_feedback: str
    is_human_revision: bool
    client_info: Optional[str]  # not yet used
```

---

## Build Status
| Status | Item |
|--------|------|
| ✅ | Nodes 1–6 (analyzer, retriever, scorer, fit_checkpoint, generator, critic, human_checkpoint) |
| ✅ | graph.py — full StateGraph wiring |
| ✅ | backend runner.py + schemas.py |
| ⬜ | Node 7 — final compiler |
| ⬜ | backend routers/proposals.py + main.py |
| ⬜ | Frontend pages beyond landing |

---

## How to Run
```bash
# One-time RAG setup
cd pitchforge && uv run setup_rag.py

# LangGraph pipeline (direct)
cd pitchforge && uv run main.py

# FastAPI backend
cd backend && uvicorn app.main:app --reload

# Frontend dev server
cd frontend && npm run dev
```

## Environment
`pitchforge/.env` → `GEMINI_API_KEY=your_key_here`
