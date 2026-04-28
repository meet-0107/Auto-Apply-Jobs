import sqlite3
import os

db_path = os.path.join('instance', 'local.sqlite')
if not os.path.exists(db_path):
    print(f"Error: Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cur = conn.cursor()

print("--- Profiles Table Schema ---")
cur.execute("PRAGMA table_info(profiles)")
for row in cur.fetchall():
    print(row)

print("\n--- Current Profiles Data ---")
cur.execute("SELECT * FROM profiles")
for row in cur.fetchall():
    print(row)

conn.close()
