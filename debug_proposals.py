from server import app, db, Job, Proposal, Profile
import json

with app.app_context():
    profile = Profile.query.first()
    print(f"Profile: {profile.full_name} | {profile.title}")
    
    high_match_jobs = Job.query.filter(Job.match_score >= 40).all()
    print(f"High-match jobs found in DB: {len(high_match_jobs)}")
    for j in high_match_jobs:
        print(f" - {j.title} ({j.match_score}%)")
        
    proposals = Proposal.query.all()
    print(f"Total proposals in DB: {len(proposals)}")
