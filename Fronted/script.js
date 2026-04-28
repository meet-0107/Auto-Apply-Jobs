document.addEventListener('DOMContentLoaded', () => {
    // Component Initializations (HTML is already embedded in main.html)
    if (window.initSettings) initSettings();
    if (window.initProfile) initProfile();
    if (window.initDashboardComponent) initDashboardComponent();
    if (window.initApplications) initApplications();
    if (window.initResumeBuilder) initResumeBuilder();

    // Navigation and View Switching
    const dashboardView = document.getElementById('dashboard-view');
    const profileView = document.getElementById('profile-view');
    const applicationsView = document.getElementById('applications-view');
    const settingsView = document.getElementById('settings-view');
    const resumeBuilderView = document.getElementById('resume-builder-view');
    const resumeChatView = document.getElementById('resume-chat-view');
    const interviewView = document.getElementById('interview-view');

    const navItems = document.querySelectorAll('.nav-item');
    const toolLinks = document.querySelectorAll('.tool-link');
    const headerAppsBtn = document.getElementById('header-apps-btn');

    function showView(viewName) {
        console.log('Switching to view:', viewName);

        // Hide all views
        const views = [dashboardView, profileView, applicationsView, settingsView, resumeBuilderView, resumeChatView, interviewView];
        views.forEach(v => { if (v) v.style.display = 'none'; });

        const titleEl = document.getElementById('current-view-title');

        // Show target view
        const viewMap = {
            'dashboard': { el: dashboardView, title: 'Dashboard' },
            'profile': { el: profileView, title: 'Profile Details' },
            'applications': { el: applicationsView, title: 'Applications & Discovery' },
            'settings': { el: settingsView, title: 'Settings' },
            'resume-builder': { el: resumeBuilderView, title: 'Resume Builder' },
            'resume-chat': { el: resumeChatView, title: 'Chat with Resume' },
            'interview': { el: interviewView, title: 'Mock Interview' }
        };

        if (viewMap[viewName] && viewMap[viewName].el) {
            const targetView = viewMap[viewName].el;
            targetView.style.display = 'block';
            if (titleEl) titleEl.innerText = viewMap[viewName].title;

            // Dynamic loading for resume-builder if empty
            if (viewName === 'resume-builder' && targetView.innerHTML.trim().length < 1000) {
                fetch('components/tools/Resume_builder/resume-builder.html')
                    .then(response => response.text())
                    .then(html => {
                        targetView.innerHTML = html;
                        // Re-initialize logic once HTML is present
                        if (window.initResumeBuilder) initResumeBuilder();
                    })
                    .catch(err => console.error("Error loading resume-builder.html:", err));
            }

            // Dynamic loading for resume-chat if empty
            if (viewName === 'resume-chat' && targetView.innerHTML.trim().length < 100) {
                fetch('components/tools/Resume_chat/resume-chat.html')
                    .then(response => response.text())
                    .then(html => {
                        targetView.innerHTML = html;
                        // Re-initialize chat logic once HTML is present
                        if (window.initResumeChat) window.initResumeChat();
                    })
                    .catch(err => console.error("Error loading resume-chat.html:", err));
            }

            // Dynamic loading for interview if empty
            if (viewName === 'interview' && targetView.innerHTML.trim().length < 100) {
                fetch('components/tools/Mock_Interview/interview.html')
                    .then(response => response.text())
                    .then(html => {
                        targetView.innerHTML = html;
                        // Dispatch event so interview.js can re-attach listeners
                        document.dispatchEvent(new Event('DOMContentLoaded'));
                    })
                    .catch(err => console.error("Error loading interview.html:", err));
            }
        }

        // Update nav active state
        navItems.forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-view') === viewName);
        });

        toolLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-view') === viewName);
        });
    }

    // Expose showView to window scope
    window.showView = showView;

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            if (view) showView(view);
        });
    });

    toolLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.getAttribute('data-view');
            if (view) showView(view);
        });
    });

    if (headerAppsBtn) {
        headerAppsBtn.addEventListener('click', () => {
            showView('applications');
        });
    }

    // Initialize default view
    showView('dashboard');

    // Global Agent Status UI Manager
    window.updateAgentStatusUI = function (isActive) {
        const dashboardAgentPulse = document.querySelector('#dashboard-agent-pulse');
        const dashboardAgentText = document.querySelector('#dashboard-agent-text');
        const agentStatusCard = document.querySelector('#agent-status-card');
        const appAgentStatusLabel = document.querySelector('#agent-status-label');

        // Dashboard cards to toggle
        const cardApps = document.getElementById('card-applications-total');
        const cardMatch = document.getElementById('card-match-profile');
        const cardAuto = document.getElementById('card-automation-app');
        const sidebarQuota = document.getElementById('sidebar-daily-quota');
        const sidebarMatch = document.getElementById('sidebar-match-rate');

        if (isActive) {
            if (cardApps) cardApps.style.display = '';
            if (cardMatch) cardMatch.style.display = '';
            if (cardAuto) cardAuto.style.display = '';
            if (sidebarQuota) sidebarQuota.style.display = '';
            if (sidebarMatch) sidebarMatch.style.display = '';

            if (dashboardAgentPulse) {
                dashboardAgentPulse.classList.remove('deactive');
                dashboardAgentPulse.classList.add('active');
            }
            if (dashboardAgentText) {
                dashboardAgentText.textContent = 'Active';
                dashboardAgentText.style.color = 'var(--text-main)';
            }
            if (agentStatusCard) {
                agentStatusCard.title = "Agent is active and monitoring jobs";
            }
            if (appAgentStatusLabel) {
                appAgentStatusLabel.textContent = 'Online';
                appAgentStatusLabel.classList.add('online');
                appAgentStatusLabel.classList.remove('offline');
            }
        } else {
            if (cardApps) cardApps.style.display = 'none';
            if (cardMatch) cardMatch.style.display = 'none';
            if (cardAuto) cardAuto.style.display = 'none';
            if (sidebarQuota) sidebarQuota.style.display = 'none';
            if (sidebarMatch) sidebarMatch.style.display = 'none';

            if (dashboardAgentPulse) {
                dashboardAgentPulse.classList.remove('active');
                dashboardAgentPulse.classList.add('deactive');
            }
            if (dashboardAgentText) {
                dashboardAgentText.textContent = 'Deactive';
                dashboardAgentText.style.color = 'var(--accent-red)';
            }
            if (agentStatusCard) {
                agentStatusCard.title = "Save your profile to enable agent";
            }
            if (appAgentStatusLabel) {
                appAgentStatusLabel.textContent = 'Offline';
                appAgentStatusLabel.classList.add('offline');
                appAgentStatusLabel.classList.remove('online');
            }
        }
        localStorage.setItem('agent_active', isActive ? 'true' : 'false');
    };

    // Sync UI with saved status on startup
    const savedStatus = localStorage.getItem('agent_active') === 'true';
    window.updateAgentStatusUI(savedStatus);

    window.onerror = function (msg, url, line) {
        console.error('Window Error:', msg, 'at', url, 'line', line);
        return false;
    };

    // Initialize Feedback Component
    fetch('components/feedback/feedback.html')
        .then(response => response.text())
        .then(html => {
            const container = document.getElementById('feedback-container');
            if (container) {
                container.innerHTML = html;
                if (window.initFeedbackWidget) window.initFeedbackWidget();
            }
        })
        .catch(err => console.error('Failed to load feedback component:', err));

    // Profile Header & Logout Logic
    const activeEmail = localStorage.getItem('gig_auto_active_email');
    if (activeEmail) {
        fetch(`/api/profile?email=${encodeURIComponent(activeEmail)}`)
            .then(res => res.json())
            .then(profile => {
                const nameEl = document.getElementById('header-user-name');
                const avatarEl = document.getElementById('header-avatar');
                if (profile && profile.full_name) {
                    const nameParts = profile.full_name.split(' ');
                    const firstName = nameParts[0];
                    if (nameEl) nameEl.textContent = firstName;
                    if (avatarEl) avatarEl.textContent = firstName.charAt(0).toUpperCase();
                } else if (profile && profile.email) {
                    if (nameEl) nameEl.textContent = profile.email.split('@')[0];
                    if (avatarEl) avatarEl.textContent = profile.email.charAt(0).toUpperCase();
                }
            })
            .catch(err => console.error('Error fetching header profile:', err));
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('gig_auto_active_email');
            window.location.href = 'index.html';
        });
    }
    
    // Add click listener for nav-item-link in dropdown
    const navItemLinks = document.querySelectorAll('.nav-item-link');
    navItemLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.getAttribute('data-view');
            if (view) showView(view);
        });
    });
});
