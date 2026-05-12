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
| Retrieval | Hybrid BM25 + ChromaDB vector, RRF fusion, FlashRank re-ranking |
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
| ✅ | Node 7 — compiler (returns proposal_draft as final_proposal, no wrapper) |
| ✅ | graph.py — full StateGraph wiring |
| ✅ | backend runner.py — async SSE streaming via `astream_events` |
| ✅ | backend schemas.py |
| ✅ | backend routers/proposals.py + main.py |
| ✅ | Frontend: Landing page (`/`) |
| ✅ | Frontend: Job Details form (`/new`) — with enhanced validation |
| ✅ | Frontend: Analysis Pipeline page (`/analyze`) — animated pipeline + fit score result |
| ✅ | Frontend: Generate Proposal page (`/generate`) — token streaming + approve/revise flow |

## Token Cost Profile
Gemini 2.5 Flash — non-thinking mode (`thinking_budget=0` on all nodes):
- Input: $0.075/1M tokens · Output: $0.30/1M tokens
- Typical run (2 auto-iterations): ~$0.0013
- Worst-case auto run (3 iterations): ~$0.0019
- With 2 human revisions: ~$0.0027

Key optimisations in place: thinking disabled, per-node output caps, critic no longer receives profile chunks (saves ~1,800 tokens/critic call).

---

## How to Run
```bash
# One-time RAG setup
cd pitchforge && uv run setup_rag.py

# LangGraph pipeline (direct)
cd pitchforge && uv run main.py

# FastAPI backend (must use uv)
cd backend && uv run uvicorn app.main:app --reload

# Frontend dev server
cd frontend && npm run dev
```

## Environment
`pitchforge/.env` → `GEMINI_API_KEY=your_key_here`
