// interview.js

let socket;
let audioContext;
let mediaStream;
let audioProcessor;
let isInterviewActive = false;

// We use an AudioContext to play back the audio chunks from the server
let playContext;
let audioQueue = [];
let isPlaying = false;

document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startInterviewBtn');
    const endBtn = document.getElementById('endInterviewBtn');
    const statusText = document.getElementById('interviewStatus');
    const avatarContainer = document.querySelector('.avatar-container');
    const transcriptArea = document.getElementById('transcriptArea');

    if (!startBtn) return; // Not on interview page/component

    startBtn.addEventListener('click', startInterview);
    endBtn.addEventListener('click', endInterview);

    async function startInterview() {
        try {
            // 1. Request microphone access
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // 2. Initialize Socket.io connection to the /interview namespace
            // Assuming socket.io.js is loaded in index.html
            socket = io(window.location.origin + '/interview');
            
            socket.on('connect', () => {
                console.log('Connected to interview socket');
                statusText.innerText = 'Connecting to Agent...';
                
                // Fetch profile/resume info from localStorage or set defaults
                const email = localStorage.getItem('userEmail') || 'guest@example.com';
                
                socket.emit('start_interview', {
                    email: email,
                    target_job: 'Software Engineer', // Ideally from UI selection
                    resume_text: 'Experienced developer.' // Ideally from Profile
                });
            });

            socket.on('status', (data) => {
                if (data.data === 'Interview Started') {
                    isInterviewActive = true;
                    statusText.innerText = 'Agent is listening...';
                    startBtn.style.display = 'none';
                    endBtn.style.display = 'block';
                    avatarContainer.classList.add('is-listening');
                    startAudioCapture();
                }
            });

            socket.on('agent_audio', async (data) => {
                // Received base64 audio chunk from AI
                if (data.audio) {
                    playAudioChunk(data.audio);
                    avatarContainer.classList.remove('is-listening');
                    avatarContainer.classList.add('is-speaking');
                    statusText.innerText = 'Agent is speaking...';
                }
            });

            socket.on('agent_message', (data) => {
                // Received text transcript
                appendTranscript(data.role, data.content);
                if (data.role === 'ai') {
                    // After AI finishes speaking, go back to listening
                    setTimeout(() => {
                        avatarContainer.classList.remove('is-speaking');
                        avatarContainer.classList.add('is-listening');
                        statusText.innerText = 'Agent is listening...';
                    }, 1000);
                }
            });

            socket.on('agent_error', (data) => {
                console.error("Agent Error:", data.message);
                statusText.innerText = 'Error: ' + data.message;
                statusText.style.color = '#ef4444';
            });

        } catch (err) {
            console.error('Error starting interview:', err);
            statusText.innerText = 'Error accessing microphone. Please allow permissions.';
        }
    }

    function endInterview() {
        isInterviewActive = false;
        
        if (mediaStream) {
            mediaStream.getTracks().forEach(t => t.stop());
        }
        if (audioContext) {
            audioContext.close();
        }
        if (socket) {
            socket.disconnect();
        }
        
        startBtn.style.display = 'block';
        endBtn.style.display = 'none';
        avatarContainer.classList.remove('is-listening');
        avatarContainer.classList.remove('is-speaking');
        statusText.innerText = 'Interview Ended';
    }

    function startAudioCapture() {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        const source = audioContext.createMediaStreamSource(mediaStream);
        
        // ScriptProcessor is deprecated but widely supported and easiest for raw PCM capture
        audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
        
        audioProcessor.onaudioprocess = (e) => {
            if (!isInterviewActive || !socket) return;
            
            const inputData = e.inputBuffer.getChannelData(0);
            
            // Convert Float32 to Int16 PCM (the format OpenAI Realtime expects)
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                let s = Math.max(-1, Math.min(1, inputData[i]));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // Convert to base64
            const buffer = new Uint8Array(pcmData.buffer);
            let binary = '';
            for (let i = 0; i < buffer.byteLength; i++) {
                binary += String.fromCharCode(buffer[i]);
            }
            const base64Audio = btoa(binary);
            
            socket.emit('audio_stream', { audio: base64Audio });
        };
        
        source.connect(audioProcessor);
        audioProcessor.connect(audioContext.destination);
    }

    function playAudioChunk(base64Audio) {
        if (!playContext) {
            playContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        }
        
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // OpenAI returns 24kHz Int16 PCM
        const int16Array = new Int16Array(bytes.buffer);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 0x8000;
        }
        
        const audioBuffer = playContext.createBuffer(1, float32Array.length, 24000);
        audioBuffer.getChannelData(0).set(float32Array);
        
        const source = playContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(playContext.destination);
        
        // Simple queuing can be added here if chunks overlap, but for now we play immediately
        source.start();
    }

    function appendTranscript(role, text) {
        if (transcriptArea.innerHTML.includes('Transcript will appear here')) {
            transcriptArea.innerHTML = '';
        }
        
        const div = document.createElement('div');
        div.className = `transcript-message msg-${role === 'ai' ? 'ai' : 'user'}`;
        
        const label = document.createElement('strong');
        label.innerText = role === 'ai' ? 'Agent: ' : 'You: ';
        
        const span = document.createElement('span');
        span.innerText = text;
        
        div.appendChild(label);
        div.appendChild(span);
        transcriptArea.appendChild(div);
        
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
    }
});
