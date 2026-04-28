from server import app, db, Profile
import json

with app.app_context():
    # Only add if not exists
    if not Profile.query.first():
        profile = Profile(
            full_name="Test User",
            email="test@example.com",
            title="Flutter Developer",
            primary_skills=json.dumps(["Flutter", "Dart", "Firebase"]),
            secondary_skills=json.dumps(["Git", "UI/UX"]),
            location_preference="Remote",
            experience_level="2 years"
        )
        db.session.add(profile)
        db.session.commit()
        print("Test profile created.")
    else:
        print("Profile already exists.")
