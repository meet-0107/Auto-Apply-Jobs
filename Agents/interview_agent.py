import os
import json
import asyncio
import base64
from datetime import datetime
from google import genai
from google.genai import types

class InterviewAgent:
    def __init__(self, session_id, user_profile, target_job, resume_text):
        self.session_id = session_id
        self.user_profile = user_profile
        self.target_job = target_job
        self.resume_text = resume_text
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None
        self.session = None
        self.listen_task = None
        
        # System instructions based on profile, target job, and resume
        self.instructions = f"""
        You are an expert technical interviewer. The candidate is applying for the '{self.target_job}' role.
        Their profile summary: {json.dumps(self.user_profile)}
        Their resume details: {self.resume_text}
        
        Start with a basic introductory question (e.g., "Tell me about yourself"). 
        Then move into specific technical or behavioral questions based on their resume experience and the target role.
        Ask probing questions about specific projects listed on their resume.
        Ask ONE question at a time. Do not overwhelm the candidate.
        Keep your responses concise and natural.
        """

    async def connect(self, emit_func):
        """Connects to Gemini Live API (or runs a mock if no key)."""
        if not self.api_key:
            print("[Interview Agent] WARNING: No GEMINI_API_KEY found. Running in mock mode.")
            emit_func("agent_message", {"type": "text", "content": "Hello! I am your AI interviewer. Since no API key is provided, I'm in mock mode.", "role": "ai"})
            return

        print(f"[Interview Agent] Connecting to Gemini Live API for session {self.session_id}")
        await self._run_session(emit_func)

    async def _run_session(self, emit_func):
        config = types.LiveConnectConfig(
            system_instruction=types.Content(parts=[types.Part.from_text(text=self.instructions)]),
            response_modalities=["AUDIO"]
        )
        try:
            async with self.client.aio.live.connect(model="gemini-3.1-flash-live-preview", config=config) as session:
                self.session = session
                
                # Send initial prompt to kick off the interview
                await session.send(input="Hello, I am the candidate. Please begin the interview by asking the first question.", end_of_turn=True)
                
                # Listen for responses
                async for message in session.receive():
                    if message.server_content and message.server_content.model_turn:
                        for part in message.server_content.model_turn.parts:
                            if part.text:
                                emit_func("agent_message", {"type": "text", "content": part.text, "role": "ai"})
                            elif part.inline_data:
                                # Send audio bytes back to the client
                                b64 = base64.b64encode(part.inline_data.data).decode('utf-8')
                                emit_func("agent_audio", {"audio": b64})
        except Exception as e:
            print(f"[Interview Agent] Connection error: {e}")
            emit_func("agent_error", {"message": str(e)})
        finally:
            self.session = None

    async def send_audio(self, base64_audio_chunk):
        """Sends an audio chunk from the user to the Gemini Realtime API."""
        if self.session:
            audio_bytes = base64.b64decode(base64_audio_chunk)
            try:
                await self.session.send(input={"mime_type": "audio/pcm;rate=24000", "data": audio_bytes})
            except Exception as e:
                print(f"[Interview Agent] Error sending audio chunk: {e}")

    async def close(self):
        if self.listen_task:
            self.listen_task.cancel()
