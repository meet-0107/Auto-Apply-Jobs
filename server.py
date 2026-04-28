from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
import os
import json
import uuid
from datetime import datetime

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='Fronted', static_url_path='')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Serve asset directory
@app.route('/asset/<path:filename>')
def serve_assets(filename):
    return send_from_directory(os.path.join(basedir, 'asset'), filename)

# SQLite Database Configuration
basedir = os.path.abspath(os.path.dirname(__file__))
instance_path = os.path.join(basedir, 'instance')
if not os.path.exists(instance_path):
    os.makedirs(instance_path)

# Updated to use local.sqlite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(instance_path, 'local.sqlite')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- Models ---

class Profile(db.Model):
    __tablename__ = 'profiles'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    full_name = db.Column(db.String(100))
    email = db.Column(db.String(100), unique=True, nullable=False)  # Email = unique user key
    title = db.Column(db.String(100))
    primary_skills = db.Column(db.JSON, default=list)
    secondary_skills = db.Column(db.JSON, default=list)
    location_preference = db.Column(db.String(50))
    experience_level = db.Column(db.String(50))
    achievements = db.Column(db.Text)
    linkedin = db.Column(db.String(200))
    github = db.Column(db.String(200))
    portfolio = db.Column(db.String(200))
    job_type = db.Column(db.String(50))
    location = db.Column(db.String(100))
    salary_min = db.Column(db.Integer)
    salary_max = db.Column(db.Integer)
    salary = db.Column(db.Integer)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

class Job(db.Model):
    __tablename__ = 'jobs'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200))
    company = db.Column(db.String(100))
    location = db.Column(db.String(100))
    tags = db.Column(db.JSON) # List of tags
    source = db.Column(db.String(50))
    url = db.Column(db.String(500), unique=True)
    match_score = db.Column(db.Integer, default=0)
    status = db.Column(db.String(50), default='Pending')
    date_applied = db.Column(db.String(50))

class Proposal(db.Model):
    __tablename__ = 'proposals'
    id = db.Column(db.Integer, primary_key=True)
    job_title = db.Column(db.String(200))
    company = db.Column(db.String(100))
    proposal_text = db.Column(db.Text)
    match_score = db.Column(db.Integer)
    status = db.Column(db.String(50), default='Pending')
    date_applied = db.Column(db.String(50))

class ChatSession(db.Model):
    __tablename__ = 'chat_sessions'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = db.Column(db.String(200), default="New Chat")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ChatMessage(db.Model):
    __tablename__ = 'chat_messages'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    session_id = db.Column(db.String(36), db.ForeignKey('chat_sessions.id'), nullable=False)
    role = db.Column(db.String(50), nullable=False) # 'user' or 'ai'
    content = db.Column(db.Text, nullable=False)
    file_attachment = db.Column(db.String(255)) # filename if any
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class InterviewSession(db.Model):
    __tablename__ = 'interview_sessions'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_email = db.Column(db.String(100))
    target_job_title = db.Column(db.String(200))
    status = db.Column(db.String(50), default="In Progress")
    feedback = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class InterviewTranscript(db.Model):
    __tablename__ = 'interview_transcripts'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    session_id = db.Column(db.String(36), db.ForeignKey('interview_sessions.id'), nullable=False)
    role = db.Column(db.String(50), nullable=False) # 'user' or 'ai'
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# --- API Endpoints ---

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/profile', methods=['GET'])
def get_profile():
    """Get a single profile by email (?email=xxx@yyy.com)."""
    email = request.args.get('email', '').strip()
    if email:
        profile = Profile.query.filter_by(email=email).first()
    else:
        # Fallback: return the most recently created profile
        profile = Profile.query.order_by(Profile.id.desc()).first()
    if not profile:
        return jsonify({"message": "Profile not found"}), 404
    return jsonify(profile.to_dict())

