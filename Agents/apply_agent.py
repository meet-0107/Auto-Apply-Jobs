from typing import TypedDict, List, Dict, Any
import json
import os
import sys
from datetime import datetime
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from dotenv import load_dotenv

# Setup paths
basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
load_dotenv(os.path.join(basedir, '.env'))

# Add project root to path for database access
sys.path.append(basedir)
try:
    from server import app, db, Job
except ImportError:
    app = None
    db = None
    Job = None

# 1. Define the State
class ApplyState(TypedDict):
    jobs: List[Dict[str, Any]]
    application_results: List[Dict[str, Any]]

# 2. Define the Nodes
def load_jobs_node(state: ApplyState) -> Dict[str, Any]:
    """Loads Pending/None status jobs from DB if not provided."""
    jobs = state.get("jobs") or []
    
    if not jobs and app and db and Job:
        with app.app_context():
            # Only pull jobs that meet the 50% threshold and are not Applied or Not applied
            pending = Job.query.filter(
                db.or_(Job.status == 'Pending', Job.status == 'Approved', Job.status == None), 
                Job.match_score >= 50
            ).all()
            jobs = [{c.name: getattr(j, c.name) for c in j.__table__.columns} for j in pending]
            
    print(f"[*] Apply Agent: Processing {len(jobs)} jobs.")
    return {"jobs": jobs}

def apply_to_jobs_node(state: ApplyState) -> Dict[str, Any]:
    """Simulates applying and updates DB status."""
    jobs = state.get("jobs", [])
    results = []
    
    if not jobs:
        print("[!] No jobs found in state to apply to.")
        return {"application_results": []}

    print(f"[*] Applying to {len(jobs)} jobs...")

    if app and db and Job:
        with app.app_context():
            # Check today's quota
            today_str = datetime.now().strftime("%Y-%m-%d")
            already_applied = Job.query.filter_by(status='Applied', date_applied=today_str).count()
            limit = 10
            
            remaining = limit - already_applied
            if remaining <= 0:
                print(f"[!] Daily limit of {limit} reached. Stopping.")
                return {"application_results": [{"status": "Limit Reached"}]}
            
            # Slice jobs to respect remaining quota and FINAL score check
            to_apply = [j for j in jobs if j.get('match_score', 0) >= 50][:remaining]
            print(f"[*] {already_applied} already applied today. Applying to {len(to_apply)} more (Limit: {limit}).")

            for job_data in to_apply:
                # Simulate application success
                print(f"[+] Applied to {job_data.get('title')} at {job_data.get('company')}")
                
                # Update DB
                db_job = Job.query.get(job_data['id']) if 'id' in job_data else \
                          Job.query.filter_by(title=job_data['title'], company=job_data['company']).first()
                
                if db_job:
                    db_job.status = 'Applied'
                    db_job.date_applied = today_str
                    results.append({
                        "title": db_job.title,
                        "company": db_job.company,
                        "status": "Applied"
                    })
                else:
                    print(f"[-] Apply Agent: Could not find job in DB for {job_data.get('title')} (ID: {job_data.get('id')})")
            
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                print(f"[-] Apply Agent DB Error: {e}")

    return {"application_results": results}

# 3. Compile the Graph
workflow = StateGraph(ApplyState)
workflow.add_node("load_jobs", load_jobs_node)
workflow.add_node("apply_to_jobs", apply_to_jobs_node)

workflow.set_entry_point("load_jobs")
workflow.add_edge("load_jobs", "apply_to_jobs")
workflow.add_edge("apply_to_jobs", END)

# HITL: Add a MemorySaver and compile with interrupt
memory = MemorySaver()
apply_agent_app = workflow.compile(
    checkpointer=memory,
    interrupt_before=["apply_to_jobs"]
)

if __name__ == "__main__":
    print("--- Starting Apply Agent (HITL Mode) ---")
    config = {"configurable": {"thread_id": "test-thread"}}
    
    # 1. Run until interrupt
    print("[*] Running until interrupt...")
    state = apply_agent_app.invoke({"jobs": [], "application_results": []}, config=config)
    
    # Check if we are paused
    snapshot = apply_agent_app.get_state(config)
    if snapshot.next:
        print(f"[*] HITL: Agent is paused before node: {snapshot.next}")
        print(f"[*] Jobs waiting for approval: {len(snapshot.values.get('jobs', []))}")
        
        # 2. Simulate User Approval
        user_input = input("Proceed with applications? (y/n): ")
        if user_input.lower() == 'y':
            print("[*] Resuming agent...")
            apply_agent_app.invoke(None, config=config)
            print("[+] Resumed and completed.")
        else:
            print("[!] Application cancelled by user.")
    else:
        print("--- Done (No jobs to pause for) ---")
