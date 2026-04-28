function initResumeBuilder() {
    console.log("[*] Initializing Premium Resume Builder Workspace...");
    const rbWorkspace = document.querySelector('.rb-workspace');
    if (!rbWorkspace) return;

    const STORAGE_KEY = 'autly_resume_v3_premium';

    // State
    let resumeData = {
        personal: { fullName: '', jobTitle: '', email: '', phone: '', location: '', linkedin: '', portfolio: '' },
        summary: '',
        experience: [],
        education: [],
        skills: { primary: [], secondary: [] },
        projects: []
    };

    // Selectors
    const navTabs = rbWorkspace.querySelectorAll('.rb-nav-tab');
    const stepPanels = rbWorkspace.querySelectorAll('.rb-step-panel');
    const previewCanvas = rbWorkspace.querySelector('#resume-preview-canvas');
    const templateSelect = rbWorkspace.querySelector('#rb-template-select');
    const stepLabel = rbWorkspace.querySelector('#current-step-label');

    const personalInputs = {
        'rb-full-name': 'fullName',
        'rb-job-title': 'jobTitle',
        'rb-email': 'email',
        'rb-phone': 'phone',
        'rb-location': 'location',
        'rb-linkedin': 'linkedin',
        'rb-portfolio': 'portfolio'
    };

    // Navigation
    function goToStep(step) {
        navTabs.forEach(tab => tab.classList.toggle('active', tab.getAttribute('data-step') === step));
        stepPanels.forEach(panel => panel.classList.toggle('active', panel.id === `rb-step-${step}`));
        
        // Update Label
        const tab = Array.from(navTabs).find(t => t.getAttribute('data-step') === step);
        if (tab && stepLabel) {
            stepLabel.innerText = tab.querySelector('span').innerText + " Details";
        }
    }

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => goToStep(tab.getAttribute('data-step')));
    });

    // Sync & Persistence
    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(resumeData)); }
    function load() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                resumeData = JSON.parse(saved);
                syncForm();
                updatePreview();
            } catch(e) {}
        }
    }

    function syncForm() {
        Object.entries(personalInputs).forEach(([id, key]) => {
            const el = rbWorkspace.querySelector(`#${id}`);
            if (el) el.value = resumeData.personal[key] || '';
        });
        rbWorkspace.querySelector('#rb-summary').value = resumeData.summary || '';
        rbWorkspace.querySelector('#rb-primary-skills').value = (resumeData.skills.primary || []).join(', ');
        rbWorkspace.querySelector('#rb-secondary-skills').value = (resumeData.skills.secondary || []).join(', ');
        renderExperience();
        renderEducation();
        renderProjects();
    }

    // Input Handlers
    Object.entries(personalInputs).forEach(([id, key]) => {
        rbWorkspace.querySelector(`#${id}`).addEventListener('input', (e) => {
            resumeData.personal[key] = e.target.value;
            updatePreview(); save();
        });
    });

    rbWorkspace.querySelector('#rb-summary').addEventListener('input', (e) => {
        resumeData.summary = e.target.value;
        updatePreview(); save();
    });

    ['rb-primary-skills', 'rb-secondary-skills'].forEach(id => {
        rbWorkspace.querySelector(`#${id}`).addEventListener('input', (e) => {
            const key = id.includes('primary') ? 'primary' : 'secondary';
            resumeData.skills[key] = e.target.value.split(',').map(s => s.trim()).filter(s => s);
            updatePreview(); save();
        });
    });

    // Dynamic Lists
    function createEntry(type) {
        const id = Date.now();
        const entry = { id };
        if (type === 'experience') Object.assign(entry, { company: '', role: '', duration: '', description: '' });
        else if (type === 'education') Object.assign(entry, { school: '', degree: '', year: '' });
        else Object.assign(entry, { name: '', link: '', description: '' });
        
        resumeData[type].push(entry);
        if (type === 'experience') renderExperience();
        else if (type === 'education') renderEducation();
        else renderProjects();
        updatePreview(); save();
    }

    function renderExperience() {
        const list = rbWorkspace.querySelector('#rb-experience-list');
        list.innerHTML = resumeData.experience.map(exp => `
            <div class="rb-entry-card" data-id="${exp.id}">
                <button class="remove-btn" onclick="window.rbRemove('${exp.id}', 'experience')">×</button>
                <div class="field-group">
                    <label>Company / Organization</label>
                    <input type="text" value="${exp.company}" placeholder="e.g. Google" oninput="window.rbUpdate('${exp.id}', 'experience', 'company', this.value)">
                </div>
                <div class="field-group">
                    <label>Job Role</label>
                    <input type="text" value="${exp.role}" placeholder="e.g. Senior Software Engineer" oninput="window.rbUpdate('${exp.id}', 'experience', 'role', this.value)">
                </div>
                <div class="field-group">
                    <label>Duration / Dates</label>
                    <input type="text" value="${exp.duration}" placeholder="e.g. Jan 2022 - Present" oninput="window.rbUpdate('${exp.id}', 'experience', 'duration', this.value)">
                </div>
                <div class="field-group">
                    <label>Work Description</label>
                    <textarea rows="4" placeholder="Describe your responsibilities and achievements..." oninput="window.rbUpdate('${exp.id}', 'experience', 'description', this.value)">${exp.description}</textarea>
                </div>
            </div>
        `).join('');
    }

    function renderEducation() {
        const list = rbWorkspace.querySelector('#rb-education-list');
        list.innerHTML = resumeData.education.map(edu => `
            <div class="rb-entry-card" data-id="${edu.id}">
                <button class="remove-btn" onclick="window.rbRemove('${edu.id}', 'education')">×</button>
                <div class="field-group">
                    <label>School / University</label>
                    <input type="text" value="${edu.school}" placeholder="e.g. Stanford University" oninput="window.rbUpdate('${edu.id}', 'education', 'school', this.value)">
                </div>
                <div class="field-group">
                    <label>Degree / Major</label>
                    <input type="text" value="${edu.degree}" placeholder="e.g. B.S. in Computer Science" oninput="window.rbUpdate('${edu.id}', 'education', 'degree', this.value)">
                </div>
                <div class="field-group">
                    <label>Year</label>
                    <input type="text" value="${edu.year}" placeholder="e.g. 2020 - 2024" oninput="window.rbUpdate('${edu.id}', 'education', 'year', this.value)">
                </div>
            </div>
        `).join('');
    }

    function renderProjects() {
        const list = rbWorkspace.querySelector('#rb-projects-list');
        list.innerHTML = resumeData.projects.map(proj => `
            <div class="rb-entry-card" data-id="${proj.id}">
                <button class="remove-btn" onclick="window.rbRemove('${proj.id}', 'projects')">×</button>
                <div class="field-group">
                    <label>Project Name</label>
                    <input type="text" value="${proj.name}" placeholder="e.g. Portfolio Website" oninput="window.rbUpdate('${proj.id}', 'projects', 'name', this.value)">
                </div>
                <div class="field-group">
                    <label>Project Link</label>
                    <input type="url" value="${proj.link}" placeholder="https://github.com/..." oninput="window.rbUpdate('${proj.id}', 'projects', 'link', this.value)">
                </div>
                <div class="field-group">
                    <label>Project Details</label>
                    <textarea rows="3" placeholder="Describe what you built..." oninput="window.rbUpdate('${proj.id}', 'projects', 'description', this.value)">${proj.description}</textarea>
                </div>
            </div>
        `).join('');
    }

    window.rbUpdate = (id, type, field, val) => {
        const entry = resumeData[type].find(e => e.id == id);
        if (entry) { entry[field] = val; updatePreview(); save(); }
    };

    window.rbRemove = (id, type) => {
        resumeData[type] = resumeData[type].filter(e => e.id != id);
        if (type === 'experience') renderExperience();
        else if (type === 'education') renderEducation();
        else renderProjects();
        updatePreview(); save();
    };

    rbWorkspace.querySelector('#rb-add-experience').onclick = () => createEntry('experience');
    rbWorkspace.querySelector('#rb-add-education').onclick = () => createEntry('education');
    rbWorkspace.querySelector('#rb-add-project').onclick = () => createEntry('projects');

    // Utils
    rbWorkspace.querySelector('#rb-sync-profile').onclick = async () => {
        const email = localStorage.getItem('gig_auto_active_email');
        if (!email) return alert("Save profile first.");
        const res = await fetch(`/api/profile?email=${encodeURIComponent(email)}`);
        if (res.ok) {
            const p = await res.json();
            resumeData.personal.fullName = p.full_name || '';
            resumeData.personal.email = p.email || '';
            resumeData.personal.linkedin = p.linkedin || '';
            resumeData.skills.primary = p.primary_skills || [];
            syncForm(); updatePreview(); save();
        }
    };

    const btnGenerateBio = rbWorkspace.querySelector('#btn-generate-bio');
    if (btnGenerateBio) {
        btnGenerateBio.onclick = async () => {
            const originalText = btnGenerateBio.innerHTML;
            btnGenerateBio.innerHTML = "Generating...";
            btnGenerateBio.disabled = true;
            
            try {
                const res = await fetch('/api/generate_bio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(resumeData)
                });
                
                const data = await res.json();
                if (data.status === 'success' && data.bio) {
                    resumeData.summary = data.bio;
                    rbWorkspace.querySelector('#rb-summary').value = data.bio;
                    updatePreview(); 
                    save();
                } else {
                    alert("Failed to generate bio: " + (data.message || "Unknown error"));
                }
            } catch (err) {
                console.error("[-] Bio Generation Error:", err);
                alert("Error generating bio.");
            } finally {
                btnGenerateBio.innerHTML = originalText;
                btnGenerateBio.disabled = false;
            }
        };
    }

    rbWorkspace.querySelector('#rb-download-pdf').onclick = async () => {
        const btn = rbWorkspace.querySelector('#rb-download-pdf');
        const originalText = btn.innerHTML;
        const element = document.getElementById('resume-preview-canvas');
        
        btn.innerHTML = 'Exporting...';
        btn.disabled = true;

        // Apply export mode class
        element.classList.add('is-exporting');

        const opt = {
            margin: 0,
            filename: `${resumeData.personal.fullName || 'Resume'}_Autly.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { 
                scale: 2, 
                useCORS: true, 
                letterRendering: true,
                logging: false,
                backgroundColor: '#ffffff'
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            // Give the browser a split second to re-render without transform/scale
            await new Promise(resolve => setTimeout(resolve, 100));
            await html2pdf().set(opt).from(element).save();
        } catch (e) {
            console.error("[-] PDF Export Error:", e);
            alert("Failed to export PDF. Please try again.");
        } finally {
            element.classList.remove('is-exporting');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };
    rbWorkspace.querySelector('#rb-reset-draft').onclick = () => { if(confirm("Reset?")) { localStorage.removeItem(STORAGE_KEY); location.reload(); } };
    rbWorkspace.querySelector('#rb-save-draft').onclick = () => { save(); alert("Saved!"); };

    function updatePreview() {
        const d = resumeData;
        const template = templateSelect.value;

        // Base Header Component
        const headerHtml = `
            <header class="preview-header">
                <h1>${d.personal.fullName || 'YOUR NAME'}</h1>
                <p style="font-size: 1.1rem; color: var(--rb-accent); font-weight: 600; margin-top: 5px;">${d.personal.jobTitle || ''}</p>
                <div class="preview-contact">
                    ${d.personal.email ? `<span>${d.personal.email}</span>` : ''}
                    ${d.personal.phone ? `<span> | ${d.personal.phone}</span>` : ''}
                    ${d.personal.location ? `<span> | ${d.personal.location}</span>` : ''}
                </div>
            </header>
        `;

        // Section Components
        const summaryHtml = d.summary ? `<section><h3>Summary</h3><p>${d.summary}</p></section>` : '';
        const experienceHtml = d.experience.length ? `<section><h3>Experience</h3>${d.experience.map(e => `
            <div class="preview-item">
                <div class="preview-item-header"><strong>${e.role}</strong><span>${e.duration}</span></div>
                <div style="font-style: italic; color: #666;">${e.company}</div>
                <p>${e.description}</p>
            </div>`).join('')}</section>` : '';
        
        const educationHtml = d.education.length ? `<section><h3>Education</h3>${d.education.map(e => `
            <div class="preview-item">
                <div class="preview-item-header"><strong>${e.degree}</strong><span>${e.year}</span></div>
                <div style="font-style: italic; color: #666;">${e.school}</div>
            </div>`).join('')}</section>` : '';

        const skillsHtml = (d.skills.primary.length || d.skills.secondary.length) ? `<section><h3>Skills</h3>
            <p><strong>Expertise:</strong> ${d.skills.primary.join(', ')}</p>
            <p><strong>Tools:</strong> ${d.skills.secondary.join(', ')}</p></section>` : '';

        const projectsHtml = d.projects.length ? `<section><h3>Projects</h3>${d.projects.map(p => `
            <div class="preview-item"><strong>${p.name}</strong><p>${p.description}</p></div>`).join('')}</section>` : '';

        // Layout Rendering
        if (template === 'sidebar') {
            previewCanvas.innerHTML = `
                <div class="preview-inner">
                    ${headerHtml}
                    <div class="sidebar-col">
                        ${skillsHtml}
                        ${educationHtml}
                    </div>
                    <div class="main-col">
                        ${summaryHtml}
                        ${experienceHtml}
                        ${projectsHtml}
                    </div>
                </div>
            `;
        } else if (template === 'compact') {
            previewCanvas.innerHTML = `
                <div class="preview-inner">
                    ${headerHtml}
                    ${summaryHtml}
                    <div class="grid-sections">
                        <div class="col-1">
                            ${experienceHtml}
                        </div>
                        <div class="col-2">
                            ${educationHtml}
                            ${skillsHtml}
                            ${projectsHtml}
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Standard Linear Layout
            previewCanvas.innerHTML = `
                <div class="preview-inner">
                    ${headerHtml}
                    ${summaryHtml}
                    ${experienceHtml}
                    ${educationHtml}
                    ${skillsHtml}
                    ${projectsHtml}
                </div>
            `;
        }
    }

    templateSelect.addEventListener('change', (e) => {
        previewCanvas.className = `resume-paper ${e.target.value}`;
        updatePreview();
    });

    load();
}

window.initResumeBuilder = initResumeBuilder;