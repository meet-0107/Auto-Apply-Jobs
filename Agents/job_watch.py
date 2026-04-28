from typing import TypedDict, List, Dict, Any
import requests
import json
import os
import sys
from langgraph.graph import StateGraph, END
from dotenv import load_dotenv

# Load environment variables from the project root
basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
load_dotenv(os.path.join(basedir, '.env'))

# Add project root to path for database access
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
try:
    from server import app, db, Job, Profile
except ImportError:
    app = None
    db = None
    Job = None

# 1. Define the Agent's State
class JobAgentState(TypedDict):
    email: str
    profile: Dict[str, Any]
    search_term: str
    location: str
    found_jobs: List[Dict[str, Any]]

# 2. Define the Nodes (The Actions)

def load_profile_node(state: JobAgentState) -> Dict[str, Any]:
    """Loads the user's profile from the DB using the provided email."""
    email = state.get("email")
    if not email:
        print("[-] JobAgent: No email provided, cannot load profile.")
        return {"profile": {}}
    
    profile_data = {}
    if app and db and Profile:
        with app.app_context():
            p = Profile.query.filter_by(email=email).first()
            if p:
                profile_data = {c.name: getattr(p, c.name) for c in p.__table__.columns}
                print(f"[*] JobAgent: Loaded profile for {email}")
            else:
                print(f"[-] JobAgent: Profile not found for {email}")
    return {"profile": profile_data}

def fetch_arbeitnow_node(state: JobAgentState) -> Dict[str, Any]:
    """Fetches jobs from Arbeitnow with better filtering."""
    profile = state.get("profile", {})
    
    # 1. Try to use explicit primary skills
    raw_skills = profile.get("primary_skills") or []
    if isinstance(raw_skills, str):
        try:
            raw_skills = json.loads(raw_skills)
        except:
            if ',' in raw_skills:
                raw_skills = [s.strip() for s in raw_skills.split(',')]
            else:
                raw_skills = [raw_skills]
                
    keywords = [str(k).strip().lower() for k in raw_skills if len(str(k).strip()) > 2]
    
    # 2. Fallback to title
    if not keywords and profile.get("title"):
        title = profile.get("title").strip().lower()
        if len(title) > 2:
            keywords = [title]
            
    # 3. Last resort fallback
    if not keywords:
        search_term = state.get("search_term", "Developer")
        keywords = [k.strip().lower() for k in search_term.replace(',', ' ').split() if len(k.strip()) > 2]
        if not keywords:
            keywords = ["python", "javascript", "developer", "engineer"]
    
    print(f"[*] Fetching jobs from Arbeitnow for keywords: {keywords}...")
    url = "https://www.arbeitnow.com/api/job-board-api"
    
    found_jobs = []
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            all_jobs = data.get('data', [])
            for job in all_jobs:
                title = job.get('title', '').lower()
                desc = job.get('description', '').lower()
                
                # Check if ANY keyword matches
                if any(kw in title or kw in desc for kw in keywords):
                    found_jobs.append({
                        'title': job.get('title'),
                        'company': job.get('company_name'),
                        'location': job.get('location'),
                        'url': job.get('url'),
                        'source': 'Arbeitnow',
                        'tags': job.get('tags', [])
                    })
            print(f"[+] Arbeitnow: Found {len(found_jobs)} jobs out of {len(all_jobs)} scanned.")
        else:
            print(f"[-] Arbeitnow Error: {response.status_code}")
    except Exception as e:
        print(f"[-] Arbeitnow Exception: {e}")
        
    return {"found_jobs": found_jobs}

