from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from pitchforge.state import PitchforgeState
from pitchforge.nodes.analyzer import analyze_job
from pitchforge.nodes.retriever import retrieve_profile
from pitchforge.nodes.scorer import score_fit
from pitchforge.nodes.fit_checkpoint import human_fit_checkpoint
from pitchforge.nodes.generator import generate_proposal
from pitchforge.nodes.critic import critique_proposal
from pitchforge.nodes.human_checkpoint import human_proposal_checkpoint


def route_fit(state: PitchforgeState) -> str:
    return "generator" if state["should_apply"] else END


def route_critic(state: PitchforgeState) -> str:
    if state["quality_score"] >= 70 or state["iteration_count"] >= 3:
        return "human_checkpoint"
    return "generator"


builder = StateGraph(PitchforgeState)

builder.add_node("analyzer", analyze_job)
builder.add_node("retriever", retrieve_profile)
builder.add_node("scorer", score_fit)
builder.add_node("fit_checkpoint", human_fit_checkpoint)
builder.add_node("generator", generate_proposal)
builder.add_node("critic", critique_proposal)
builder.add_node("human_checkpoint", human_proposal_checkpoint)

builder.set_entry_point("analyzer")
builder.add_edge("analyzer", "retriever")
builder.add_edge("retriever", "scorer")
builder.add_edge("scorer", "fit_checkpoint")
builder.add_conditional_edges("fit_checkpoint", route_fit)
builder.add_edge("generator", "critic")
builder.add_conditional_edges("critic", route_critic)
builder.add_edge("human_checkpoint", END)

pitchforge_graph = builder.compile(checkpointer=MemorySaver())
