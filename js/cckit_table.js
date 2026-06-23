(function () {
    'use strict';

    const DAY_MS = 24 * 60 * 60 * 1000;
    const RECENT_DAYS = 30;
    const DEFAULT_SORT = 'updated_desc';
    const FILTER_KEYS = ['q', 'category', 'language', 'os', 'c2', 'feature', 'docker', 'updated', 'sort'];
    const SORTS = {
        updated_desc: { label: 'Newest update', order: [[6, 'desc']] },
        updated_asc: { label: 'Oldest update', order: [[6, 'asc']] },
        stars_desc: { label: 'Most stars', order: [[7, 'desc']] },
        clones_desc: { label: 'Most clones', order: [[8, 'desc']] },
        name_asc: { label: 'Name A-Z', order: [[9, 'asc']] },
    };

    const state = {
        allProjects: [],
        table: null,
        filters: {
            q: '',
            category: '',
            language: '',
            os: '',
            c2: '',
            feature: '',
            docker: '',
            updated: '',
            sort: DEFAULT_SORT,
        },
        activeRepo: '',
        activeProject: null,
        statsPromise: null,
        clonePlot: null,
        trafficPlot: null,
        resizeTimer: null,
    };

    const controls = {};

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        cacheControls();
        initTheme();
        hydrateFiltersFromUrl();
        bindChromeEvents();
        loadProjects();
    }

    function cacheControls() {
        controls.themeSelect = document.getElementById('themeSelect');
        controls.search = document.getElementById('projectSearch');
        controls.sort = document.getElementById('sortFilter');
        controls.clear = document.getElementById('clearFilters');
        controls.activeFilters = document.getElementById('activeFilters');
        controls.resultCount = document.getElementById('resultCount');
        controls.detailPanel = document.getElementById('detailPanel');
        controls.detailContent = document.getElementById('detailContent');
        controls.detailCharts = document.getElementById('detailCharts');
        controls.cloneGraph = document.getElementById('mygraph_clones');
        controls.viewGraph = document.getElementById('mygraph_views');
        controls.filters = {
            category: document.getElementById('categoryFilter'),
            language: document.getElementById('languageFilter'),
            os: document.getElementById('osFilter'),
            c2: document.getElementById('c2Filter'),
            feature: document.getElementById('featureFilter'),
            docker: document.getElementById('dockerFilter'),
            updated: document.getElementById('updatedFilter'),
        };
    }

    function initTheme() {
        const stored = localStorage.getItem('mythic-theme') || 'system';
        const preference = ['light', 'dark', 'system'].includes(stored) ? stored : 'system';
        controls.themeSelect.value = preference;
        setTheme(preference);

        controls.themeSelect.addEventListener('change', function () {
            const value = controls.themeSelect.value;
            localStorage.setItem('mythic-theme', value);
            setTheme(value);
            rerenderActiveCharts();
        });

        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
                if ((localStorage.getItem('mythic-theme') || 'system') === 'system') {
                    setTheme('system');
                    rerenderActiveCharts();
                }
            });
        }
    }

    function setTheme(preference) {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const effective = preference === 'dark' || (preference === 'system' && prefersDark) ? 'dark' : 'light';
        document.documentElement.dataset.themePreference = preference;
        document.documentElement.dataset.theme = effective;
    }

    function hydrateFiltersFromUrl() {
        const params = new URLSearchParams(window.location.search);
        FILTER_KEYS.forEach(function (key) {
            const value = params.get(key);
            if (value !== null) {
                state.filters[key] = value;
            }
        });
        if (!SORTS[state.filters.sort]) {
            state.filters.sort = DEFAULT_SORT;
        }
        state.activeRepo = params.get('repo') || '';
    }

    function bindChromeEvents() {
        controls.search.addEventListener('input', debounce(function () {
            state.filters.q = controls.search.value.trim();
            applyFilters();
        }, 140));

        controls.sort.addEventListener('change', function () {
            state.filters.sort = controls.sort.value || DEFAULT_SORT;
            applyFilters();
        });

        Object.keys(controls.filters).forEach(function (key) {
            controls.filters[key].addEventListener('change', function () {
                state.filters[key] = controls.filters[key].value;
                applyFilters();
            });
        });

        controls.clear.addEventListener('click', function () {
            state.filters = {
                q: '',
                category: '',
                language: '',
                os: '',
                c2: '',
                feature: '',
                docker: '',
                updated: '',
                sort: DEFAULT_SORT,
            };
            hydrateControls();
            applyFilters();
        });

        controls.activeFilters.addEventListener('click', function (event) {
            const button = event.target.closest('[data-remove-filter]');
            if (!button) {
                return;
            }
            const key = button.getAttribute('data-remove-filter');
            state.filters[key] = key === 'sort' ? DEFAULT_SORT : '';
            hydrateControls();
            applyFilters();
        });

        controls.detailPanel.addEventListener('click', function (event) {
            if (event.target.closest('[data-close-detail]')) {
                closeDetail();
            }
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && controls.detailPanel.getAttribute('aria-hidden') === 'false') {
                closeDetail();
            }
        });

        window.addEventListener('resize', function () {
            clearTimeout(state.resizeTimer);
            state.resizeTimer = setTimeout(rerenderActiveCharts, 180);
        });
    }

    function loadProjects() {
        fetch('data.json')
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Unable to load data.json');
                }
                return response.json();
            })
            .then(function (json) {
                state.allProjects = (json.data || []).map(enrichProject);
                updateSummary(state.allProjects);
                populateFilterOptions(state.allProjects);
                hydrateControls();
                initTable(state.allProjects);
                applyFilters(false);
                openRepoFromUrl();
            })
            .catch(function (error) {
                controls.resultCount.textContent = error.message;
            });
    }

    function enrichProject(project) {
        const latest = project.latest || {};
        const metadata = project.metadata || {};
        const fullName = project.full_name || [project.owner && project.owner.login, project.name].filter(Boolean).join('/') || project.name || '';
        const owner = (project.owner && project.owner.login) || fullName.split('/')[0] || '';
        const latestEpoch = Number(latest.commit_date) || 0;
        const daysSinceUpdate = latestEpoch ? Math.max(0, Math.floor((Date.now() - latestEpoch * 1000) / DAY_MS)) : null;
        const remoteImage = typeof project.remote_images === 'string' ? project.remote_images.trim() : '';
        const mythicFeatures = normalizeArray(metadata.features && metadata.features.mythic);
        const customFeatures = normalizeArray(metadata.features && metadata.features.custom);
        const githubLanguage = project.language ? [project.language] : [];
        const metadataLanguages = normalizeArray(metadata.languages);
        const languages = unique(githubLanguage.concat(metadataLanguages));

        const meta = {
            fullName: fullName,
            fullNameLower: fullName.toLowerCase(),
            owner: owner,
            latestEpoch: latestEpoch,
            daysSinceUpdate: daysSinceUpdate,
            isRecent: daysSinceUpdate !== null && daysSinceUpdate <= RECENT_DAYS,
            remoteImage: remoteImage,
            hasDockerImage: remoteImage.length > 0,
            stars: Number(project.stargazers_count) || 0,
            forks: Number(project.forks_count) || Number(project.forks) || 0,
            issues: Number(project.open_issues_count) || Number(project.open_issues) || 0,
            clones: Number(project.clones && project.clones.count) || 0,
            license: project.license && project.license.spdx_id && project.license.spdx_id !== 'NOASSERTION' ? project.license.spdx_id : '',
            os: normalizeArray(metadata.os),
            languages: languages,
            c2: normalizeArray(metadata.c2),
            mythicFeatures: mythicFeatures,
            customFeatures: customFeatures,
            payloadOutput: normalizeArray(metadata.payload_output),
            architectures: normalizeArray(metadata.architectures),
            wrappers: normalizeArray(metadata.supported_wrappers),
            mythicVersion: metadata.mythic_version || '',
            agentVersion: metadata.agent_version || '',
            icon: safeUrl(latest.icon || (project.owner && project.owner.avatar_url) || ''),
        };

        meta.searchText = [
            project.name,
            fullName,
            owner,
            project.description,
            project.category,
            project.language,
            latest.branch,
            latest.commit_message,
            remoteImage,
            meta.license,
            meta.os.join(' '),
            meta.languages.join(' '),
            meta.c2.join(' '),
            mythicFeatures.join(' '),
            customFeatures.join(' '),
            meta.payloadOutput.join(' '),
            meta.architectures.join(' '),
        ].filter(Boolean).join(' ').toLowerCase();

        return Object.assign({}, project, { _meta: meta });
    }

    function initTable(projects) {
        $.fn.dataTable.ext.search.push(function (settings, data, dataIndex) {
            if (settings.nTable.id !== 'cckit_table') {
                return true;
            }
            const tableRow = settings.aoData[dataIndex];
            const project = tableRow && tableRow._aData;
            return project ? passesFilters(project) : true;
        });

        state.table = $('#cckit_table').DataTable({
            data: projects,
            deferRender: true,
            pageLength: 25,
            lengthMenu: [[25, 50, 100, -1], [25, 50, 100, 'All']],
            autoWidth: false,
            scrollX: true,
            order: SORTS[state.filters.sort].order,
            dom: '<"datatable-length"l>rt<"datatable-footer"ip>',
            columns: [
                { data: null, render: renderProjectCell },
                { data: null, render: renderCategoryCell },
                { data: null, orderable: false, render: renderCompatibilityCell },
                { data: null, render: renderDockerCell },
                { data: null, orderData: [6], render: renderUpdateCell },
                { data: null, orderData: [7], render: renderActivityCell },
                { data: '_meta.latestEpoch', visible: false, searchable: false },
                { data: '_meta.stars', visible: false, searchable: false },
                { data: '_meta.clones', visible: false, searchable: false },
                { data: '_meta.fullNameLower', visible: false, searchable: false },
            ],
            drawCallback: updateResultCount,
        });

        $('#cckit_table tbody').on('click', 'button[data-action]', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const project = state.table.row($(this).closest('tr')).data();
            if (!project) {
                return;
            }
            openDetail(project, { focusCharts: this.dataset.action === 'stats' });
        });

        $('#cckit_table tbody').on('click', 'tr', function (event) {
            if ($(event.target).closest('a, button, select, input').length) {
                return;
            }
            const project = state.table.row(this).data();
            if (project) {
                openDetail(project);
            }
        });
    }

    function renderProjectCell(project, type) {
        if (type !== 'display') {
            return project._meta.searchText;
        }
        const icon = project._meta.icon;
        const image = icon ? `<img class="project-icon" src="${escapeAttr(icon)}" alt="" loading="lazy">` : `<span class="project-icon" aria-hidden="true"></span>`;
        const recent = project._meta.isRecent ? '<i class="fas fa-star" title="Recent update" aria-label="Recent update"></i>' : '';
        const htmlUrl = safeUrl(project.html_url);
        return `
            <div class="project-cell">
                ${image}
                <div>
                    <button class="project-name" type="button" data-action="details">${escapeHtml(project.name || project._meta.fullName)} ${recent}</button>
                    <div class="project-owner">${escapeHtml(project._meta.fullName)}</div>
                    <div class="project-description">${escapeHtml(project.description || 'No description available.')}</div>
                    <div class="link-actions project-actions">
                        <button class="icon-button" type="button" data-action="details" title="Details" aria-label="Details for ${escapeAttr(project.name || project._meta.fullName)}">
                            <i class="fas fa-info-circle" aria-hidden="true"></i>
                        </button>
                        <button class="icon-button" type="button" data-action="stats" title="Stats" aria-label="Stats for ${escapeAttr(project.name || project._meta.fullName)}">
                            <i class="fas fa-chart-line" aria-hidden="true"></i>
                        </button>
                        ${htmlUrl ? `<a class="icon-button" href="${escapeAttr(htmlUrl)}" target="_blank" rel="noopener" title="GitHub" aria-label="Open ${escapeAttr(project.name || project._meta.fullName)} on GitHub"><i class="fab fa-github" aria-hidden="true"></i></a>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    function renderCategoryCell(project, type) {
        if (type !== 'display') {
            return [project.category, project.language, project._meta.license].filter(Boolean).join(' ');
        }
        const badges = [
            badge(project.category || 'Uncategorized', 'badge-category'),
            project.language ? badge(project.language, 'badge-language') : '',
            project._meta.license ? badge(project._meta.license) : '',
            project.archived ? badge('Archived', 'badge-warning') : '',
        ].filter(Boolean).join('');
        return `<div class="badge-stack">${badges}</div>`;
    }

    function renderCompatibilityCell(project, type) {
        if (type !== 'display') {
            return [
                project._meta.os.join(' '),
                project._meta.c2.join(' '),
                project._meta.mythicFeatures.join(' '),
            ].join(' ');
        }
        const sections = [
            chipGroup('OS', project._meta.os, 3),
            chipGroup('C2', project._meta.c2, 3),
            chipGroup('Features', project._meta.mythicFeatures, 3),
        ].filter(Boolean).join('');
        return sections ? `<div class="compat-cell">${sections}</div>` : '<span class="empty-text">No metadata</span>';
    }

    function renderDockerCell(project, type) {
        if (type !== 'display') {
            return project._meta.hasDockerImage ? project._meta.remoteImage : '';
        }
        if (!project._meta.hasDockerImage) {
            return '<span class="empty-text">No image listed</span>';
        }
        return `
            <div class="docker-cell">
                <code class="docker-image">${escapeHtml(project._meta.remoteImage)}</code>
            </div>
        `;
    }

    function renderUpdateCell(project, type) {
        if (type !== 'display') {
            return project._meta.latestEpoch;
        }
        const latest = project.latest || {};
        const recent = project._meta.isRecent ? '<i class="fas fa-star" title="Recent update" aria-hidden="true"></i>' : '';
        return `
            <div class="update-cell">
                <div class="update-date">${escapeHtml(formatDate(project._meta.latestEpoch))} ${recent}</div>
                <div class="update-relative">${escapeHtml(formatRelative(project._meta.daysSinceUpdate))}</div>
                <div class="branch-text">${escapeHtml(latest.branch || 'Unknown branch')}</div>
                <div class="commit-text">${escapeHtml(latest.commit_message || 'No commit message available.')}</div>
            </div>
        `;
    }

    function renderActivityCell(project, type) {
        if (type !== 'display') {
            return project._meta.stars;
        }
        return `
            <div class="activity-grid">
                ${activityPill('fas fa-star', project._meta.stars, 'Stars')}
                ${activityPill('fas fa-code-branch', project._meta.forks, 'Forks')}
                ${activityPill('far fa-dot-circle', project._meta.issues, 'Open issues')}
                ${activityPill('fas fa-download', project._meta.clones, 'Clones')}
            </div>
        `;
    }

    function updateSummary(projects) {
        const totals = projects.reduce(function (acc, project) {
            acc.projects += 1;
            if (['Agent', 'Wrapper'].includes(project.category)) {
                acc.agents += 1;
            }
            if (['C2', 'Service'].includes(project.category)) {
                acc.c2 += 1;
            }
            if (project._meta.isRecent) {
                acc.recent += 1;
            }
            if (project._meta.hasDockerImage) {
                acc.docker += 1;
            }
            acc.stars += project._meta.stars;
            acc.clones += project._meta.clones;
            return acc;
        }, { projects: 0, agents: 0, c2: 0, recent: 0, docker: 0, stars: 0, clones: 0 });

        setText('metricProjects', formatNumber(totals.projects));
        setText('metricAgents', formatNumber(totals.agents));
        setText('metricC2', formatNumber(totals.c2));
        setText('metricRecent', formatNumber(totals.recent));
        setText('metricDocker', formatNumber(totals.docker));
        setText('metricStarsClones', `${formatNumber(totals.stars)} / ${formatNumber(totals.clones)}`);
    }

    function populateFilterOptions(projects) {
        populateSelect(controls.filters.category, 'Any category', unique(projects.map(function (project) {
            return project.category;
        })));
        populateSelect(controls.filters.language, 'Any language', unique(flatMap(projects, function (project) {
            return project._meta.languages;
        })));
        populateSelect(controls.filters.os, 'Any OS', unique(flatMap(projects, function (project) {
            return project._meta.os;
        })));
        populateSelect(controls.filters.c2, 'Any C2 profile', unique(flatMap(projects, function (project) {
            return project._meta.c2;
        })));
        populateSelect(controls.filters.feature, 'Any Mythic feature', unique(flatMap(projects, function (project) {
            return project._meta.mythicFeatures;
        })));
    }

    function hydrateControls() {
        controls.search.value = state.filters.q || '';
        controls.sort.value = SORTS[state.filters.sort] ? state.filters.sort : DEFAULT_SORT;
        Object.keys(controls.filters).forEach(function (key) {
            controls.filters[key].value = state.filters[key] || '';
            if (controls.filters[key].value !== (state.filters[key] || '')) {
                state.filters[key] = '';
            }
        });
    }

    function applyFilters(syncUrlState = true) {
        if (!state.table) {
            return;
        }
        state.table.order(SORTS[state.filters.sort].order).draw();
        renderActiveFilters();
        if (syncUrlState) {
            syncUrl();
        }
    }

    function passesFilters(project) {
        const filters = state.filters;
        const query = (filters.q || '').toLowerCase();

        if (query && !project._meta.searchText.includes(query)) {
            return false;
        }
        if (filters.category && project.category !== filters.category) {
            return false;
        }
        if (filters.language && !project._meta.languages.includes(filters.language)) {
            return false;
        }
        if (filters.os && !project._meta.os.includes(filters.os)) {
            return false;
        }
        if (filters.c2 && !project._meta.c2.includes(filters.c2)) {
            return false;
        }
        if (filters.feature && !project._meta.mythicFeatures.includes(filters.feature)) {
            return false;
        }
        if (filters.docker === 'yes' && !project._meta.hasDockerImage) {
            return false;
        }
        if (filters.docker === 'no' && project._meta.hasDockerImage) {
            return false;
        }
        if (filters.updated === '30' && !(project._meta.daysSinceUpdate !== null && project._meta.daysSinceUpdate <= 30)) {
            return false;
        }
        if (filters.updated === '180' && !(project._meta.daysSinceUpdate !== null && project._meta.daysSinceUpdate >= 180)) {
            return false;
        }
        if (filters.updated === '365' && !(project._meta.daysSinceUpdate !== null && project._meta.daysSinceUpdate >= 365)) {
            return false;
        }
        return true;
    }

    function updateResultCount() {
        if (!state.table) {
            return;
        }
        const visible = state.table.rows({ filter: 'applied' }).count();
        const total = state.allProjects.length;
        controls.resultCount.textContent = `${formatNumber(visible)} of ${formatNumber(total)} projects`;
    }

    function renderActiveFilters() {
        const labels = {
            q: 'Search',
            category: 'Category',
            language: 'Language',
            os: 'OS',
            c2: 'C2',
            feature: 'Feature',
            docker: 'Docker',
            updated: 'Updated',
            sort: 'Sort',
        };
        const valueLabels = {
            docker: { yes: 'Image available', no: 'No image listed' },
            updated: { 30: 'Updated in 30 days', 180: 'Stale 180+ days', 365: 'Stale 365+ days' },
            sort: Object.keys(SORTS).reduce(function (acc, key) {
                acc[key] = SORTS[key].label;
                return acc;
            }, {}),
        };

        const chips = FILTER_KEYS.reduce(function (acc, key) {
            const value = state.filters[key];
            if (!value || (key === 'sort' && value === DEFAULT_SORT)) {
                return acc;
            }
            const label = valueLabels[key] && valueLabels[key][value] ? valueLabels[key][value] : value;
            acc.push(`
                <span class="filter-chip">
                    ${escapeHtml(labels[key])}: ${escapeHtml(label)}
                    <button type="button" data-remove-filter="${escapeAttr(key)}" aria-label="Remove ${escapeAttr(labels[key])} filter">
                        <i class="fas fa-times" aria-hidden="true"></i>
                    </button>
                </span>
            `);
            return acc;
        }, []);

        controls.activeFilters.innerHTML = chips.join('');
    }

    function syncUrl() {
        const params = new URLSearchParams();
        FILTER_KEYS.forEach(function (key) {
            const value = state.filters[key];
            if (value && !(key === 'sort' && value === DEFAULT_SORT)) {
                params.set(key, value);
            }
        });
        if (state.activeRepo) {
            params.set('repo', state.activeRepo);
        }
        const query = params.toString();
        const nextUrl = `${window.location.pathname}${query ? '?' + query : ''}`;
        window.history.replaceState({}, '', nextUrl);
    }

    function openRepoFromUrl() {
        if (!state.activeRepo) {
            return;
        }
        const target = state.activeRepo.toLowerCase();
        const project = state.allProjects.find(function (candidate) {
            return candidate._meta.fullNameLower === target ||
                (candidate.name || '').toLowerCase() === target ||
                (candidate.html_url || '').toLowerCase() === target;
        });
        if (project) {
            openDetail(project, { sync: false });
        }
    }

    function openDetail(project, options = {}) {
        state.activeProject = project;
        state.activeRepo = project._meta.fullName;
        controls.detailContent.innerHTML = renderDetail(project);
        controls.detailPanel.setAttribute('aria-hidden', 'false');
        markSelectedRow(project);
        renderProjectCharts(project);
        syncUrl();

        const closeButton = controls.detailPanel.querySelector('.detail-close');
        if (closeButton) {
            closeButton.focus({ preventScroll: true });
        }
        if (options.focusCharts) {
            setTimeout(function () {
                controls.detailCharts.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }, 80);
        }
        if (options.sync === false) {
            syncUrl();
        }
    }

    function closeDetail() {
        controls.detailPanel.setAttribute('aria-hidden', 'true');
        state.activeProject = null;
        state.activeRepo = '';
        destroyPlots();
        controls.cloneGraph.innerHTML = '';
        controls.viewGraph.innerHTML = '';
        $('#cckit_table tbody tr').removeClass('selected-row');
        syncUrl();
    }

    function markSelectedRow(project) {
        if (!state.table) {
            return;
        }
        state.table.rows().every(function () {
            const node = this.node();
            if (node) {
                node.classList.toggle('selected-row', this.data() === project);
            }
        });
    }

    function renderDetail(project) {
        const latest = project.latest || {};
        const htmlUrl = safeUrl(project.html_url);
        const apiUrl = safeUrl(project.url);
        const icon = project._meta.icon ? `<img class="project-icon" src="${escapeAttr(project._meta.icon)}" alt="" loading="lazy">` : `<span class="project-icon" aria-hidden="true"></span>`;
        const detailSections = [
            detailChipSection('Operating systems', project._meta.os),
            detailChipSection('Languages', project._meta.languages),
            detailChipSection('C2 profiles', project._meta.c2),
            detailChipSection('Mythic features', project._meta.mythicFeatures),
            detailChipSection('Custom features', project._meta.customFeatures),
            detailChipSection('Payload output', project._meta.payloadOutput),
            detailChipSection('Architectures', project._meta.architectures),
            detailChipSection('Supported wrappers', project._meta.wrappers),
        ].filter(Boolean).join('');

        return `
            <div class="detail-header">
                ${icon}
                <div>
                    <h2 id="detailTitle" class="detail-title">${escapeHtml(project.name || project._meta.fullName)}</h2>
                    <div class="detail-muted">${escapeHtml(project._meta.fullName)}</div>
                    <div class="chip-list" style="margin-top: 10px;">
                        ${badge(project.category || 'Uncategorized', 'badge-category')}
                        ${project.language ? badge(project.language, 'badge-language') : ''}
                        ${project._meta.isRecent ? badge('Updated 30d', 'badge-warning') : ''}
                        ${project._meta.hasDockerImage ? badge('Docker image', 'badge-category') : ''}
                    </div>
                </div>
            </div>

            <p class="detail-description">${escapeHtml(project.description || 'No description available.')}</p>

            <div class="detail-actions">
                ${htmlUrl ? `<a class="nav-pill" href="${escapeAttr(htmlUrl)}" target="_blank" rel="noopener"><i class="fab fa-github" aria-hidden="true"></i> GitHub</a>` : ''}
                ${apiUrl ? `<a class="nav-pill" href="${escapeAttr(apiUrl)}" target="_blank" rel="noopener"><i class="fas fa-code" aria-hidden="true"></i> API</a>` : ''}
            </div>

            <section class="detail-section">
                <h3>Project Health</h3>
                <div class="detail-stat-grid">
                    ${detailStat('Stars', project._meta.stars)}
                    ${detailStat('Forks', project._meta.forks)}
                    ${detailStat('Open issues', project._meta.issues)}
                    ${detailStat('Clones', project._meta.clones)}
                </div>
            </section>

            <section class="detail-section">
                <h3>Latest Update</h3>
                <p class="detail-muted">${escapeHtml(formatDate(project._meta.latestEpoch))} · ${escapeHtml(formatRelative(project._meta.daysSinceUpdate))} · ${escapeHtml(latest.branch || 'Unknown branch')}</p>
                <p>${escapeHtml(latest.commit_message || 'No commit message available.')}</p>
            </section>

            ${project._meta.hasDockerImage ? `
                <section class="detail-section">
                    <h3>Docker Image</h3>
                    <code class="detail-code">${escapeHtml(project._meta.remoteImage)}</code>
                </section>
            ` : ''}

            ${project._meta.mythicVersion || project._meta.agentVersion ? `
                <section class="detail-section">
                    <h3>Versions</h3>
                    <div class="chip-list">
                        ${project._meta.mythicVersion ? badge('Mythic ' + project._meta.mythicVersion) : ''}
                        ${project._meta.agentVersion ? badge('Agent ' + project._meta.agentVersion) : ''}
                    </div>
                </section>
            ` : ''}

            ${detailSections ? `<section class="detail-section"><h3>Compatibility</h3>${detailSections}</section>` : ''}
        `;
    }

    function renderProjectCharts(project) {
        destroyPlots();
        controls.cloneGraph.innerHTML = '<div class="chart-empty">Loading stats...</div>';
        controls.viewGraph.innerHTML = '';

        getStats().then(function (stats) {
            if (state.activeProject !== project) {
                return;
            }
            const history = stats[project.url];
            if (!history) {
                controls.cloneGraph.innerHTML = '<div class="chart-empty">No tracked visit or clone history for this repository.</div>';
                controls.viewGraph.innerHTML = '';
                return;
            }

            const chartData = buildChartData(history);
            if (!chartData.x.length) {
                controls.cloneGraph.innerHTML = '<div class="chart-empty">No tracked visit or clone history for this repository.</div>';
                controls.viewGraph.innerHTML = '';
                return;
            }

            controls.cloneGraph.innerHTML = '';
            controls.viewGraph.innerHTML = '';
            state.clonePlot = new uPlot(plotOptions('Clone history', controls.cloneGraph), [chartData.x, chartData.cloneCount, chartData.cloneUnique], controls.cloneGraph);
            state.trafficPlot = new uPlot(plotOptions('View history', controls.viewGraph), [chartData.x, chartData.trafficCount, chartData.trafficUnique], controls.viewGraph);
        }).catch(function () {
            controls.cloneGraph.innerHTML = '<div class="chart-empty">Stats could not be loaded.</div>';
            controls.viewGraph.innerHTML = '';
        });
    }

    function getStats() {
        if (!state.statsPromise) {
            state.statsPromise = fetch('stats.json')
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error('Unable to load stats.json');
                    }
                    return response.json();
                });
        }
        return state.statsPromise;
    }

    function buildChartData(history) {
        return Object.keys(history).sort().reduce(function (acc, dateKey) {
            const entry = history[dateKey] || {};
            const timestamp = Math.floor(new Date(dateKey).getTime() / 1000);
            if (!Number.isFinite(timestamp)) {
                return acc;
            }
            acc.x.push(timestamp);
            acc.cloneCount.push(Number(entry.clones && entry.clones.count) || 0);
            acc.cloneUnique.push(Number(entry.clones && entry.clones.unique) || 0);
            acc.trafficCount.push(Number(entry.traffic && entry.traffic.count) || 0);
            acc.trafficUnique.push(Number(entry.traffic && entry.traffic.unique) || 0);
            return acc;
        }, { x: [], cloneCount: [], cloneUnique: [], trafficCount: [], trafficUnique: [] });
    }

    function plotOptions(title, container) {
        const isDark = document.documentElement.dataset.theme === 'dark';
        const borderColor = isDark ? '#37414a' : '#d8e0e7';
        const textColor = isDark ? '#edf2f4' : '#1f2933';
        const totalStroke = isDark ? '#51b87a' : '#2f7d57';
        const uniqueStroke = isDark ? '#8bb3ff' : '#3d6fb6';
        const width = Math.max(320, Math.floor(container.getBoundingClientRect().width || 320));

        return {
            width: width,
            height: 280,
            title: title,
            scales: {
                x: { time: true },
            },
            axes: [
                {
                    stroke: textColor,
                    grid: { stroke: borderColor },
                },
                {
                    stroke: textColor,
                    grid: { stroke: borderColor },
                },
            ],
            series: [
                {},
                {
                    label: 'Total',
                    stroke: totalStroke,
                    fill: isDark ? 'rgba(81,184,122,0.14)' : 'rgba(47,125,87,0.12)',
                    width: 2,
                },
                {
                    label: 'Unique',
                    stroke: uniqueStroke,
                    fill: isDark ? 'rgba(139,179,255,0.12)' : 'rgba(61,111,182,0.1)',
                    width: 2,
                },
            ],
        };
    }

    function rerenderActiveCharts() {
        if (state.activeProject && controls.detailPanel.getAttribute('aria-hidden') === 'false') {
            renderProjectCharts(state.activeProject);
        }
    }

    function destroyPlots() {
        if (state.clonePlot) {
            state.clonePlot.destroy();
            state.clonePlot = null;
        }
        if (state.trafficPlot) {
            state.trafficPlot.destroy();
            state.trafficPlot = null;
        }
    }

    function normalizeArray(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        return value.filter(function (item) {
            return typeof item === 'string' && item.trim();
        }).map(function (item) {
            return item.trim();
        });
    }

    function unique(values) {
        return Array.from(new Set(values.filter(Boolean))).sort(function (a, b) {
            return a.localeCompare(b, undefined, { sensitivity: 'base' });
        });
    }

    function flatMap(values, mapper) {
        return values.reduce(function (acc, item) {
            return acc.concat(mapper(item) || []);
        }, []);
    }

    function populateSelect(select, allLabel, values) {
        select.replaceChildren(new Option(allLabel, ''));
        values.forEach(function (value) {
            select.appendChild(new Option(value, value));
        });
    }

    function chipGroup(label, values, limit) {
        if (!values.length) {
            return '';
        }
        const visible = values.slice(0, limit);
        const remaining = values.length - visible.length;
        return `
            <div class="chip-list compat-row">
                <span class="chip-list-label">${escapeHtml(label)}</span>
                <span class="compat-chip-values">
                    ${visible.map(function (value) {
                        return badge(value);
                    }).join('')}
                    ${remaining > 0 ? badge('+' + remaining) : ''}
                </span>
            </div>
        `;
    }

    function detailChipSection(label, values) {
        if (!values.length) {
            return '';
        }
        return `
            <div class="chip-list" style="margin-bottom: 9px;">
                <span class="chip-list-label">${escapeHtml(label)}</span>
                ${values.map(function (value) {
                    return badge(value);
                }).join('')}
            </div>
        `;
    }

    function badge(value, className = '') {
        return `<span class="badge-chip ${escapeAttr(className)}">${escapeHtml(value)}</span>`;
    }

    function activityPill(icon, value, label) {
        return `
            <span class="activity-pill" title="${escapeAttr(label)}">
                <i class="${escapeAttr(icon)}" aria-hidden="true"></i>
                ${escapeHtml(formatNumber(value))}
            </span>
        `;
    }

    function detailStat(label, value) {
        return `
            <div class="detail-stat">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(formatNumber(value))}</strong>
            </div>
        `;
    }

    function formatDate(epoch) {
        if (!epoch) {
            return 'Unknown';
        }
        return new Date(epoch * 1000).toISOString().slice(0, 10);
    }

    function formatRelative(days) {
        if (days === null || days === undefined) {
            return 'Unknown update age';
        }
        if (days <= 0) {
            return 'Today';
        }
        if (days === 1) {
            return '1 day ago';
        }
        if (days < 31) {
            return `${days} days ago`;
        }
        const months = Math.floor(days / 30);
        if (months < 12) {
            return months === 1 ? '1 month ago' : `${months} months ago`;
        }
        const years = Math.floor(days / 365);
        return years === 1 ? '1 year ago' : `${years} years ago`;
    }

    function formatNumber(value) {
        return new Intl.NumberFormat().format(Number(value) || 0);
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    function safeUrl(value) {
        if (!value) {
            return '';
        }
        try {
            const parsed = new URL(value, window.location.href);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                return parsed.href;
            }
        } catch (error) {
            return '';
        }
        return '';
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            }[character];
        });
    }

    function escapeAttr(value) {
        return escapeHtml(value);
    }

    function debounce(callback, delay) {
        let timer = null;
        return function () {
            const args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function () {
                callback.apply(null, args);
            }, delay);
        };
    }

    window.render_graphs = function (url) {
        const project = state.allProjects.find(function (candidate) {
            return candidate.url === url || candidate.html_url === url;
        });
        if (project) {
            openDetail(project, { focusCharts: true });
        }
    };
})();
