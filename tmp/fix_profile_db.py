"""
Fix: Remove UNIQUE constraint on 'email' column in profiles table.
SQLite does not support ALTER TABLE DROP CONSTRAINT, so we recreate the table.
"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'instance', 'local.sqlite')
print(f"[*] Connecting to: {db_path}")

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Check existing schema
cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='profiles'")
schema = cur.fetchone()
print(f"[*] Current schema:\n{schema[0] if schema else 'Table not found'}\n")

if schema and 'UNIQUE' in (schema[0] or '').upper():
    print("[!] Found UNIQUE constraint on profiles table. Fixing...")

    # Get existing data
    cur.execute("SELECT * FROM profiles")
    rows = cur.fetchall()
    cur.execute("PRAGMA table_info(profiles)")
    col_info = cur.fetchall()
    col_names = [c[1] for c in col_info]
    print(f"[*] Existing columns: {col_names}")
    print(f"[*] Existing rows: {len(rows)}")

    # New table without UNIQUE on email
    new_schema = """CREATE TABLE profiles_new (
        id INTEGER NOT NULL PRIMARY KEY,
        full_name VARCHAR(100),
        email VARCHAR(100),
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
    )"""

    cur.execute(new_schema)
    print("[*] Created new profiles table (no UNIQUE on email).")

    # Copy data
    if rows:
        placeholders = ', '.join(['?' for _ in col_names])
        cur.executemany(
            f"INSERT INTO profiles_new ({', '.join(col_names)}) VALUES ({placeholders})",
            rows
        )
        print(f"[*] Copied {len(rows)} row(s) to new table.")

    # Replace
    cur.execute("DROP TABLE profiles")
    cur.execute("ALTER TABLE profiles_new RENAME TO profiles")
    conn.commit()
    print("[+] Done! profiles table fixed (UNIQUE constraint removed from email).")
else:
    print("[OK] No UNIQUE constraint found on email, or table doesn't exist yet.")
    print("     The server will create it fresh when it starts.")

conn.close()
print("[+] Database migration complete.")
