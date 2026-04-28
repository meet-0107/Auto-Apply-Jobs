import os
import io
import fitz  # PyMuPDF
from docx import Document
from typing import TypedDict, Annotated, Sequence
import operator

from dotenv import load_dotenv
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END

# ---------------- LOAD ENV ----------------
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

# State Definition
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]

# ---------------- LLM ----------------
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",   # ✅ updated
    google_api_key=api_key,
    temperature=0.7
)

def get_file_text(filename, file_bytes):
    if not filename or not file_bytes:
        return ""
    
    ext = filename.split('.')[-1].lower()
    text = f"\n\n--- Content of uploaded file: {filename} ---\n"
    
    try:
        if ext == 'txt':
            text += file_bytes.decode('utf-8', errors='ignore')
        elif ext == 'pdf':
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            for page in doc:
                text += page.get_text()
        elif ext == 'docx':
            doc = Document(io.BytesIO(file_bytes))
            for para in doc.paragraphs:
                text += para.text + "\n"
        else:
            text += "Unsupported file format."
    except Exception as e:
        text += f"Error reading file {filename}: {str(e)}"
        
    text += "\n------------------------------------\n"
    return text

def chatbot(state: AgentState):
    response = llm.invoke(state["messages"])
    return {"messages": [response]}

# Define Graph
graph_builder = StateGraph(AgentState)
graph_builder.add_node("chatbot", chatbot)
graph_builder.add_edge("chatbot", END)
graph_builder.set_entry_point("chatbot")
langgraph_app = graph_builder.compile()

def run_chat_agent(content: str, history: list, filename: str = None, file_bytes: bytes = None) -> str:
    """
    history format: [{"role": "user"|"ai", "content": "..."}]
    """
    print(f"[*] Running chat agent for content: {content[:50]}...")
    system_msg = SystemMessage(content="You are a helpful, professional AI assistant for a user's web platform. Provide clear and actionable answers. Use Markdown for formatting. If the user attaches a file, use its content to answer their question.")
    
    messages = [system_msg]
    
    # Convert history
    for msg in history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))
            
    # File Context
    file_text = get_file_text(filename, file_bytes)
    final_content = content + file_text
    
    messages.append(HumanMessage(content=final_content))
    
    # Invoke LangGraph workflow
    result = langgraph_app.invoke({"messages": messages})
    last_message = result["messages"][-1]
    
    return last_message.content

def generate_bio(resume_data: dict) -> str:
    """Generate a professional bio using the provided resume data."""
    prompt = f"Write a brief, professional resume summary (bio) in 3-4 sentences based on the following details. Be concise and impactful. Do NOT include greetings or extraneous conversational text. Return only the summary text.\n\n"
    
    personal = resume_data.get("personal", {})
    if personal.get("fullName"):
        prompt += f"Name: {personal.get('fullName')}\n"
    if personal.get("jobTitle"):
        prompt += f"Job Title: {personal.get('jobTitle')}\n"
        
    experience = resume_data.get("experience", [])
    if experience:
        prompt += "Experience:\n"
        for exp in experience:
            prompt += f"- {exp.get('role')} at {exp.get('company')} ({exp.get('duration')}): {exp.get('description')}\n"
            
    skills = resume_data.get("skills", {})
    primary = skills.get("primary", [])
    if primary:
        prompt += f"Primary Skills: {', '.join(primary)}\n"
        
    messages = [HumanMessage(content=prompt)]
    response = llm.invoke(messages)
    return response.content.strip()
