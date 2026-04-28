import os
import asyncio
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

async def main():
    config = types.LiveConnectConfig(
        system_instruction=types.Content(parts=[types.Part.from_text(text="Say exactly: Hello test")]),
        response_modalities=["AUDIO"]
    )
    try:
        async with client.aio.live.connect(model="gemini-3.1-flash-live-preview", config=config) as session:
            await session.send_client_content(
                turns=[types.Content(role="user", parts=[types.Part.from_text(text="Say it.")])]
            )
            async for message in session.receive():
                if message.server_content and message.server_content.model_turn:
                    for part in message.server_content.model_turn.parts:
                        if part.text:
                            print("GOT TEXT:", part.text)
                        elif part.inline_data:
                            print("GOT AUDIO BYTES LEN:", len(part.inline_data.data))
                if message.server_content and message.server_content.turn_complete:
                    break
    except Exception as e:
        print("ERROR:", e)

asyncio.run(main())
