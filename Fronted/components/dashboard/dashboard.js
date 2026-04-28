function initDashboardComponent() {
    console.log("[*] Initializing Dashboard Component...");
    const dashboardView = document.getElementById('dashboard-view');
    if (!dashboardView) return;

    const totalAppsCount = dashboardView.querySelector('#total-applications-count');
    const matchProfileCount = dashboardView.querySelector('#match-profile-count');
    const automationAppCount = dashboardView.querySelector('#automation-app-count');

    const cardTotalApps = dashboardView.querySelector('#card-applications-total');
    const cardMatchProfile = dashboardView.querySelector('#card-match-profile');
    const cardAutomationApp = dashboardView.querySelector('#card-automation-app');

    async function syncMetrics() {
        try {
            // Fetch Jobs for Total and Match Profile
            const jobsRes = await fetch('/api/jobs');
            const jobs = await jobsRes.json();

            if (totalAppsCount) totalAppsCount.textContent = jobs.length;
            if (matchProfileCount) {
                const highMatches = jobs.filter(j => (j.match_score || 0) >= 70).length;
                matchProfileCount.textContent = highMatches;
            }

            if (automationAppCount) {
                const appliedCount = jobs.filter(j => {
                    const status = (j.status || '').toLowerCase().trim();
                    return status === 'applied' || status === 'approved';
                }).length;
                automationAppCount.textContent = appliedCount;
            }

            // Fetch Quota for Daily Limit
            const quotaRes = await fetch('/api/quota');
            const quotaData = await quotaRes.json();
            const dailyApplied = quotaData.count || 0;
            const limit = quotaData.limit || 10;

            const quotaNumber = dashboardView.querySelector('#quota-number');
            const quotaPath = dashboardView.querySelector('#quota-circle-path');

            if (quotaNumber) quotaNumber.textContent = `${dailyApplied}/${limit}`;
            if (quotaPath) {
                const percentage = Math.min((dailyApplied / limit) * 100, 100);
                quotaPath.setAttribute('stroke-dasharray', `${percentage}, 100`);
            }

        } catch (e) {
            console.error("[-] Dashboard Metric Sync Error:", e);
        }
    }

    // Navigation Handlers
    if (cardTotalApps) {
        cardTotalApps.addEventListener('click', () => {
            if (window.showView) {
                window.showView('applications');
                // Trigger 'all' filter
                setTimeout(() => {
                    const filterAll = document.querySelector('.filter-chip[data-filter="all"]');
                    if (filterAll) filterAll.click();
                }, 100);
            }
        });
    }

    if (cardMatchProfile) {
        cardMatchProfile.addEventListener('click', () => {
            if (window.showView) {
                window.showView('applications');
                // Trigger 'HighMatch' filter
                setTimeout(() => {
                    const filterHigh = document.querySelector('.filter-chip[data-filter="HighMatch"]');
                    if (filterHigh) filterHigh.click();
                }, 100);
            }
        });
    }

    if (cardAutomationApp) {
        cardAutomationApp.addEventListener('click', () => {
            if (window.showView) {
                window.showView('applications');
                // Trigger 'Applied' filter
                setTimeout(() => {
                    const filterApplied = document.querySelector('.filter-chip[data-filter="Applied"]');
                    if (filterApplied) filterApplied.click();
                }, 100);
            }
        });
    }

    // Initial sync
    syncMetrics();

}

window.initDashboardComponent = initDashboardComponent;
