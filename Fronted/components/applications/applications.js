function initApplications() {
    console.log("[*] Initializing Premium Applications Component...");
    const applicationsView = document.getElementById('applications-view');
    if (!applicationsView) return;

    const jobListContainer = applicationsView.querySelector('#premium-job-list');
    const refreshBtn = applicationsView.querySelector('#refresh-jobs-btn');
    const searchInput = applicationsView.querySelector('#job-search-input');
    const filterChips = applicationsView.querySelectorAll('.filter-chip');
    const agentStatusLabel = applicationsView.querySelector('#agent-status-label');
    const agentFocusLabel = applicationsView.querySelector('#agent-focus-label');

    // Metrics display (optional now, safely handling if removed)
    const discoveriesM = applicationsView.querySelector('#metrics-discoveries');
    const pendingM = applicationsView.querySelector('#metrics-pending');
    const matchRateM = applicationsView.querySelector('#metrics-match-rate');
    const quotaNumber = applicationsView.querySelector('#quota-number');
    const quotaPath = applicationsView.querySelector('#quota-circle-path');

    let allJobs = [];
    let allProposals = [];
    let currentFilter = 'all';
    let currentSearch = '';

    async function fetchJobs() {
        if (!jobListContainer) return;

        const isAgentActive = localStorage.getItem('agent_active') === 'true';
        if (!isAgentActive) {
            jobListContainer.innerHTML = `
                <div class="feed-loading">
                    <p>Agent is inactive. Please save your profile to enable the Discovery Agent.</p>
                </div>
            `;
            return;
        }

        jobListContainer.innerHTML = `
            <div class="feed-loading">
                <div class="spinner"></div>
                <p>Discovery Agent is syncing with global job boards...</p>
            </div>
        `;

        try {
            const res = await fetch('/api/jobs');
            allJobs = await res.json();

            try {
                const propRes = await fetch('/api/proposals');
                allProposals = await propRes.json();
            } catch (e) {
                console.error("[-] Failed to fetch proposals:", e);
                allProposals = [];
            }

            await updateMetrics(allJobs);
            renderJobs();
        } catch (e) {
            console.error(e);
            jobListContainer.innerHTML = '<div class="feed-loading">Failed to sync jobs. Please check your connection.</div>';
        }
    }

    async function updateMetrics(jobs) {
        if (discoveriesM) discoveriesM.textContent = jobs.length;

        // Calculate Average Match Rate
        const avgMatch = jobs.length > 0 ?
            Math.round(jobs.reduce((acc, j) => acc + (j.match_score || 0), 0) / jobs.length) : 0;

        const avgMatchEl = applicationsView.querySelector('#avg-match-rate');
        const matchBarFill = applicationsView.querySelector('#match-bar-fill');
        const matchQuality = applicationsView.querySelector('#match-quality');

        if (avgMatchEl) avgMatchEl.textContent = `${avgMatch}%`;
        if (matchBarFill) matchBarFill.style.width = `${avgMatch}%`;

        if (matchQuality) {
            if (avgMatch > 80) matchQuality.textContent = 'Excellent';
            else if (avgMatch > 60) matchQuality.textContent = 'Good';
            else if (avgMatch > 40) matchQuality.textContent = 'Fair';
            else matchQuality.textContent = 'Learning';
        }

        // Update Quota Visual
        try {
            const quotaRes = await fetch('/api/quota');
            const quotaData = await quotaRes.json();
            const dailyApplied = quotaData.count || 0;
            const limit = quotaData.limit || 10;

            if (quotaNumber) quotaNumber.textContent = `${dailyApplied}/${limit}`;
            if (quotaPath) {
                const percentage = Math.min((dailyApplied / limit) * 100, 100);
                quotaPath.setAttribute('stroke-dasharray', `${percentage}, 100`);
            }

            const quotaStatus = applicationsView.querySelector('#quota-status');
            if (quotaStatus) {
                if (dailyApplied >= limit) {
                    quotaStatus.textContent = 'Limit Reached';
                    quotaStatus.classList.add('offline');
                    quotaStatus.classList.remove('online');
                } else {
                    quotaStatus.textContent = 'Active';
                    quotaStatus.classList.add('online');
                    quotaStatus.classList.remove('offline');
                }
            }
        } catch (e) {
            console.error("[-] Failed to fetch quota:", e);
        }
    }

    function renderJobs() {
        const filtered = allJobs.filter(job => {
            const matchesSearch = job.title.toLowerCase().includes(currentSearch.toLowerCase()) ||
                job.company.toLowerCase().includes(currentSearch.toLowerCase());

            let matchesFilter = false;
            const status = (job.status || '').toLowerCase().trim();
            const filter = currentFilter.toLowerCase();

            if (filter === 'all') {
                matchesFilter = true;
            } else if (filter === 'highmatch') {
                matchesFilter = (job.match_score || 0) >= 70;
            } else if (filter === 'remote') {
                matchesFilter = (job.location || '').toLowerCase().includes('remote');
            } else if (filter === 'applied') {
                matchesFilter = (status === 'applied' || status === 'approved');
            } else if (filter === 'not applied') {
                matchesFilter = (status === 'not applied');
            } else {
                matchesFilter = (job.source || '').toLowerCase().includes(filter);
            }

            return matchesSearch && matchesFilter;
        });

        if (filtered.length === 0) {
            jobListContainer.innerHTML = `
                <div class="feed-loading">
                    <p>No jobs match your current search/filters.</p>
                </div>
            `;
            return;
        }

        jobListContainer.innerHTML = filtered.map(job => {
            const status = (job.status || '').toLowerCase().trim();
            const isApplied = status === 'applied' || status === 'approved';
            const isDeclined = status === 'not applied';

            return `
            <div class="premium-job-card glass">
                <div class="job-main-info">
                    <div class="job-title-row">
                        <h4>${job.title}</h4>
                    </div>
                    <div class="job-meta-row">
                        <span class="company-name">🏢 ${job.company}</span>
                        <span class="job-location">📍 ${job.location}</span>
                        ${isApplied ? 
                            `<span class="match-score-badge" style="background: rgba(16, 185, 129, 0.2); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.4);">✓ Applied</span>` : 
                            (isDeclined ? `<span class="match-score-badge" style="background: rgba(239, 68, 68, 0.2); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.4);">❌ Not applied</span>` : '')
                        }
                        <span class="match-score-badge">🎯 ${job.match_score || 0}% Match</span>
                    </div>
                    <div class="job-tags-row">
                        <span class="job-premium-tag source">${job.source}</span>
                        ${(job.tags || []).slice(0, 2).map(tag => `
                            <span class="job-premium-tag">${tag}</span>
                        `).join('')}
                    </div>
                </div>
                <div class="job-actions-premium" style="display: flex; gap: 10px; justify-content: flex-end; align-items: center; flex-wrap: wrap;">
                    <a href="${job.url}" target="_blank" class="btn-manual-apply mini">Manual Apply</a>
                    ${isApplied ? 
                        `<button class="btn-primary-premium mini" style="pointer-events: none; opacity: 1;">✓ Applied</button>` :
                        (isDeclined ? 
                            `<button class="btn-danger-premium mini" style="pointer-events: none; opacity: 1;">Not applied</button>` :
                            `<button class="btn-primary-premium mini action-apply-btn" data-id="${job.id}">Agent Apply</button>
                             <button class="btn-danger-premium mini action-decline-btn" data-id="${job.id}">Not applied</button>`
                        )
                    }
                </div>
            </div>
        `;}).join('');

        // Attach listeners for apply/decline
        jobListContainer.querySelectorAll('.action-apply-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = btn.getAttribute('data-id');
                btn.disabled = true;
                btn.textContent = 'Applying...';
                try {
                    const res = await fetch('/api/jobs/apply', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ job_id: id })
                    });
                    const data = await res.json();

                    if (data.status === 'paused') {
                        if (confirm(`Agent is ready to apply for: ${data.message}\n\nProceed with submission?`)) {
                            btn.textContent = 'Submitting...';
                            const confirmRes = await fetch('/api/jobs/confirm_apply', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ thread_id: data.thread_id })
                            });
                            const confirmData = await confirmRes.json();
                            if (confirmRes.ok) {
                                console.log("[+] Application confirmed:", confirmData);
                            } else {
                                alert("Failed to confirm: " + (confirmData.message || "Unknown error"));
                            }
                        } else {
                            console.log("[*] Application cancelled by user.");
                        }
                    }

                    await fetchJobs(); // Refresh feed
                } catch (err) {
                    console.error('Failed to apply', err);
                    btn.disabled = false;
                    btn.textContent = 'Agent Apply';
                }
            });
        });

        jobListContainer.querySelectorAll('.action-decline-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = btn.getAttribute('data-id');
                btn.disabled = true;
                btn.textContent = 'Declining...';
                try {
                    const res = await fetch('/api/jobs/decline', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ job_id: id })
                    });
                    if (res.ok) await fetchJobs(); // Refresh feed
                } catch (err) {
                    console.error('Failed to decline', err);
                    btn.disabled = false;
                    btn.textContent = 'Not Interested';
                }
            });
        });
    }

    // Event Listeners
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value;
            renderJobs();
        });
    }

    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.getAttribute('data-filter');
            renderJobs();
        });
    });

    if (refreshBtn) {
        refreshBtn.onclick = async () => {
            const isAgentActive = localStorage.getItem('agent_active') === 'true';
            if (!isAgentActive) {
                console.warn("Discovery Agent inactive: Profile not saved.");
                if (agentFocusLabel) agentFocusLabel.textContent = "Please save your profile to enable scanning.";
                return;
            }

            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span>Scanning...</span>';
            if (agentStatusLabel) {
                agentStatusLabel.textContent = 'Scanning...';
            }
            if (agentFocusLabel) agentFocusLabel.textContent = 'Indexing new opportunities...';

            try {
                const activeEmail = localStorage.getItem('gig_auto_active_email') || '';

                // Fetch search term from profile or use default
                const profileRes = await fetch(activeEmail ? `/api/profile?email=${encodeURIComponent(activeEmail)}` : '/api/profile');
                let searchTerm = 'Software Engineer';
                if (profileRes.ok) {
                    const profile = await profileRes.json();
                    if (profile.title) searchTerm = profile.title;
                }

                const res = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        search_term: searchTerm,
                        email: activeEmail
                    })
                });
                const result = await res.json();
                console.log("[+] Scrape result:", result);
                await fetchJobs();
            } catch (e) {
                console.error(e);
            } finally {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = `
                    <span>Scan New Jobs</span>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                `;
                if (agentStatusLabel) {
                    agentStatusLabel.textContent = 'Online';
                }
                if (agentFocusLabel) agentFocusLabel.textContent = 'Cross-Platform Development';
            }
        };
    }

    // Initial fetch
    fetchJobs();
}

window.initApplications = initApplications;
