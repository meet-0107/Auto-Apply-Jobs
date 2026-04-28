"""
Migrate profiles table:
- Make email UNIQUE and NOT NULL (used as the per-user key)
- Preserve all existing data
"""
import sqlite3, os, json

db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'instance', 'local.sqlite')
print(f"[*] Database: {db_path}")

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Read current schema
cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='profiles'")
row = cur.fetchone()
schema_sql = row[0] if row else ''
print(f"[*] Current schema:\n{schema_sql}\n")

# Read existing rows
cur.execute("SELECT * FROM profiles")
existing = [dict(r) for r in cur.fetchall()]
print(f"[*] Existing rows: {len(existing)}")
for r in existing:
    print(f"    id={r['id']} email={r.get('email')} name={r.get('full_name')}")

# Drop duplicates by email (keep latest id)
seen_emails = {}
for r in existing:
    email = (r.get('email') or '').strip()
    if not email:
        print(f"    [!] Skipping row id={r['id']} — no email set")
        continue
    if email in seen_emails:
        old = seen_emails[email]
        keep = r if r['id'] > old['id'] else old
        seen_emails[email] = keep
    else:
        seen_emails[email] = r

clean_rows = list(seen_emails.values())
print(f"[*] Clean rows to keep: {len(clean_rows)}")

# Create new table with UNIQUE email
cur.executescript("""
DROP TABLE IF EXISTS profiles_new;
CREATE TABLE profiles_new (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    full_name VARCHAR(100),
    email VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(100),
    primary_skills JSON,
    secondary_skills JSON,
    location_preference VARCHAR(50),
    experience_level VARCHAR(50),
    achievements TEXT,
    linkedin VARCHAR(200),
    github VARCHAR(200),
    portfolio VARCHAR(200),
    job_type VARCHAR(50),
    location VARCHAR(100),
    salary_min INTEGER,
    salary_max INTEGER
);
""")

# Insert clean rows
cols = ['full_name','email','title','primary_skills','secondary_skills',
        'location_preference','experience_level','achievements',
        'linkedin','github','portfolio','job_type','location','salary_min','salary_max']

for r in clean_rows:
    vals = []
    for c in cols:
        v = r.get(c)
        if isinstance(v, (list, dict)):
            v = json.dumps(v)
        vals.append(v)
    ph = ','.join(['?' for _ in cols])
    cur.execute(f"INSERT INTO profiles_new ({','.join(cols)}) VALUES ({ph})", vals)
    print(f"    Inserted: email={r.get('email')} name={r.get('full_name')}")

conn.commit()

# Replace table
cur.executescript("""
DROP TABLE profiles;
ALTER TABLE profiles_new RENAME TO profiles;
""")
conn.commit()

# Verify
cur.execute("SELECT id, email, full_name FROM profiles")
final = cur.fetchall()
print(f"\n[+] Migration complete. Profiles in DB: {len(final)}")
for r in final:
    print(f"    id={r[0]} email={r[1]} name={r[2]}")

conn.close()
