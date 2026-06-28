# PitchForge - Architecture Decision Records

---

## ADR 1 - Gemini 2.5 Flash with thinking disabled across all nodes

**Context**  
The pipeline runs 5 LLM calls per cycle, more with revisions. Model cost compounds fast. We needed a model capable enough for structured extraction, scoring, and proposal writing - not the best model, the right one.

**Decision**  
Gemini 2.5 Flash with `thinking_budget=0` on every node.

**Alternatives Considered**  
- *Claude Opus / GPT-4o*: higher ceiling but 10-20x the cost. The tasks here - extract job fields, score fit 0-100, write a cover letter - don't require frontier-level reasoning.
- *Gemini Flash with thinking enabled*: thinking mode costs significantly more per token with no quality improvement we observed on any of the 5 nodes. The guardrail classifier outputs one word - thinking there is absurd.

**Rationale**  
Flash hits the quality bar at a fraction of the cost. A typical run costs $0.0013. Thinking disabled means predictable, fast latency across all nodes.

**Trade-offs**  
No reasoning trace means when a node produces a bad score or a weak draft, you cannot inspect why without re-running the node with a modified prompt. Logged scores point to where the problem is, not what caused it.

---

## ADR 2 - LangGraph for the stateful pipeline with human-in-the-loop

**Context**  
The pipeline is not a chain. It has two human decision points (apply or skip, approve or revise), an auto-iteration loop between generator and critic, and state that must survive backend restarts between the pause and resume.

**Decision**  
LangGraph with `interrupt_before` on checkpoint nodes. Conditional edges enforce loop exit (`quality_score >= 85 OR iteration_count >= 3`). Graph compiled once at startup with a PostgreSQL checkpointer.

**Alternatives Considered**  
- *Custom async state machine*: would require building resume logic, serialization, and interrupt handling from scratch.
- *LangChain LCEL*: no interrupt/resume model. Cannot pause mid-chain and resume after a human decision arrives later.
- *Celery*: good for background jobs, not for stateful flows that pause mid-execution waiting for the user.

**Rationale**  
LangGraph's interrupt/resume maps exactly to the product model. State is checkpointed to PostgreSQL so a user can close the browser mid-proposal and return without losing anything.

**Trade-offs**  
Checkpoint tables are managed by LangGraph, not Alembic. Schema changes happen on library upgrade - requires careful testing. LangGraph uses psycopg3 alongside FastAPI's asyncpg - two pools to the same DB.

---

## ADR 3 - Hybrid retrieval: BM25 + pgvector + RRF + FlashRank

**Context**  
The retriever must surface the right profile fragments given a job description. A job posting mentioning "Python 3.11" needs to match both that exact phrase and semantically related experience like "asyncio" or "FastAPI."

**Decision**  
Four-stage pipeline: BM25 keyword recall + pgvector semantic recall -> RRF fusion -> FlashRank cross-encoder re-ranking.

**Alternatives Considered**  
- *pgvector only*: embedding spaces don't reliably encode exact version numbers or technology names. "React 18" in a job posting may not surface a profile chunk that says "React 18."
- *BM25 only*: misses semantics. "machine learning engineer" in the job won't match "built and trained neural networks" in the profile.
- *Weighted score fusion*: requires tuning weights per dataset. RRF uses only rank position and is parameter-free.

**Rationale**  
RRF combines two incompatible score scales without manual weighting. FlashRank re-ranks the small fused set with a cross-encoder - a proper relevance model, not distance approximation - and is lightweight enough to run on CPU without noticeable latency at this chunk count.

**Trade-offs**  
BM25 cache must be explicitly invalidated on profile save. Missing this call silently serves stale retrieval results.

---

## ADR 4 - PostgreSQL for application data, vectors, and graph checkpointing

**Context**  
The system needs three things: a relational store for users and proposals, a vector store for profile embeddings, and a checkpointer for LangGraph state. Each has a natural "obvious" service: PostgreSQL, a dedicated vector DB, and a key-value store like Redis.

**Decision**  
PostgreSQL for all three. pgvector extension handles embeddings. `langgraph-checkpoint-postgres` handles graph state. One database to operate, back up, and monitor.