@app.route('/api/profiles', methods=['GET'])
def list_profiles():
    """List all saved user profiles (id, full_name, email)."""
    profiles = Profile.query.order_by(Profile.id.asc()).all()
    return jsonify([{"id": p.id, "full_name": p.full_name, "email": p.email} for p in profiles])

@app.route('/api/profile', methods=['POST'])
def save_profile():
    """Create or update a profile. Email is the unique user key."""
    data = request.json
    if not data:
        return jsonify({"status": "error", "message": "No data received"}), 400

    email = (data.get('email') or '').strip()
    if not email:
        return jsonify({"status": "error", "message": "Email is required to save a profile"}), 400

    print(f"[*] Saving profile for email: {email}")

    try:
        # Upsert: find by email, or create a brand-new profile for this user
        profile = Profile.query.filter_by(email=email).first()
        if not profile:
            print(f"[*] No existing profile for {email}. Creating new profile...")
            profile = Profile(email=email)
            db.session.add(profile)
        else:
            print(f"[*] Found existing profile (id={profile.id}) for {email}. Updating...")

        # Update all fields except 'id' and 'email' (already set)
        for key, value in data.items():
            if key in ('id',):
                continue
            if hasattr(profile, key):
                setattr(profile, key, value)

        db.session.commit()
        print(f"[+] Profile saved: id={profile.id}, email={profile.email}")
        return jsonify({
            "status": "success",
            "message": "Profile saved successfully",
            "profile_id": profile.id,
            "email": profile.email
        })
    except Exception as e:
        import traceback
        print(f"[!] DB Error: {e}")
        traceback.print_exc()
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/profile', methods=['DELETE'])
def delete_profile():
    """Delete a profile by email (?email=xxx@yyy.com)."""
    email = request.args.get('email', '').strip()
    if not email:
        return jsonify({"status": "error", "message": "Email is required"}), 400
    profile = Profile.query.filter_by(email=email).first()
    if not profile:
        return jsonify({"status": "error", "message": "Profile not found"}), 404
    db.session.delete(profile)
    db.session.commit()
    return jsonify({"status": "success", "message": f"Profile for {email} deleted"})

@app.route('/api/jobs', methods=['GET'])
def get_jobs():
    jobs = Job.query.order_by(Job.match_score.desc()).all()
    return jsonify([{c.name: getattr(j, c.name) for c in j.__table__.columns} for j in jobs])

@app.route('/api/jobs/apply', methods=['POST'])
def apply_job_direct():
    data = request.json or {}
    job_id = data.get('job_id')
    if not job_id:
        return jsonify({"status": "error", "message": "job_id is required"}), 400
    
    job = Job.query.get(job_id)
    if not job:
        return jsonify({"status": "error", "message": "Job not found"}), 404
        
    job.status = 'Approved'
    job.date_applied = datetime.utcnow().strftime("%Y-%m-%d")
    db.session.commit()

    # Directly trigger apply_agent for this job with HITL support
    try:
        from Agents.apply_agent import apply_agent_app
        job_dict = {c.name: getattr(job, c.name) for c in job.__table__.columns}
        
        # Consistent thread ID for this job
        thread_id = f"job_{job_id}"
        config = {"configurable": {"thread_id": thread_id}}
        
        # Start or resume the agent
        print(f"[*] Triggering Apply Agent for {thread_id}...")
        apply_agent_app.invoke({"jobs": [job_dict], "application_results": []}, config=config)
        
        # Check if it paused (it should, due to interrupt_before=["apply_to_jobs"])
        snapshot = apply_agent_app.get_state(config)
        if snapshot.next:
            return jsonify({
                "status": "paused", 
                "message": f"Paused for approval: {job.title}",
                "thread_id": thread_id,
                "job_id": job_id
            })
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[-] Apply Agent Trigger Error: {e}")

    return jsonify({"status": "success", "message": f"Approved and triggered Agent for {job.title}"})

