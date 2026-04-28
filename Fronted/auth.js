document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLink = document.getElementById('show-login');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const authMessage = document.getElementById('auth-message');

    // Check URL params for initial mode
    const urlParams = new URLSearchParams(window.location.search);
    const initialMode = urlParams.get('mode');

    function switchMode(mode) {
        authMessage.style.display = 'none';
        authMessage.className = 'auth-message';
        
        if (mode === 'signup') {
            loginForm.classList.remove('active');
            signupForm.classList.add('active');
            authTitle.textContent = 'Create an Account';
            authSubtitle.textContent = 'Join Autly to automate your job search.';
        } else {
            signupForm.classList.remove('active');
            loginForm.classList.add('active');
            authTitle.textContent = 'Welcome Back';
            authSubtitle.textContent = 'Log in to continue automating your job search.';
        }
    }

    if (initialMode === 'signup') {
        switchMode('signup');
    }

    showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        switchMode('signup');
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        switchMode('login');
    });

    function showMessage(msg, type) {
        authMessage.textContent = msg;
        authMessage.className = `auth-message ${type}`;
    }

    // Login Handle
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const btn = document.getElementById('login-btn');
        const origText = btn.textContent;
        
        btn.textContent = 'Logging in...';
        btn.disabled = true;

        try {
            // Check if profile exists
            const res = await fetch(`/api/profile?email=${encodeURIComponent(email)}`);
            if (res.ok) {
                const profile = await res.json();
                localStorage.setItem('gig_auto_active_email', profile.email);
                showMessage('Login successful! Redirecting...', 'success');
                setTimeout(() => window.location.href = 'main.html', 800);
            } else {
                showMessage('Account not found. Please sign up first.', 'error');
                btn.textContent = origText;
                btn.disabled = false;
            }
        } catch (error) {
            showMessage('Connection error. Please try again.', 'error');
            btn.textContent = origText;
            btn.disabled = false;
        }
    });

    // Signup Handle
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const btn = document.getElementById('signup-btn');
        const origText = btn.textContent;
        
        btn.textContent = 'Signing up...';
        btn.disabled = true;

        try {
            // First check if already exists
            const checkRes = await fetch(`/api/profile?email=${encodeURIComponent(email)}`);
            if (checkRes.ok) {
                showMessage('Account already exists. Please log in.', 'error');
                btn.textContent = origText;
                btn.disabled = false;
                return;
            }

            // Create new profile
            const profileData = {
                full_name: name,
                email: email
            };

            const res = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData)
            });

            if (res.ok) {
                localStorage.setItem('gig_auto_active_email', email);
                showMessage('Account created! Redirecting...', 'success');
                setTimeout(() => window.location.href = 'main.html', 800);
            } else {
                showMessage('Failed to create account.', 'error');
                btn.textContent = origText;
                btn.disabled = false;
            }
        } catch (error) {
            showMessage('Connection error. Please try again.', 'error');
            btn.textContent = origText;
            btn.disabled = false;
        }
    });
});
