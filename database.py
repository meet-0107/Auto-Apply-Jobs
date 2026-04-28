from flask_sqlalchemy import SQLAlchemy
import uuid
from datetime import datetime

db = SQLAlchemy()

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
    status = db.Column(db.String(50), default='Pending') # 'Pending', 'Applied', 'Not applied'
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
