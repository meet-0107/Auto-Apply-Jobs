import urllib.request, json

BASE = 'http://127.0.0.1:5000'

def post(path, data):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(data).encode(),
        headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except Exception as e:
        return str(e)

def get(path):
    try:
        with urllib.request.urlopen(BASE + path) as r:
            return json.loads(r.read())
    except Exception as e:
        return str(e)