@app.route('/api/jobs/confirm_apply', methods=['POST'])
def confirm_apply():
    """Resume the Apply Agent from a paused state (HITL)."""
    data = request.json or {}
    thread_id = data.get('thread_id')
    
    if not thread_id:
        return jsonify({"status": "error", "message": "thread_id is required"}), 400
        
    try:
        from Agents.apply_agent import apply_agent_app
        config = {"configurable": {"thread_id": thread_id}}
        
        # Verify it is actually paused
        snapshot = apply_agent_app.get_state(config)
        if not snapshot.next:
            return jsonify({"status": "error", "message": "No paused application found for this thread."}), 404
            
        print(f"[*] Resuming Apply Agent for {thread_id}...")
        results = apply_agent_app.invoke(None, config=config)
        
        return jsonify({
            "status": "success",
            "message": "Applications submitted successfully",
            "results": results.get("application_results", [])
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/jobs/decline', methods=['POST'])
def decline_job_direct():
    data = request.json or {}
    job_id = data.get('job_id')
    if not job_id:
        return jsonify({"status": "error", "message": "job_id is required"}), 400
    
    job = Job.query.get(job_id)
    if not job:
        return jsonify({"status": "error", "message": "Job not found"}), 404
        
    job.status = 'Not applied'
    db.session.commit()
    return jsonify({"status": "success", "message": f"Declined {job.title}"})

@app.route('/api/proposals', methods=['GET'])
def get_proposals():
    try:
        proposals = Proposal.query.order_by(Proposal.id.desc()).all()
        return jsonify([{c.name: getattr(p, c.name) for c in p.__table__.columns} for p in proposals])
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/quota', methods=['GET'])
def get_quota():
    """Get the count of applications made today."""
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")
    try:
        jobs_count = Job.query.filter_by(status='Applied', date_applied=today).count()
        proposals_count = Proposal.query.filter_by(status='Applied', date_applied=today).count()
        return jsonify({"count": jobs_count, "limit": 10, "jobs_count": jobs_count, "proposals_count": proposals_count})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/scrape', methods=['POST'])
def scrape_jobs():
    """Trigger the consolidated job agent (Watcher + Scraper)."""
    try:
        from Agents.job_watch import job_agent_app
        data = request.json or {}
        email = data.get('email', '')
        search_term = data.get('search_term', 'Flutter Developer')
        location = data.get('location', 'Remote')
        
        print(f"[*] Triggering consolidated job agent for {email} ({search_term} in {location})")
        result = job_agent_app.invoke({
            "email": email,
            "search_term": search_term, 
            "location": location,
            "found_jobs": []
        })
        
        return jsonify({
            "status": "success", 
            "message": f"Scraping and matching complete. Found {len(result.get('found_jobs', []))} jobs.",
            "count": len(result.get('found_jobs', []))
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

# --- Chat API Endpoints ---

@app.route('/api/chat/sessions', methods=['GET'])
def get_chat_sessions():
    sessions = ChatSession.query.order_by(ChatSession.updated_at.desc()).all()
    return jsonify([{
        "id": s.id, 
        "title": s.title, 
        "created_at": s.created_at.isoformat(), 
        "updated_at": s.updated_at.isoformat()
    } for s in sessions])

@app.route('/api/chat/sessions', methods=['POST'])
def create_chat_session():
    data = request.json or {}
    title = data.get('title', 'New Chat')
    session = ChatSession(title=title)
    db.session.add(session)
    db.session.commit()
    return jsonify({
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat()
    })

@app.route('/api/chat/sessions/<session_id>', methods=['PUT'])
def rename_chat_session(session_id):
    session = ChatSession.query.get(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    data = request.json or {}
    new_title = data.get('title')
    if new_title:
        session.title = new_title
        db.session.commit()
    return jsonify({"status": "success", "title": session.title})

@app.route('/api/chat/sessions/<session_id>', methods=['DELETE'])
def delete_chat_session(session_id):
    session = ChatSession.query.get(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    # Delete associated messages first
    ChatMessage.query.filter_by(session_id=session_id).delete()
    db.session.delete(session)
    db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/chat/sessions/<session_id>/messages', methods=['GET'])
def get_chat_messages(session_id):
    messages = ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.timestamp.asc()).all()
    return jsonify([{
        "id": m.id,
        "role": m.role,
        "content": m.content,
        "file_attachment": m.file_attachment,
        "timestamp": m.timestamp.isoformat()
    } for m in messages])

@app.route('/api/chat/message', methods=['POST'])
def send_chat_message():
    from Agents.chat_agent import run_chat_agent
    session_id = request.form.get('session_id')
    content = request.form.get('content', '')
    
    if not session_id:
        return jsonify({"error": "session_id is required"}), 400
        
    session = ChatSession.query.get(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
        
    file = request.files.get('file')
    filename = None
    file_bytes = None
    
    if file:
        filename = file.filename
        file_bytes = file.read()
        
    # Save user message
    user_msg = ChatMessage(session_id=session_id, role='user', content=content, file_attachment=filename)
    db.session.add(user_msg)
    
    # Run Agent
    history = ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.timestamp.asc()).all()
    history_dicts = [{"role": m.role, "content": m.content} for m in history]
    
    # Process request using agent
    try:
        response_text = run_chat_agent(content, history_dicts, filename, file_bytes)
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
        
    # Save bot message
    bot_msg = ChatMessage(session_id=session_id, role='ai', content=response_text)
    db.session.add(bot_msg)
    
    # Update session modified time
    session.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        "status": "success",
        "response": response_text
    })

@app.route('/api/generate_bio', methods=['POST'])
def generate_bio_endpoint():
    try:
        from Agents.chat_agent import generate_bio
        data = request.json or {}
        bio = generate_bio(data)
        return jsonify({"status": "success", "bio": bio})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

import threading
import asyncio
from Agents.interview_agent import InterviewAgent

active_interviews = {}

# --- WebSocket Endpoints ---

@socketio.on('connect', namespace='/interview')
def test_connect():
    print('Client connected to interview namespace')
    emit('status', {'data': 'Connected'})

@socketio.on('start_interview', namespace='/interview')
def handle_start_interview(data):
    session_id = data.get('session_id', str(uuid.uuid4()))
    email = data.get('email', 'guest@example.com')
    job_title = data.get('target_job', 'Software Engineer')
    
    profile = {}
    p = Profile.query.filter_by(email=email).first()
    if p:
        profile = p.to_dict()
        
    resume_text = data.get('resume_text', "Candidate Resume: Has experience in web development, python, and javascript.")
    
    # Save session
    session = InterviewSession(id=session_id, user_email=email, target_job_title=job_title)
    db.session.add(session)
    db.session.commit()
    
    agent = InterviewAgent(session_id, profile, job_title, resume_text)
    active_interviews[request.sid] = agent
    
    def run_agent():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        def emit_func(event, payload):
            socketio.emit(event, payload, to=request.sid, namespace='/interview')
            
        agent.loop = loop
        loop.run_until_complete(agent.connect(emit_func))

    threading.Thread(target=run_agent).start()
    emit('status', {'data': 'Interview Started', 'session_id': session_id})

@socketio.on('disconnect', namespace='/interview')
def test_disconnect():
    print('Client disconnected from interview namespace')
    agent = active_interviews.pop(request.sid, None)
    if agent:
        # Run close in a new event loop or just let it die
        try:
            loop = asyncio.new_event_loop()
            loop.run_until_complete(agent.close())
        except:
            pass

@socketio.on('audio_stream', namespace='/interview')
def handle_audio(data):
    agent = active_interviews.get(request.sid)
    if agent and 'audio' in data and hasattr(agent, 'loop'):
        try:
            asyncio.run_coroutine_threadsafe(agent.send_audio(data['audio']), agent.loop)
        except Exception as e:
            print(f"Error sending audio: {e}")

if __name__ == '__main__':
    # Ensure database is created
    with app.app_context():
        db.create_all()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
