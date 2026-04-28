import requests
import json

url = "http://localhost:5000/api/profile"
data = {
    "full_name": "Updated Name",
    "email": "updated@example.com",
    "title": "Senior Flutter Developer",
    "job_type": "On-site",
    "location": "New York, USA",
    "experience_level": "5 years",
    "salary_min": 10000,
    "salary_max": 20000,
    "primary_skills": ["API_TEST_SKILL_1", "API_TEST_SKILL_2"]
}

try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
