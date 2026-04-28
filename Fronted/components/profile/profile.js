function initProfile() {
    const healthCircle = document.getElementById('health-circle');
    const healthText = document.getElementById('health-percentage-text');
    const healthTip = document.getElementById('health-tip');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    const profileResume = document.getElementById('profile-resume');
    const emailInput = document.getElementById('profile-email');

    // Sidebar indicators
    const sidebarFill = document.querySelector('.sidebar .progress-fill');
    const sidebarPercentage = document.querySelector('.sidebar .percentage');

    // localStorage key for remembering which user is active
    const ACTIVE_EMAIL_KEY = 'gig_auto_active_email';

    // --- Completion Tracking ---

    function calculateCompletion() {
        const trackableFields = document.querySelectorAll('.track-completion');
        if (trackableFields.length === 0) return;

        let totalFields = trackableFields.length;
        let filledFields = 0;

        trackableFields.forEach(field => {
            let isFilled = false;
            if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
                if (field.type === 'file') {
                    isFilled = field.files && field.files.length > 0;
                } else {
                    isFilled = field.value && field.value.trim().length > 0;
                }
            } else if (field.tagName === 'SELECT') {
                isFilled = field.value !== "";
            }
            if (isFilled) filledFields++;
        });

        const percentage = Math.round((filledFields / totalFields) * 100);
        updateProgressUI(percentage);
    }

    function updateProgressUI(pct) {
        if (healthCircle) healthCircle.setAttribute('stroke-dasharray', `${pct}, 100`);
        if (healthText) healthText.textContent = `${pct}%`;
        if (sidebarFill) sidebarFill.style.width = `${pct}%`;
        if (sidebarPercentage) sidebarPercentage.textContent = `${pct}%`;

        if (healthTip) {
            if (pct === 100) {
                healthTip.innerText = "Awesome! Your profile is 100% complete.";
                healthTip.style.color = "#22c55e";
            } else {
                healthTip.innerText = "Fill your details to reach 100%.";
                healthTip.style.color = "var(--text-muted)";
            }
        }
    }

    // Real-time tracking
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('track-completion')) calculateCompletion();
    });

    if (profileResume) {
        profileResume.addEventListener('change', calculateCompletion);
    }

    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', saveProfile);
    }

    // Auto-load profile when email changes
    if (emailInput) {
        emailInput.addEventListener('change', () => {
            const email = emailInput.value.trim();
            if (email) {
                console.log(`[Profile] Email changed to: ${email}, attempting auto-load...`);
                loadProfile(email);
            }
        });
    }

    // --- Validation Helpers ---
    function clearValidation() {
        const requiredIds = ['profile-fullname', 'profile-email', 'profile-jobtype', 'profile-location', 'profile-experience-level', 'profile-primary-skills'];
        requiredIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('error');
            if (id === 'profile-primary-skills') {
                const vis = document.getElementById('profile-primary-skills-input');
                if (vis) vis.classList.remove('error');
            }
        });
    }

    function highlightMissingFields(missingIds) {
        missingIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('error');
            if (id === 'profile-primary-skills') {
                const vis = document.getElementById('profile-primary-skills-input');
                if (vis) vis.classList.add('error');
            }
        });
    }

    // --- Save Profile ---
    async function saveProfile() {
        // --- Validation Helpers ---
        clearValidation();
        const requiredIds = ['profile-fullname', 'profile-email', 'profile-jobtype', 'profile-location', 'profile-experience-level', 'profile-primary-skills', 'profile-resume'];
        const missing = [];
        requiredIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const val = el.value?.trim();
                if (!val) missing.push(id);
            }
        });
        if (missing.length > 0) {
            highlightMissingFields(missing);
            const first = document.getElementById(missing[0]);
            if (first) first.focus();
            return;
        }
        const email = document.getElementById('profile-email').value.trim();

        const profileData = {
            full_name: document.getElementById('profile-fullname')?.value || '',
            email: email,
            linkedin: document.getElementById('profile-linkedin')?.value || '',
            github: document.getElementById('profile-github')?.value || '',
            portfolio: document.getElementById('profile-portfolio')?.value || '',
            job_type: document.getElementById('profile-jobtype')?.value || '',
            location: document.getElementById('profile-location')?.value || '',
            experience_level: document.getElementById('profile-experience-level')?.value || '',
            primary_skills: document.getElementById('profile-primary-skills')?.value
                ? document.getElementById('profile-primary-skills').value.split(',').map(s => s.trim()).filter(Boolean)
                : [],
            achievements: document.getElementById('profile-achievements')?.value || ''
        };

        const originalText = saveProfileBtn.innerText;
        saveProfileBtn.innerText = "Saving...";
        saveProfileBtn.disabled = true;

        const resetBtn = (success) => {
            setTimeout(() => {
                saveProfileBtn.innerText = originalText;
                saveProfileBtn.style.background = "";
                saveProfileBtn.disabled = false;
            }, success ? 2000 : 3000);
        };

        try {
            const response = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData)
            });

            let result;
            try {
                result = await response.json();
            } catch (parseErr) {
                throw new Error(`Server returned non-JSON response (status ${response.status})`);
            }

            if (response.ok && result.status === 'success') {
                localStorage.setItem(ACTIVE_EMAIL_KEY, email);
                saveProfileBtn.innerText = "Profile Saved! ✓";
                saveProfileBtn.style.background = "var(--accent-green, #22c55e)";
                resetBtn(true);
                calculateCompletion();
                if (window.updateAgentStatusUI) window.updateAgentStatusUI(true);
            } else {
                const errMsg = result.message || `HTTP ${response.status}`;
                saveProfileBtn.innerText = "Save Failed ✗";
                saveProfileBtn.style.background = "var(--accent-red, #ef4444)";
                resetBtn(false);
                alert(`Profile save failed:\n${errMsg}`);
            }
        } catch (error) {
            saveProfileBtn.innerText = "Error Saving ✗";
            saveProfileBtn.style.background = "var(--accent-red, #ef4444)";
            resetBtn(false);
            alert(`Could not connect to server:\n${error.message}`);
        }
    }

    // --- Load Profile by Email ---
    async function loadProfile(email) {
        const url = `/api/profile?email=${encodeURIComponent(email)}`;
        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.log(`[Profile] No saved profile found for: ${email}`);
                // Clear other fields but KEEP the email
                clearForm(true);
                if (window.updateAgentStatusUI) window.updateAgentStatusUI(false);
                return;
            }
            const profile = await res.json();
            fillFormWithProfile(profile);
            localStorage.setItem(ACTIVE_EMAIL_KEY, profile.email);
            if (window.updateAgentStatusUI) window.updateAgentStatusUI(true);
            setTimeout(calculateCompletion, 100);
        } catch (e) {
            console.log('[Profile] Could not load profile:', e.message);
        }
    }

    function fillFormWithProfile(profile) {
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };
        set('profile-fullname', profile.full_name);
        set('profile-email', profile.email);
        set('profile-linkedin', profile.linkedin);
        set('profile-github', profile.github);
        set('profile-portfolio', profile.portfolio);
        set('profile-jobtype', profile.job_type);
        set('profile-location', profile.location);
        set('profile-experience-level', profile.experience_level);

        if (window.updateSkillsUI) {
            window.updateSkillsUI(profile.primary_skills || []);
        } else {
            set('profile-primary-skills', (profile.primary_skills || []).join(', '));
        }

        set('profile-achievements', profile.achievements);
    }

    function clearForm(keepEmail = false) {
        const fields = ['profile-fullname', 'profile-linkedin',
            'profile-github', 'profile-portfolio', 'profile-location',
            'profile-primary-skills', 'profile-achievements'];

        if (!keepEmail) fields.push('profile-email');

        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const selects = ['profile-jobtype', 'profile-experience-level'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        if (window.updateSkillsUI) {
            window.updateSkillsUI([]);
        }

        calculateCompletion();
    }

    // --- Skills UI ---
    function setupSkillsUI() {
        const inputField = document.getElementById('profile-primary-skills-input');
        const addBtn = document.getElementById('add-skill-btn');
        const container = document.getElementById('skills-container');
        const hiddenField = document.getElementById('profile-primary-skills');

        if (!inputField || !addBtn || !container || !hiddenField) return;

        let skills = [];

        function renderSkills() {
            container.innerHTML = skills.map((skill, index) => `
                <span class="skill-tag" style="background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 5px;">
                  ${skill} <span data-index="${index}" class="remove-skill-btn" style="cursor: pointer; opacity: 0.6; padding: 0 4px;" title="Remove">×</span>
                </span>
            `).join('');

            container.querySelectorAll('.remove-skill-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.getAttribute('data-index'));
                    skills.splice(idx, 1);
                    updateState();
                });
            });
        }

        function updateState() {
            hiddenField.value = skills.join(', ');
            renderSkills();
            calculateCompletion();
        }

        function addSkill() {
            const val = inputField.value.trim();
            if (val) {
                const newSkills = val.split(',').map(s => s.trim()).filter(Boolean);
                newSkills.forEach(s => {
                    if (!skills.includes(s)) skills.push(s);
                });
                inputField.value = '';
                updateState();
            }
        }

        addBtn.addEventListener('click', addSkill);
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addSkill();
            }
        });

        window.updateSkillsUI = (newSkills) => {
            skills = Array.isArray(newSkills) ? [...newSkills] : newSkills.split(',').map(s => s.trim()).filter(Boolean);
            updateState();
        };
    }

    // --- Initialise ---
    async function init() {
        setupSkillsUI();
        const activeEmail = localStorage.getItem(ACTIVE_EMAIL_KEY);
        if (activeEmail) {
            await loadProfile(activeEmail);
        } else {
            calculateCompletion();
        }
        setTimeout(calculateCompletion, 500);
    }

    init();
}

window.initProfile = initProfile;
