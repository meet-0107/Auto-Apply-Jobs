/* resume-chat.js - Modernized */

let currentSessionId = null;
let currentFile = null;

// document.addEventListener('DOMContentLoaded', () => {
//     initResumeChat();
// });

// Exposed globally for suggestions in HTML
window.setInputValue = function(text) {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.value = text;
        chatInput.focus();
        // Trigger resize
        chatInput.dispatchEvent(new Event('input'));
    }
};

window.initResumeChat = function() {
    const newChatBtn = document.getElementById('new-chat-btn');
    const deleteChatBtn = document.getElementById('delete-chat-btn');
    const renameChatBtn = document.getElementById('rename-chat-btn');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const fileUpload = document.getElementById('chat-file-upload');
    const removeFileBtn = document.getElementById('remove-file-btn');

    if (!newChatBtn) return;

    loadSessions();

    newChatBtn.addEventListener('click', () => {
        startNewConversation();
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        sendMessage();
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto resize textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        
        // Disable send button if empty
        document.getElementById('send-msg-btn').disabled = !this.value.trim() && !currentFile;
    });

    fileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            currentFile = file;
            document.getElementById('file-preview-name').textContent = file.name;
            document.getElementById('file-preview-container').style.display = 'block';
            document.getElementById('send-msg-btn').disabled = false;
        }
    });

    removeFileBtn.addEventListener('click', () => {
        currentFile = null;
        fileUpload.value = '';
        document.getElementById('file-preview-container').style.display = 'none';
        document.getElementById('send-msg-btn').disabled = !chatInput.value.trim();
    });
    
    deleteChatBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!currentSessionId) {
            console.warn("No active session to delete");
            return;
        }
        
        try {
            console.log("Deleting session:", currentSessionId);
            const response = await fetch(`/api/chat/sessions/${currentSessionId}`, { method: 'DELETE' });
            if (response.ok) {
                startNewConversation();
                loadSessions();
            } else {
                console.error("Failed to delete session:", await response.text());
            }
        } catch (err) { 
            console.error("Error during delete:", err);
        }
    });

    renameChatBtn.addEventListener('click', async () => {
        if (!currentSessionId) return;
        const titleEl = document.getElementById('current-chat-title');
        titleEl.contentEditable = "true";
        titleEl.focus();
        
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(titleEl);
        selection.removeAllRanges();
        selection.addRange(range);
        
        titleEl.style.borderBottom = "2px solid var(--chat-accent)";
        
        const finishRename = async () => {
            titleEl.contentEditable = "false";
            titleEl.style.borderBottom = "none";
            const newTitle = titleEl.textContent.trim();
            if (newTitle) {
                await renameTitleTo(newTitle);
            }
        };

        titleEl.addEventListener('blur', finishRename, { once: true });
        titleEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                titleEl.blur();
            }
        });
    });
}

function startNewConversation() {
    currentSessionId = null;
    document.getElementById('current-chat-title').textContent = 'New Chat';
    const msgsList = document.getElementById('messages-list');
    if (msgsList) msgsList.innerHTML = '';
    
    const emptyState = document.getElementById('chat-empty-state');
    if (emptyState) emptyState.style.display = 'flex';
    
    document.getElementById('delete-chat-btn').style.display = 'none';
    document.getElementById('rename-chat-btn').style.display = 'none';
    
    document.querySelectorAll('.chat-session-item').forEach(el => {
        el.classList.remove('active');
    });
}

