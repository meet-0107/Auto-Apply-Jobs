import os
import sys
import json
from typing import TypedDict, List, Dict, Any
from dotenv import load_dotenv

from langgraph.graph import StateGraph, END
from langchain_google_genai import GoogleGenerativeAI

# ---------------- LOAD ENV ----------------
basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
load_dotenv(os.path.join(basedir, '.env'))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("❌ GEMINI_API_KEY not found in .env")

# ---------------- LLM ----------------
llm = GoogleGenerativeAI(
    model="gemini-1.5-flash",
    google_api_key=GEMINI_API_KEY
)

# ---------------- IMPORT DB ----------------
sys.path.append(basedir)

try:
    from server import app, db, Job, Profile, Proposal
except ImportError:
    app = None
    db = None
    Job = None
    Profile = None
    Proposal = None

from Agents.apply_agent import apply_agent_app

# ---------------- STATE ----------------
class ProposalState(TypedDict):
    profile: Dict[str, Any]
    jobs: List[Dict[str, Any]]
    proposals: List[Dict[str, Any]]

# ---------------- NODE 1 ----------------
def load_data_node(state: ProposalState) -> Dict[str, Any]:
    """Load profile + high-match jobs"""

    profile_data = state.get("profile") or {}
    jobs_data = state.get("jobs") or []

    if (not profile_data or not jobs_data) and app and db:
        with app.app_context():

            if not profile_data and Profile:
                p = Profile.query.first()
                if p:
                    profile_data = {
                        c.name: getattr(p, c.name)
                        for c in p.__table__.columns
                    }

            if not jobs_data and Job:
                jobs = Job.query.filter(Job.match_score >= 50).all()
                jobs_data = [
                    {c.name: getattr(j, c.name) for c in j.__table__.columns}
                    for j in jobs
                ]

    print(f"[*] Loaded {len(jobs_data)} jobs")
    return {"profile": profile_data, "jobs": jobs_data}

# ---------------- AI FUNCTION ----------------
def generate_proposal_with_ai(profile, job):
    """Generate proposal using Gemini (LangChain)"""

    # Handle skills safely
    skills = profile.get("primary_skills", [])
    if isinstance(skills, str):
        try:
            skills = json.loads(skills)
        except:
            skills = [skills]

    prompt = f"""
Write a SHORT, HIGH-CONVERTING job application proposal.

## Candidate:
Name: {profile.get('full_name')}
Title: {profile.get('title')}
Skills: {", ".join(skills)}
Experience: {profile.get('experience_level')}

## Job:
Title: {job.get('title')}
Company: {job.get('company')}
Location: {job.get('location')}

## Rules:
- First line must grab attention
- Be specific to THIS job
- Keep under 100 words
- Return ONLY the proposal text.
"""

    try:
        response = llm.invoke(prompt)
        return response.strip()

    except Exception as e:
        print(f"[-] AI Error: {e}")
        return None

# ---------------- NODE 2 ----------------
def generate_proposals_node(state: ProposalState) -> Dict[str, Any]:

    profile = state.get("profile", {})
    jobs = state.get("jobs", [])

    proposals = []

    target_jobs = [j for j in jobs if j.get("match_score", 0) >= 50]

    print(f"[*] Generating proposals for {len(target_jobs)} jobs...")

    for job in target_jobs:
        print(f"[*] Processing: {job.get('title')}")

        proposal_text = generate_proposal_with_ai(profile, job)

        if proposal_text:
            proposals.append({
                "job_title": job.get("title"),
                "company": job.get("company"),
                "proposal": proposal_text,
                "match_score": job.get("match_score")
            })

    print(f"[+] Generated {len(proposals)} proposals")

    return {"proposals": proposals}

# ---------------- NODE 3 ----------------
def save_proposals_node(state: ProposalState) -> Dict[str, Any]:
    """Save to DB + trigger apply agent"""

    proposals = state.get("proposals", [])

    if app and db and Proposal:
        with app.app_context():

            count = 0

            for p in proposals:
                new_prop = Proposal(
                    job_title=p["job_title"],
                    company=p["company"],
                    proposal_text=p["proposal"],
                    match_score=p["match_score"],
                    status="Pending"
                )
                db.session.add(new_prop)
                db.session.flush() # Get IDs before commit
                p["id"] = new_prop.id
                count += 1

            try:
                db.session.commit()
                print(f"[+] Saved {count} proposals")
            except Exception as e:
                db.session.rollback()
                print(f"[-] DB Error: {e}")

    # Trigger Apply Agent
    print("[*] Triggering Apply Agent...")
    apply_agent_app.invoke({
        "proposals": proposals,
        "application_results": []
    })

    return {}

# ---------------- CONDITION ----------------
def check_top_jobs(state: ProposalState) -> str:
    jobs = state.get("jobs", [])
    top_jobs = [j for j in jobs if j.get("match_score", 0) >= 50]
    return "generate" if top_jobs else "end"

# ---------------- GRAPH ----------------
workflow = StateGraph(ProposalState)

workflow.add_node("load_data", load_data_node)
workflow.add_node("generate_proposals", generate_proposals_node)
workflow.add_node("save_proposals", save_proposals_node)

workflow.set_entry_point("load_data")

workflow.add_conditional_edges(
    "load_data",
    check_top_jobs,
    {
        "generate": "generate_proposals",
        "end": END
    }
)

workflow.add_edge("generate_proposals", "save_proposals")
workflow.add_edge("save_proposals", END)

proposal_agent_app = workflow.compile()

# ---------------- RUN ----------------
if __name__ == "__main__":
    print("🚀 Starting Proposal Agent...\n")

    proposal_agent_app.invoke({
        "profile": {},
        "jobs": [],
        "proposals": []
    })

    print("\n✅ Done!")