**Alternatives Considered**  
- *ChromaDB or Pinecone for vectors*: adds a second stateful service with its own backup, auth, and ops burden. Cross-table ownership filtering (`WHERE user_id = $1` in the same query as vector search) is impossible across service boundaries.
- *Redis for LangGraph checkpointing*: another managed service for a problem the existing PostgreSQL instance already solves natively.

**Rationale**  
Operational simplicity wins at this scale. pgvector performance is more than adequate for dozens of chunks per user. Keeping everything in one system means one backup, one connection management strategy, and no data boundary between user records and their embeddings.

**Trade-offs**  
pgvector HNSW index requires tuning at large scale. If chunk counts grow into millions, migrating to a dedicated vector DB becomes the right call.

---

## ADR 5 - RDS in a private subnet with EC2 as the sole access point

**Context**  
The database holds user data, proposals, and profile content. Exposing it to the internet - even with strong credentials - is an unnecessary attack surface.

**Decision**  
RDS lives in a private subnet with no internet gateway route. A security group allows port 5432 only from the EC2 security group. EC2 is the only machine that can reach the database. Admin access is via SSH tunnel through EC2.

**Alternatives Considered**  
- *RDS in a public subnet with IP allowlist*: easier to manage but any misconfiguration exposes the database. IP allowlists drift as team members change IPs.
- *RDS in a public subnet, no public access flag*: AWS has a "no public access" setting but the network path still exists. Defence in depth means the subnet should have no route to the internet gateway at all.

**Rationale**  
Network segmentation is a hard guarantee, not a configuration setting. If EC2 is compromised, the attacker still needs to pivot through the EC2 security group to reach RDS - they cannot hit it directly from the internet.

**Trade-offs**  
Admin database access requires an SSH tunnel through EC2. Minor inconvenience that is the correct trade-off for a production database containing user data.

---

## ADR 6 - Per-user profile isolation enforced at the retrieval layer

**Context**  
Every user uploads their own profile. The retriever must ensure that user A's proposals are only influenced by user A's profile chunks - never user B's. This must hold even if the application layer has a bug.

**Decision**  
`user_id` foreign key on `profile_chunks`. Every BM25 corpus load and every pgvector query filters `WHERE user_id = $1`. The BM25 cache is keyed by `user_id`. Isolation is enforced in the retriever, not in the router or the graph node.

**Alternatives Considered**  
- *Filter at the router or graph node layer*: any caller that forgets the filter - a new endpoint, a background job - silently reads across users. The retriever is the single choke point; pushing the filter there means no caller can bypass it.
- *Separate table or schema per user*: massive operational overhead. The `user_id` column with a DB-level FK is the standard correct model.

**Rationale**  
Security invariants belong as close to the data as possible. Isolation at the query layer is unconditional - it holds regardless of which code path calls the retriever. A new feature that calls `retrieve_profile()` gets correct isolation without any extra work.

**Trade-offs**  
The BM25 cache grows with users. Cache invalidation on profile save must stay in sync with the `user_id` key. A missed invalidation serves one user's stale corpus, not all users'.

---

## ADR 7 - LLM as the prompt injection classifier

**Context**  
User-submitted text (job postings, revision feedback) is embedded into LLM prompts downstream. Injection attacks range from obvious ("ignore all previous instructions") to creative (base64-encoded payloads, hypothetical framings, Unicode homoglyphs).

**Decision**  
A dedicated Gemini Flash instance classifies each input as `"safe"` or `"injection"` before any graph call. `max_output_tokens=10`, `thinking_budget=0`. Fails open on error.

**Alternatives Considered**  
- *Regex blocklist*: catches patterns in the list, fails on everything else. Attackers iterate faster than a blocklist.
- *Input sanitisation*: stripping delimiters corrupts legitimate job postings that contain phrases like "override the existing configuration."
- *No check*: acceptable for a personal tool, not for a multi-user product.

**Rationale**  
An LLM generalises across injection patterns by the same mechanism that makes injection dangerous. Cost is ~5 tokens per check. Failing open preserves availability - classifier downtime is rare, and blocking every user when it happens is a worse outcome than the occasional bypassed check during an outage.

