import sqlite3
import os

db_path = os.path.join('instance', 'local.sqlite')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

print("--- Profiles ---")
cur.execute("SELECT id, full_name, title FROM profiles")
for row in cur.fetchall():
    print(row)

print("\n--- Top Jobs (Match Score) ---")
cur.execute("SELECT title, company, match_score FROM jobs ORDER BY match_score DESC LIMIT 5")
for row in cur.fetchall():
    print(row)

print("\n--- Proposals ---")
cur.execute("SELECT id, job_title, status FROM proposals")
for row in cur.fetchall():
    print(row)

conn.close()
