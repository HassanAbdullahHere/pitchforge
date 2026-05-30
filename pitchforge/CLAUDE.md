# pitchforge/ — LangGraph Layer

## Files
```
pitchforge/
├── .env                    # Gitignored — copy from .env.example
├── .env.example            # GEMINI_API_KEY, DATABASE_URL_SYNC
├── __init__.py
├── main.py                 # CLI-only entry point — not used by the backend
├── graph.py                # StateGraph wiring — nodes, edges, checkpointer
├── state.py                # PitchforgeState TypedDict (17 fields)
├── setup_rag.py            # One-time script — embeds profile.json into profile_chunks table
├── nodes/
│   ├── analyzer.py         # Node 1 — job_posting → job_analysis
│   ├── retriever.py        # Node 2 — hybrid RAG → profile_matches
│   ├── scorer.py           # Node 3 — fit_score, suggested_price, matched/missing skills
│   ├── fit_checkpoint.py   # Node 3.5 — interrupt: should_apply y/n
│   ├── generator.py        # Node 4 — proposal_draft (human_feedback > critic_feedback)
│   ├── critic.py           # Node 5 — critic_feedback, quality_score (0-100)
│   ├── human_checkpoint.py # Node 6 — interrupt: y=approve, text=revise
│   └── compiler.py         # Node 7 — copies proposal_draft → final_proposal
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
is_human_revision OR quality_score >= 85 OR iteration_count >= 3 → human_checkpoint
otherwise → generator

# After human_checkpoint (Node 6)
human_approved=True  → compiler → END
human_approved=False → generator  (feedback stored in human_feedback)
```

---

## Retrieval Pipeline (Node 2)
Four-stage hybrid RAG:
1. **BM25** (`rank-bm25`) — keyword search, top-6 doc IDs
2. **pgvector** (`gemini-embedding-2-preview`, 3072-dim, cosine `<=>`) — semantic search, top-6 doc IDs
3. **RRF fusion** (k=60) — merges + deduplicates both ranked lists by rank position
4. **FlashRank** (`ms-marco-TinyBERT-L-2-v2`) — cross-encoder rescores fused candidates

Returns top-4 chunks as `profile_matches`. BM25 corpus lazy-loaded on first retrieval call. FlashRank model cached after first download (~3MB).

---

## LLM Configuration
Every `ChatGoogleGenerativeAI` instance must include both:
```python
thinking_budget=0       # non-negotiable — thinking mode costs 47x more
max_output_tokens=N
```

| Node | max_output_tokens |
|------|------------------|
| analyzer | 400 |
| scorer | 400 |
| generator | 700 |
| critic | 800 |

Token usage logged via `print()` after every `llm.invoke()` — **pending replacement with structlog**.  
Critic does NOT receive profile chunks — saves ~1,800 tokens/call.

---

## setup_rag.py
One-time (re-run after editing `profile.json`):
```bash
cd pitchforge && uv run python setup_rag.py
```
Uses `ON CONFLICT (id) DO UPDATE` — safe to re-run. Requires Docker + `alembic upgrade head` first.  
Uses `DATABASE_URL_SYNC` (psycopg2) — not the async URL.

---

## Rules
1. Never modify `state.py` without checking all nodes that read/write the changed key
2. Each node returns **only the keys it writes** — never full state
3. One node per file
4. `graph.py` owns all wiring — nodes, edges, checkpointer
5. `main.py` is CLI-only — no business logic, not imported by backend
6. Never remove `thinking_budget=0` or `max_output_tokens` from any LLM instance
7. Never hardcode `GEMINI_API_KEY` or `DATABASE_URL_SYNC`
8. Re-run `setup_rag.py` after any change to `profile/profile.json`
