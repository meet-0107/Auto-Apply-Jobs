import sqlite3, os

db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'instance', 'local.sqlite')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("PRAGMA table_info(profiles)")
cols = [c[1] for c in cur.fetchall()]
print("Columns:", cols)

cur.execute("SELECT * FROM profiles")
rows = cur.fetchall()
print(f"\nTotal profile rows: {len(rows)}")
for i, row in enumerate(rows):
    print(f"\n--- Row {i+1} ---")
    for col, val in zip(cols, row):
        print(f"  {col}: {val}")

conn.close()