**Trade-offs**  
Failing open means a classifier outage creates a window where injections are not caught. We accept this: the pipeline itself has no privileged actions, so a successful injection produces a bad proposal, not a data breach. Adds ~200ms before the pipeline starts, mitigated by emitting a `status` SSE event immediately so the stream is open while the check runs.

---

## ADR 8 - Multi-stage Docker image, one image for backend and pipeline

**Context**  
`pitchforge/` is a LangGraph library imported directly by `backend/`. They share one virtualenv. The deployment unit question: one image or separate services.

**Decision**  
One `Dockerfile` at the repo root. Builder stage: `uv sync --frozen --no-dev`. Runtime stage: fresh `python:3.12-slim` with only `.venv` and source copied in. `pyproject.toml` and `uv.lock` copied before source to maximise layer cache hits.

**Alternatives Considered**  
- *Two containers*: `pitchforge/` has no HTTP interface and no independent scaling need. A network boundary between the graph runner and the pipeline library adds latency for zero architectural benefit.
- *Single-stage build*: ships `uv`, pip cache, and build tools in the final image. ~60% larger, broader attack surface.
- *pip instead of uv*: `uv sync --frozen` fails the build if `uv.lock` is out of sync with `pyproject.toml`. `pip` has no equivalent guarantee.

**Rationale**  
`pitchforge/` and `backend/` are one deployable unit by design. Multi-stage strips all build artefacts. Layer ordering means dependency installation is cached on every normal code push.

**Trade-offs**  
A change to `pitchforge/` rebuilds the full image. Acceptable because the pipeline and backend are intentionally coupled.

---

## ADR 9 - OIDC for GitHub Actions instead of long-lived AWS credentials

**Context**  
CI/CD needs to push images to ECR and trigger SSM commands on EC2. The naive approach is an IAM user with access keys stored as GitHub secrets.

**Decision**  
OIDC trust between GitHub Actions and an IAM role scoped to `repo:hassanabdullahhere/pitchforge:ref:refs/heads/main`. No access keys exist. GitHub Actions exchanges a short-lived OIDC token for temporary AWS credentials at runtime.

**Alternatives Considered**  
- *IAM user with static access keys in GitHub secrets*: keys are long-lived. If leaked via a log line, a third-party action, or a secret exposure, they remain valid until manually rotated. Rotation requires co-ordinating secret updates across CI config.
- *IAM user with short expiry*: still requires storing a long-lived key somewhere. The problem is the key's existence, not its expiry.

**Rationale**  
OIDC credentials are never stored anywhere. They are minted at job start and expire when the job ends. A leaked OIDC token from a log is useless after the job finishes. The trust policy is scoped to a single branch so a PR from a fork cannot assume the role.

**Trade-offs**  
OIDC setup requires a one-time IAM configuration. Slightly more complex to bootstrap than dropping keys into GitHub secrets.

---

## ADR 10 - AWS Secrets Manager over environment files on EC2

**Context**  
The EC2 container needs secrets at runtime: Gemini API key, JWT secret, database credentials, OAuth client ID. The simplest approach is copying a `.env` file to the server.

**Decision**  
All secrets stored in Secrets Manager under `/pitchforge/backend`. EC2's startup script calls `aws secretsmanager get-secret-value`, parses the JSON, and passes each value as a `-e` flag to `docker run`. No secrets touch the filesystem. `APP_ENV=production` baked into the image disables `load_dotenv()` so a stray `.env` file on the host cannot override production values.

**Alternatives Considered**  
- *`.env` file on EC2*: secrets on disk can leak through misconfigured file permissions, accidental inclusion in snapshots, or inadvertent logging. Rotation means SSH-ing in and editing a file.
- *Environment variables set directly on the EC2 instance*: persisted in instance metadata and visible to any process. Rotation requires instance modification.
- *GitHub secrets passed through CI/CD as build args*: bakes secrets into the Docker image layer history. Image layers are not secret.

**Rationale**  
Secrets Manager gives rotation, access logging via CloudTrail, and IAM-scoped retrieval. The EC2 instance profile authenticates automatically - no credential needed to retrieve the credentials. Secrets never touch the filesystem or the image.

**Trade-offs**  
Updating a secret requires re-running `~/run-backend.sh` on EC2 to pass the new value into the next container. Not automated - a deliberate manual step to prevent accidental config drift.
