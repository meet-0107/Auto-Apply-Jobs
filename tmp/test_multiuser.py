import urllib.request, json

BASE = 'http://127.0.0.1:5000'

def post(path, data):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(data).encode(),
        headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def get(path):
    with urllib.request.urlopen(BASE + path) as r:
        return json.loads(r.read())

# # Save User 1
# r1 = post('/api/profile', {'full_name': 'Alice', 'email': 'alice@test.com', 'job_type': 'Remote'})
# print('User 1 save:', r1)

# # Save User 2
# r2 = post('/api/profile', {'full_name': 'Bob', 'email': 'bob@test.com', 'job_type': 'Hybrid'})
# print('User 2 save:', r2)

# # Update User 1 (should NOT create a new row)
# r3 = post('/api/profile', {'full_name': 'Alice Updated', 'email': 'alice@test.com', 'location': 'Mumbai'})
# print('User 1 update:', r3)

# # List all profiles
# profiles = get('/api/profiles')
# print(f'\nAll profiles ({len(profiles)} total):')
# for p in profiles:
#     print(f"  id={p['id']} | {p['full_name']} | {p['email']}")

# # Load Alice by email
# alice = get('/api/profile?email=alice@test.com')
# print(f'\nAlice profile: name={alice["full_name"]}, location={alice["location"]}')
