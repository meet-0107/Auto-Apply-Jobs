import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
client = genai.Client()
models = client.models.list()
for m in models:
    if 'live' in m.name:
        print(m.name, getattr(m, 'supported_generation_methods', []))
