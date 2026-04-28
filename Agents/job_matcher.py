from typing import TypedDict, List, Dict, Any
import json
import os
import sys
from langgraph.graph import StateGraph, END

# Add project root to path for database access
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
try:
    from server import app, db, Job, Profile
except ImportError:
    app = None
    db = None
    Job = None
    Profile = None

# 1. Define the Matcher State
class MatcherState(TypedDict):
    profile: Dict[str, Any]
    jobs: List[Dict[str, Any]]

# 2. Define the Nodes (Actions)
def load_data_node(state: MatcherState) -> Dict[str, Any]:
    """Loads profile and jobs data from state or fallback to database."""
    # If state already has profile and jobs (e.g., from JobAgent), use them!
    profile_data = state.get("profile") or {}
    jobs_data = state.get("jobs", []) or []

    if profile_data and jobs_data:
        print(f"[*] Matcher: Received {len(jobs_data)} jobs to score for {profile_data.get('email', 'Unknown')}")
        return {"profile": profile_data, "jobs": jobs_data}

    # Fallback: Load ALL from DB (e.g. if run manually)
    print("[*] Matcher: State empty, falling back to DB load...")
    if app and db and Profile and Job:
        with app.app_context():
            # Load Profile (Fallback uses first profile, which is risky in multi-user)
            p = Profile.query.first()
            if p:
                profile_data = {c.name: getattr(p, c.name) for c in p.__table__.columns}
            
            # Load Jobs
            jobs = Job.query.all()
            jobs_data = [{c.name: getattr(j, c.name) for c in j.__table__.columns} for j in jobs]
            
            print(f"[*] Loaded profile: {profile_data.get('full_name', 'Unknown')} (FALLBACK)")
            print(f"[*] Loaded {len(jobs_data)} jobs from DB for matching. (FALLBACK)")
    else:
        print("[-] Database models not available in load_data_node.")

    return {"profile": profile_data, "jobs": jobs_data}

import re

def extract_years(text: str) -> int:
    """Helper to extract years of experience from a string."""
    import re
    match = re.search(r'(\d+)\+?\s*years?', text.lower())
    if match:
        return int(match.group(1))
    return -1

def score_jobs_node(state: MatcherState) -> Dict[str, Any]:
    """
    Calculates match scores strictly based on 4 factors:
    1. Primary Skills (50 pts)
    2. Location (20 pts)
    3. Job Type (15 pts)
    4. Experience Level (15 pts)
    Total: 100 pts
    """
    profile = state.get("profile", {})
    jobs = state.get("jobs", [])
    
    # 1. Profile Extraction
    # Primary Skills
    raw_skills = profile.get('primary_skills') or []
    if isinstance(raw_skills, str):
        try:
            raw_skills = json.loads(raw_skills)
        except:
            if ',' in raw_skills:
                raw_skills = [s.strip() for s in raw_skills.split(',')]
            else:
                raw_skills = [raw_skills]
    p_skills = [str(s).lower().strip() for s in raw_skills if str(s).strip()]
    
    # Location
    p_location = str(profile.get('location') or '').lower().strip()
    
    # Job Type
    p_job_type = str(profile.get('job_type') or '').lower().strip()
    
    # Experience Level
    p_exp_str = str(profile.get('experience_level') or '').lower().strip()
    # Map profile experience to rough years for fallback logic
    p_exp_years = 0
    if 'senior' in p_exp_str: p_exp_years = 5
    elif 'mid' in p_exp_str: p_exp_years = 3
    elif 'junior' in p_exp_str: p_exp_years = 1

    updated_jobs = []
    
    for job in jobs:
        score = 0
        j_title = str(job.get('title') or '').lower()
        j_loc = str(job.get('location') or '').lower()
        
        raw_tags = job.get('tags') or []
        if isinstance(raw_tags, str):
            try:
                raw_tags = json.loads(raw_tags)
            except:
                raw_tags = []
        j_tags = [str(t).lower() for t in raw_tags]
        
        j_text = j_title + ' ' + ' '.join(j_tags)

        # ---------------------------------------------------------
        # 1. Primary Skills Match (Max 50 points)
        # ---------------------------------------------------------
        if p_skills:
            matches = sum(1 for skill in p_skills if skill in j_text)
            match_ratio = min(matches / max(len(p_skills), 1), 1.0)
            # If at least ONE matches, give base 25. Scale rest up to 50.
            if matches > 0:
                skill_score = 25 + int(25 * match_ratio)
            else:
                skill_score = 0
            score += skill_score
        else:
            score += 25 # No skills defined = partial default

        # ---------------------------------------------------------
        # 2. Location Match (Max 20 points)
        # ---------------------------------------------------------
        if p_location:
            # If user wants remote but job isn't
            if p_location == 'remote' and ('remote' in j_loc or 'remote' in j_title):
                score += 20
            # If user wants specific city, and it matches
            elif p_location != 'remote' and p_location in j_loc:
                score += 20
            # Partial match (e.g. India in both)
            elif p_location.split(',')[0].strip() in j_loc:
                score += 10
        else:
            score += 10 # No location defined = partial default

        # ---------------------------------------------------------
        # 3. Job Type Match (Max 15 points)
        # ---------------------------------------------------------
        if p_job_type:
            if p_job_type in j_loc or p_job_type in j_title or p_job_type in j_tags:
                score += 15
            elif p_job_type == 'hybrid' and ('remote' in j_loc or 'office' in j_loc):
                score += 7 # Partial match
        else:
            score += 7 # No job type defined

        # ---------------------------------------------------------
        # 4. Experience Level Match (Max 15 points)
        # ---------------------------------------------------------
        if p_exp_str:
            # Check keywords first
            if 'senior' in p_exp_str and ('senior' in j_title or 'lead' in j_title):
                score += 15
            elif 'junior' in p_exp_str and ('junior' in j_title or 'fresher' in j_title or 'entry' in j_title):
                score += 15
            elif 'fresher' in p_exp_str and ('fresher' in j_title or 'entry' in j_title or 'intern' in j_title):
                score += 15
            else:
                # Try to extract required years from tags
                j_years = -1
                for tag in j_tags:
                    y = extract_years(tag)
                    if y >= 0:
                        j_years = y
                        break
                
                if j_years >= 0:
                    # e.g. Job needs 3 years. You have 'Mid' (3 yrs). Match!
                    if abs(j_years - p_exp_years) <= 1:
                        score += 15
                    elif p_exp_years > j_years + 1:
                        score += 10 # Overqualified is okay
                    else:
                        score += 5 # Underqualified
                else:
                    # Job doesn't specify experience clearly
                    score += 10
        else:
            score += 10 # No exp defined


        # Cap score at 100
        job['match_score'] = min(score, 100)
        updated_jobs.append(job)

    # Sort by match score (highest first)
    updated_jobs.sort(key=lambda x: x.get('match_score', 0), reverse=True)
    
    return {"jobs": updated_jobs}

