import urllib.request
import json
import time

BASE_URL = 'http://127.0.0.1:5000'

dummy_profiles = [
    {
        "full_name": "Alice Backend",
        "email": "alice@dummy.com",
        "title": "Backend Python Developer",
        "primary_skills": "Python, Django, Flask, SQL, APIs",
        "location": "Remote",
        "job_type": "Remote",
        "experience_level": "Mid-level",
        "salary_min": 80000,
        "salary_max": 120000
    },
    {
        "full_name": "Bob Frontend",
        "email": "bob@dummy.com",
        "title": "Frontend React Engineer",
        "primary_skills": "React, JavaScript, TypeScript, CSS, HTML",
        "location": "New York",
        "job_type": "Hybrid",
        "experience_level": "Senior",
        "salary_min": 110000,
        "salary_max": 150000
    },
    {
        "full_name": "Charlie Mobile",
        "email": "charlie@dummy.com",
        "title": "Flutter Developer",
        "primary_skills": "Flutter, Dart, Mobile App Development, iOS, Android",
        "location": "Remote",
        "job_type": "Remote",
        "experience_level": "Junior",
        "salary_min": 60000,
        "salary_max": 90000
    },
    {
        "full_name": "Diana Data",
        "email": "diana@dummy.com",
        "title": "Data Scientist",
        "primary_skills": "Python, Machine Learning, Pandas, SQL, Data Analysis",
        "location": "San Francisco",
        "job_type": "On-site",
        "experience_level": "Senior",
        "salary_min": 130000,
        "salary_max": 180000
    },
    {
        "full_name": "Eve DevOps",
        "email": "eve@dummy.com",
        "title": "DevOps Engineer",
        "primary_skills": "AWS, Docker, Kubernetes, CI/CD, Terraform",
        "location": "Remote",
        "job_type": "Remote",
        "experience_level": "Mid-level",
        "salary_min": 100000,
        "salary_max": 140000
    }
]

def post(path, data):
    req = urllib.request.Request(
        BASE_URL + path, 
        data=json.dumps(data).encode(),
        headers={'Content-Type': 'application/json'}, 
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"Error calling {path}: {e}")
        return None

print("=== 1. Creating 5 Dummy Profiles ===")
for p in dummy_profiles:
    res = post('/api/profile', p)
    if res and res.get('status') == 'success':
        print(f"[+] Created profile for: {p['full_name']} ({p['email']})")
    else:
        print(f"[-] Failed to create profile for: {p['full_name']}")

print("\n=== 2. Triggering Full Pipeline for Each Profile ===")
# We will trigger the `/api/scrape` endpoint which now runs the watcher and matcher.
# Depending on how proposal and apply are hooked up, we might need to verify their triggers.
# Let's start by triggering the discovery (watch) and match for each user.

for p in dummy_profiles:
    print(f"\n[*] Starting pipeline for {p['email']}...")
    scrape_payload = {
        "email": p['email'],
        "search_term": p['title'], # Use title as search term
        "location": p['location']
    }
    
    print(f"    -> Running Discovery (job_watch) & Matching (job_matcher)...")
    scrape_res = post('/api/scrape', scrape_payload)
    if scrape_res:
         print(f"    -> Result: {scrape_res.get('message', 'Success')}")
         
    # To truly run proposal and apply, we need to inspect how they are linked. 
    # Usually job_matcher triggers proposal_agent at its end.
    # Let's just wait a bit between requests so logs don't jumble
    time.sleep(2)

print("\n=== Pipeline Trigger Script Complete ===")
print("Check the server terminal logs to see the agents in action.")
