# pitchforge/ — LangGraph Layer

## Files
```
pitchforge/
├── .env                    # Gitignored — copy from .env.example
├── .env.example            # Template: GEMINI_API_KEY, DATABASE_URL
├── __init__.py             # Package marker — enables cross-directory imports
├── main.py                 # Entry point — collects input, runs graph, handles interrupt loop
├── graph.py                # StateGraph wiring — all nodes + edges + checkpointer
├── state.py                # PitchforgeState TypedDict
├── setup_rag.py            # One-time script — chunks profile.json, upserts embeddings into PostgreSQL profile_chunks
├── nodes/
│   ├── analyzer.py         # Node 1 — job_posting → job_analysis
│   ├── retriever.py        # Node 2 — hybrid BM25 + pgvector retrieval, RRF fusion, FlashRank re-ranking → profile_matches
│   ├── scorer.py           # Node 3 — fit_score, suggested_price, matched_skills, missing_skills
│   ├── fit_checkpoint.py   # Node 3.5 — interrupt: should_apply y/n
│   ├── generator.py        # Node 4 — proposal_draft (human_feedback > critic_feedback)
│   ├── critic.py           # Node 5 — critic_feedback, quality_score (0-100)
│   ├── human_checkpoint.py # Node 6 — interrupt: y=approve, text=feedback+revise
│   └── compiler.py         # Node 7 — returns proposal_draft as final_proposal
└── profile/profile.json    # Hassan's skills, projects, experience, rates
```

---

## Node I/O
| Node | Reads | Writes |
|------|-------|--------|
| 1 analyzer | job_posting | job_analysis |
| 2 retriever | job_analysis | profile_matches |
| 3 scorer | job_analysis, profile_matches | fit_score, suggested_price, matched_skills, missing_skills |
| 3.5 fit_checkpoint | fit_score, suggested_price, job_analysis | should_apply |
| 4 generator | job_analysis, profile_matches, fit_score, suggested_price, critic_feedback, human_feedback, iteration_count | proposal_draft, iteration_count |
| 5 critic | proposal_draft, job_analysis, iteration_count | critic_feedback, quality_score |
| 6 human_checkpoint | proposal_draft, quality_score, job_analysis, iteration_count | human_approved, human_feedback, is_human_revision |
| 7 compiler | proposal_draft | final_proposal |

---

## Conditional Edge Routing
```python
# After fit_checkpoint (Node 3.5)
should_apply=False → END
should_apply=True  → generator

# After critic (Node 5)
is_human_revision OR quality_score>=70 OR iteration_count>=3 → human_checkpoint
otherwise → generator

# After human_checkpoint (Node 6)
human_approved=True  → END
human_approved=False → generator  (feedback stored in human_feedback)
```

---

## Critic-Generator Loop
- Max 3 auto-iterations; escalates to human_checkpoint after
- `is_human_revision=True` permanently short-circuits the loop — every subsequent critic pass routes directly to human_checkpoint
- Generator prioritizes `human_feedback` over `critic_feedback`

---

## Retrieval Pipeline (Node 2)
Four-stage hybrid RAG — runs every time the graph hits the retriever node:
1. **BM25** (`rank-bm25`) — keyword search, finds exact word matches, returns top-6 doc IDs
2. **pgvector** (`gemini-embedding-2-preview`, 3072-dim) — semantic search, finds meaning matches, returns top-6 doc IDs
3. **RRF fusion** (k=60) — merges both ranked lists, deduplicates, scores by rank position
4. **FlashRank re-ranking** (`ms-marco-TinyBERT-L-2-v2`) — cross-encoder rescores all fused candidates
5. Returns top 4 re-ranked chunks as `profile_matches`

**BM25** and **pgvector** are complementary:
- BM25 wins when the job uses the exact same words as your profile (e.g. "FastAPI" → "FastAPI")
- pgvector wins when meaning matches but words differ (e.g. "automation tool" → "AI-powered CLI")

BM25 corpus is lazy-loaded from `SELECT id, text FROM profile_chunks ORDER BY id` on first retrieval call.
pgvector query uses cosine distance operator `<=>` — correct for Gemini's L2-normalized embeddings.
FlashRank model is downloaded on first run (~3MB) and cached by the library.

### setup_rag.py
Run once (or re-run after editing `profile.json`) to upsert embeddings into PostgreSQL:
```bash
cd pitchforge && uv run python setup_rag.py
```
Uses `ON CONFLICT (id) DO UPDATE` — safe to re-run, never creates duplicates.
Requires: Docker container running + `alembic upgrade head` already applied.

---

## Python Packaging
- `pitchforge/pyproject.toml` uses `setuptools` with `where = [".."]` — editable install adds `PitchForge/` to sys.path
- All internal imports: `from pitchforge.X import ...` (never bare `from X import`)
- `backend/` depends on this via `uv path source`

---

## LLM Configuration (all nodes)
Every `ChatGoogleGenerativeAI` instance must include:
```python
thinking_budget=0       # disables thinking mode — billed at $3.50/1M vs $0.075/1M
max_output_tokens=N     # per-node caps — see below
```

| Node | max_output_tokens | Reason |
|------|------------------|--------|
| analyzer | 400 | small JSON blob |
| scorer | 400 | small JSON blob |
| generator | 700 | 320-word proposal ≈ 430 tokens |
| critic | 800 | JSON with feedback — 600 caused truncation |

Token logging is active on all nodes — after every `llm.invoke()`:
```python
if hasattr(response, 'usage_metadata') and response.usage_metadata:
    print(f"[Node X] tokens — input: {response.usage_metadata.get('input_tokens')} | output: {response.usage_metadata.get('output_tokens')}")
```

---

## Critic Notes
- **Profile chunks are NOT passed to the critic** — saves ~1,800 tokens/call
- Feedback field is capped at 150 words in the prompt schema
- JSON parse handles both plain string and list-of-parts `response.content`

## Compiler Notes
- Node 7 returns `proposal_draft` as `final_proposal` with no wrapper
- The `=== PROPOSAL ===` header was removed — it was noise

---

## Rules
1. Build and test one node at a time
2. Never modify `state.py` without checking all existing nodes
3. Each node returns **only the keys it writes** — never full state
4. One node per file — single responsibility
5. `graph.py` owns all wiring — nodes, edges, checkpointer
6. `main.py` is only the entry point — no business logic
7. Never remove `thinking_budget=0` or `max_output_tokens` from any LLM instance
8. Never hardcode `GEMINI_API_KEY` — always use `os.getenv("GEMINI_API_KEY")`
9. Never hardcode `DATABASE_URL` — always use `os.environ["DATABASE_URL"]`
10. `setup_rag.py` must be re-run after any change to `profile/profile.json`