async function loadSessions() {
    try {
        const res = await fetch('/api/chat/sessions');
        const sessions = await res.json();
        const listEl = document.getElementById('chat-history-list');
        listEl.innerHTML = '';
        
        sessions.forEach(session => {
            const item = document.createElement('div');
            item.className = 'chat-session-item' + (session.id === currentSessionId ? ' active' : '');
            item.dataset.id = session.id;
            item.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <span class="session-title-text">${session.title}</span>
            `;
            item.addEventListener('click', () => {
                switchSession(session.id, session.title);
            });
            listEl.appendChild(item);
        });
    } catch (err) {
        console.error("Error loading chat sessions:", err);
    }
}

async function switchSession(id, title) {
    currentSessionId = id;
    document.getElementById('current-chat-title').textContent = title;
    document.getElementById('delete-chat-btn').style.display = 'flex';
    document.getElementById('rename-chat-btn').style.display = 'flex';
    
    // Hide empty state
    const emptyState = document.getElementById('chat-empty-state');
    if (emptyState) emptyState.style.display = 'none';
    
    // Update active class
    document.querySelectorAll('.chat-session-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === id);
    });
    
    // Load messages
    const msgsList = document.getElementById('messages-list');
    if (msgsList) msgsList.innerHTML = '<div style="text-align:center; padding: 40px; color: #94a3b8;">Loading conversation...</div>';
    
    try {
        const res = await fetch(`/api/chat/sessions/${id}/messages`);
        const messages = await res.json();
        if (msgsList) msgsList.innerHTML = '';
        
        if (messages.length === 0 && emptyState) {
            emptyState.style.display = 'flex';
        } else {
            messages.forEach(msg => {
                appendMessage(msg.role, msg.content, msg.timestamp, msg.file_attachment);
            });
        }
        scrollToBottom();
    } catch (err) {
        console.error("Error loading messages:", err);
        if (msgsList) msgsList.innerHTML = '';
    }
}

async function createNewSession(initialMessage = "") {
    try {
        const title = initialMessage ? initialMessage.substring(0, 30) + (initialMessage.length > 30 ? '...' : '') : 'New Chat';
        const res = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title })
        });
        const session = await res.json();
        currentSessionId = session.id;
        document.getElementById('current-chat-title').textContent = title;
        
        // Clear messages and hide empty state
        const msgsList = document.getElementById('messages-list');
        if (msgsList) msgsList.innerHTML = '';
        const emptyState = document.getElementById('chat-empty-state');
        if (emptyState) emptyState.style.display = 'none';
        
        document.getElementById('delete-chat-btn').style.display = 'flex';
        document.getElementById('rename-chat-btn').style.display = 'flex';
        loadSessions();
        return session.id;
    } catch (err) {
        console.error("Error creating session:", err);
        return null;
    }
}

async function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const text = chatInput.value.trim();
    if (!text && !currentFile) return;
    
    // Reset input
    chatInput.value = '';
    chatInput.style.height = 'auto'; 
    document.getElementById('send-msg-btn').disabled = true;
    
    const fileToSend = currentFile;
    if (fileToSend) {
        document.getElementById('remove-file-btn').click(); // clears currentFile
    }
    
    if (!currentSessionId) {
        await createNewSession(text ? text : "File Attachment");
    } else {
        // If we were on empty state, hide it now
        const emptyState = document.getElementById('chat-empty-state');
        if (emptyState) emptyState.style.display = 'none';
    }
    
    // Optimistic UI update
    appendMessage('user', text, new Date().toISOString(), fileToSend ? fileToSend.name : null);
    scrollToBottom();
    
    // Show typing
    document.getElementById('chat-typing-indicator').style.display = 'block';
    
    const formData = new FormData();
    formData.append('session_id', currentSessionId);
    formData.append('content', text);
    if (fileToSend) formData.append('file', fileToSend);
    
    try {
        const res = await fetch('/api/chat/message', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        document.getElementById('chat-typing-indicator').style.display = 'none';
        
        if (data.status === 'success') {
            appendMessage('ai', data.response, new Date().toISOString());
        } else {
            appendMessage('ai', 'Error: ' + data.error, new Date().toISOString());
        }
    } catch (err) {
        document.getElementById('chat-typing-indicator').style.display = 'none';
        appendMessage('ai', 'Network Error: Failed to reach AI.', new Date().toISOString());
    }
    scrollToBottom();
}

async function renameTitleTo(newTitle) {
    if(!currentSessionId) return;
    try {
        await fetch(`/api/chat/sessions/${currentSessionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
        });
        document.getElementById('current-chat-title').textContent = newTitle;
        loadSessions();
    } catch (e) {}
}

function appendMessage(role, content, timestamp, fileName = null) {
    const msgsContainer = document.getElementById('chat-messages');
    
    // Remove empty state if it's there
    const emptyState = document.getElementById('chat-empty-state');
    if (emptyState && msgsContainer.contains(emptyState)) {
        emptyState.style.display = 'none';
    }

    const rowWrapper = document.createElement('div');
    rowWrapper.className = `chat-message-row ${role}`;
    
    const avatarIcon = role === 'ai' ? `
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
        </svg>` : `
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
        </svg>`;

    let fileHTML = '';
    if (fileName) {
        fileHTML = `<div class="msg-attachment">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
            <span>${fileName}</span>
        </div>`;
    }
    
    let parsedContent = '';
    if (role === 'ai') {
        parsedContent = parseMarkdown(content);
    } else {
        parsedContent = content.replace(/\n/g, '<br>');
    }
    
    const timeString = new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    rowWrapper.innerHTML = `
        <div class="chat-avatar ${role}-avatar">${avatarIcon}</div>
        <div class="chat-bubble">
            ${fileHTML}
            <div class="chat-content">${parsedContent}</div>
            <span class="timestamp">${timeString}</span>
        </div>
    `;
    const msgsList = document.getElementById('messages-list');
    if (msgsList) {
        msgsList.appendChild(rowWrapper);
    } else {
        msgsContainer.appendChild(rowWrapper);
    }
}

function scrollToBottom() {
    const msgsContainer = document.getElementById('chat-messages');
    msgsContainer.scrollTop = msgsContainer.scrollHeight;
}

// Minimal Markdown parser
function parseMarkdown(text) {
    if (!text) return '';
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Code blocks
    html = html.replace(/```(?:[a-z]*)\n([\s\S]*?)```/gi, '<pre><code>$1</code></pre>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2>$1</h2>');
    // Lists
    html = html.replace(/^\* (.*$)/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/<\/ul>\n<ul>/gim, ''); 
    
    // Newlines (not inside pre)
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, function(match, inner) {
        return '<pre><code>' + inner.replace(/<br>/g, '\n') + '</code></pre>';
    });
    
    return html;
}
