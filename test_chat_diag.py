import traceback
import sys
import os

try:
    # Set up path if needed
    sys.path.append(os.getcwd())
    
    from Agents.chat_agent import run_chat_agent
    print("Agent imported successfully.")
    
    result = run_chat_agent('hi', [])
    print("Result:", result)
except Exception as e:
    traceback.print_exc()
