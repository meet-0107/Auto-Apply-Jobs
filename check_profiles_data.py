import os, sqlite3

db_path = os.path.join('instance', 'local.sqlite')
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute('SELECT * FROM profiles')
cols = [desc[0] for desc in cur.description]
rows = cur.fetchall()

print('--- Profiles Data (Detailed) ---')
for row in rows:
    data = dict(zip(cols, row))
    for k, v in data.items():
        print(f"{k}: {v}")
    print("-" * 20)
conn.close()