def fetch_rapidapi_node(state: JobAgentState) -> Dict[str, Any]:
    """Fetches jobs from JSearch via RapidAPI."""
    search_term = state.get("search_term", "Flutter")
    location = state.get("location", "Remote")
    print(f"[*] Fetching jobs from JSearch for '{search_term}' in '{location}'...")
    
    api_key = os.getenv("JSEARCH_API_KEY") or os.getenv("RAPIDAPI_KEY")
    if not api_key or api_key in ["your_jsearch_key", "your_rapidapi_key"]:
        print("[-] RapidAPI: Skipping (API Key not set).")
        return {}

    url = "https://jsearch.p.rapidapi.com/search"
    querystring = {"query": f"{search_term} in {location}", "num_pages": "1"}
    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
    }

    new_jobs = []
    try:
        response = requests.get(url, headers=headers, params=querystring, timeout=30)
        if response.status_code == 200:
            data = response.json()
            for item in data.get('data', []):
                new_jobs.append({
                    'title': item.get('job_title'),
                    'company': item.get('employer_name'),
                    'location': f"{item.get('job_city', '')} {item.get('job_country', '')}".strip(),
                    'url': item.get('job_apply_link'),
                    'source': 'JSearch (RapidAPI)',
                    'tags': [item.get('job_employment_type', 'Full-time')]
                })
            print(f"[+] JSearch: Found {len(new_jobs)} jobs.")
        else:
            print(f"[-] JSearch Error ({response.status_code}): {response.text[:100]}")
    except Exception as e:
        print(f"[-] JSearch Exception: {e}")
    
    current_jobs = state.get("found_jobs", [])
    return {"found_jobs": current_jobs + new_jobs}

def save_jobs_node(state: JobAgentState) -> Dict[str, Any]:
    """Saves jobs to DB."""
    found_jobs = state.get("found_jobs", [])
    
    # Save to Database
    if app and db and Job:
        with app.app_context():
            new_count = 0
            for job_data in found_jobs:
                if not job_data.get('url'): continue
                existing = Job.query.filter_by(url=job_data['url']).first()
                if not existing:
                    job = Job(
                        title=job_data['title'],
                        company=job_data['company'],
                        location=job_data['location'],
                        url=job_data['url'],
                        source=job_data['source'],
                        tags=job_data['tags']
                    )
                    db.session.add(job)
                    new_count += 1
            try:
                db.session.commit()
                print(f"[+] Database: Added {new_count} new jobs.")
            except Exception as e:
                db.session.rollback()
                print(f"[-] DB Save Error: {e}")
    else:
        print("[!] Database credentials or models not available. Skipping DB save.")
        
    return {}

def trigger_matcher_node(state: JobAgentState) -> Dict[str, Any]:
    """Triggers the Job Matcher with EXACTLY the newly found jobs and profile."""
    found_jobs = state.get("found_jobs", [])
    profile = state.get("profile", {})
    
    if not found_jobs or not profile:
        print("[-] Skipping Job Matcher: No new jobs or no profile.")
        return {}
        
    print(f"[*] Triggering Job Matcher for exact {len(found_jobs)} new jobs...")
    try:
        from Agents.job_matcher import matcher_app
        # We explicitly pass the loaded profile and the newly extracted jobs.
        # This prevents the matcher from blindly querying ALL jobs in the DB.
        matcher_input = {
            "profile": profile,
            "jobs": found_jobs
        }
        matcher_app.invoke(matcher_input)
    except Exception as e:
        import traceback
        print(f"[-] Could not trigger Job Matcher: {e}")
        traceback.print_exc()
    return {}

# 3. Define the Routing Logic
def check_jobs_found(state: JobAgentState) -> str:
    """Decide if the workflow should continue."""
    if len(state.get("found_jobs", [])) > 0:
        return "continue"
    print("[-] No matching jobs found.")
    return "end"

# 4. Compile the Graph
workflow = StateGraph(JobAgentState)

workflow.add_node("load_profile", load_profile_node)
workflow.add_node("fetch_arbeitnow", fetch_arbeitnow_node)
workflow.add_node("fetch_rapidapi", fetch_rapidapi_node)
workflow.add_node("save_all", save_jobs_node)
workflow.add_node("trigger_matcher", trigger_matcher_node)

workflow.set_entry_point("load_profile")
workflow.add_edge("load_profile", "fetch_arbeitnow")
workflow.add_edge("fetch_arbeitnow", "fetch_rapidapi")
workflow.add_conditional_edges(
    "fetch_rapidapi",
    check_jobs_found,
    {
        "continue": "save_all",
        "end": END
    }
)
workflow.add_edge("save_all", "trigger_matcher")
workflow.add_edge("trigger_matcher", END)

job_agent_app = workflow.compile()

if __name__ == "__main__":
    initial_state = {
        "search_term": "Flutter Developer",
        "location": "Remote",
        "found_jobs": []
    }
    print("--- Starting Consolidated Job Agent ---")
    job_agent_app.invoke(initial_state)
    print("--- Workflow Complete ---")