def save_results_node(state: MatcherState) -> Dict[str, Any]:
    """Updates match scores in the database and triggers Proposal Agent."""
    jobs = state.get("jobs", [])

    if app and db and Job:
        with app.app_context():
            update_count = 0
            for job_data in jobs:
                if not job_data.get('url'): continue
                db_job = Job.query.filter_by(url=job_data['url']).first()
                if db_job:
                    db_job.match_score = job_data['match_score']
                    update_count += 1
            try:
                db.session.commit()
                print(f"[+] Database: Updated {update_count} match scores.")
            except Exception as e:
                db.session.rollback()
                print(f"[-] DB Update Error: {e}")
    
    # Trigger Proposal Agent
    try:
        from Agents.proposal_agent import proposal_agent_app
        proposal_state = {
            "profile": state.get("profile"),
            "jobs": jobs,
            "proposals": []
        }
        print("[*] Automatically triggering Proposal Agent...")
        proposal_agent_app.invoke(proposal_state)
    except Exception as e:
        print(f"[-] Could not trigger Proposal Agent: {e}")
            
    return {}

# 3. Define Conditional Routing
def check_data_validity(state: MatcherState) -> str:
    """Checks if we have both profile and jobs."""
    if not state.get("profile"):
        print("[-] Cannot match: Missing profile data.")
        return "end"
    if not state.get("jobs"):
        print("[-] Cannot match: No jobs available to score.")
        return "end"
    return "score"

# 4. Compile the Graph
workflow = StateGraph(MatcherState)

workflow.add_node("load_data", load_data_node)
workflow.add_node("score_jobs", score_jobs_node)
workflow.add_node("save_results", save_results_node)

workflow.set_entry_point("load_data")
workflow.add_conditional_edges(
    "load_data",
    check_data_validity,
    {
        "score": "score_jobs",
        "end": END
    }
)
workflow.add_edge("score_jobs", "save_results")
workflow.add_edge("save_results", END)

matcher_app = workflow.compile()

class JobMatcher:
    def run(self):
        print("[*] JobMatcher: Running via LangGraph...")
        return matcher_app.invoke({"profile": {}, "jobs": []})

if __name__ == "__main__":
    matcher = JobMatcher()
    matcher.run()