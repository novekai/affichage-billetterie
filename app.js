class AirtableDashboard {
    constructor() {
        this.data = [];
        this.filteredData = [];
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadData();

        // Auto-refresh every 30 seconds (silent mode)
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(() => this.loadData(true), 30000);

        // Session history storage
        this.sessionHistory = [];
        window.dashboard = this; // Make accessible for mini-buttons
    }

    bindEvents() {
        // Sidebar controls
        document.getElementById('toggleHistoryBtn').addEventListener('click', () => this.toggleSidebar(true));
        document.getElementById('closeSidebarBtn').addEventListener('click', () => this.toggleSidebar(false));
        document.getElementById('sidebarOverlay').addEventListener('click', () => this.toggleSidebar(false));

        // Manual Refresh Icon (Silent)
        document.getElementById('manualRefreshBtn').addEventListener('click', () => {
            const btn = document.getElementById('manualRefreshBtn');
            // Visual rotation feedback
            btn.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            btn.style.transform = 'rotate(360deg)';

            this.loadData(true); // Silent mode!

            setTimeout(() => {
                btn.style.transition = 'none';
                btn.style.transform = 'rotate(0deg)';
            }, 600);
        });

        // History actions
        document.getElementById('saveSnapshotBtn').addEventListener('click', () => this.saveSnapshot());
        document.getElementById('loadHistoryBtn').addEventListener('click', () => this.loadHistory());

        document.getElementById('filterVille').addEventListener('change', () => this.applyFilters());
        document.getElementById('filterDateStart').addEventListener('change', () => this.applyFilters());
        document.getElementById('filterDateEnd').addEventListener('change', () => this.applyFilters());
    }

    toggleSidebar(open) {
        const sidebar = document.getElementById('historySidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (open) {
            sidebar.classList.add('open');
            overlay.classList.add('open');
        } else {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
        }
    }

    async saveSnapshot() {
        const btn = document.getElementById('saveSnapshotBtn');
        const now = new Date();
        const timestamp = now.toLocaleString('fr-FR');

        btn.disabled = true;
        btn.textContent = 'Enregistrement...';

        try {
            const snapshotData = {
                timestamp: timestamp,
                recordCount: this.data.length,
                data: this.data
            };

            const response = await fetch('/api/save-snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(snapshotData)
            });

            if (!response.ok) throw new Error('Erreur lors de la sauvegarde');

            // Track in current session
            this.sessionHistory.unshift({
                id: Date.now(),
                time: timestamp,
                date: now.toISOString().split('T')[0]
            });

            this.renderRecentSnapshots();
            alert(`Instantané enregistré avec succès ! (${timestamp})`);

        } catch (error) {
            console.error('Save snapshot error:', error);
            alert('Erreur lors de l\'enregistrement de l\'instantané.');
        } finally {
            btn.disabled = false;
            btn.textContent = '💾 Enregistrer l\'instant T';
        }
    }

    async loadHistory(forcedDate = null) {
        const btn = document.getElementById('loadHistoryBtn');
        const status = document.getElementById('historyStatus');

        const dateStart = forcedDate || document.getElementById('historyDateStart').value;
        const dateEnd = document.getElementById('historyDateEnd').value;

        if (!dateStart) {
            status.textContent = 'Sélectionnez une date.';
            status.style.color = '#ef4444';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Chargement...';
        status.textContent = '';
        status.className = 'status-msg';

        try {
            let url = `/api/history?date=${dateStart}`;
            if (dateEnd) url += `&endDate=${dateEnd}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Erreur récupération');

            const historyData = await response.json();

            if (!historyData || (Array.isArray(historyData) && historyData.length === 0) || (historyData.records && historyData.records.length === 0)) {
                status.textContent = 'Aucun historique trouvé.';
                status.style.color = '#eab308';
                return;
            }

            let records = historyData.records || historyData;

            this.data = this.transformData(records);
            this.filteredData = [...this.data];
            this.applyFilters();
            this.renderTableBody();
            this.updateLastUpdate();

            status.textContent = 'Données restaurées !';
            status.style.color = '#10b981';

            // Automatically close sidebar to show the table
            setTimeout(() => this.toggleSidebar(false), 800);

        } catch (error) {
            console.error('History load error:', error);
            status.textContent = 'Erreur lors de la récupération.';
            status.style.color = '#ef4444';
        } finally {
            btn.disabled = false;
            btn.textContent = '📥 Récupérer';
        }
    }

    async loadData(silent = false) {
        if (!silent) this.showLoading(true);
        this.hideError();

        try {
            const records = await this.fetchAirtableData();
            this.data = this.transformData(records);
            this.filteredData = [...this.data];

            if (document.getElementById('filterVille').options.length <= 1) {
                this.populateFilters();
            }

            this.applyFilters();
            this.updateLastUpdate();

            if (!silent) this.showLoading(false);
            document.getElementById('tableContainer').style.display = 'block';
        } catch (error) {
            console.error('Erreur lors du chargement des données:', error);
            if (!silent) {
                this.showLoading(false);
                this.showError();
            }
        }
    }

    async fetchAirtableData() {
        const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.BASE_ID}/${encodeURIComponent(AIRTABLE_CONFIG.TABLE_NAME)}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_CONFIG.API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Erreur Airtable: ${response.status}`);
        }

        const data = await response.json();
        let allRecords = data.records;
        let offset = data.offset;

        while (offset) {
            const nextResponse = await fetch(`${url}?offset=${offset}`, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_CONFIG.API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            const nextData = await nextResponse.json();
            allRecords = allRecords.concat(nextData.records);
            offset = nextData.offset;
        }

        return allRecords;
    }

    transformData(records) {
        return records.map(record => {
            const row = { id: record.id };

            COLUMNS_ORDER.forEach(column => {
                row[column] = record.fields[column] ?? null;
            });

            if (row['Date']) {
                row['_parsedDate'] = this.parseAirtableDate(row['Date']);
            }

            return row;
        });
    }

    parseAirtableDate(dateStr) {
        if (!dateStr) return null;

        const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1;
            const year = parseInt(match[3], 10);
            return new Date(year, month, day);
        }

        const isoDate = new Date(dateStr);
        return isNaN(isoDate.getTime()) ? null : isoDate;
    }

    renderTableBody() {
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';

        this.filteredData.forEach(row => {
            const tr = document.createElement('tr');

            tr.appendChild(this.createCell(row['Date'] || '-', 'td-date td-sticky'));
            tr.appendChild(this.createCell(row['Ville'] || '-', 'td-ville td-sticky td-sticky-ville'));

            tr.appendChild(this.createEditableCell(row['Ventes - Fever - Or'], 'Ventes - Fever - Or', row.id, 'td-or'));
            tr.appendChild(this.createEditableCell(row['Quota - Fever - Or'], 'Quota - Fever - Or', row.id, 'td-or td-quota'));
            tr.appendChild(this.createEditableCell(row['Ventes - Regiondo - Or'], 'Ventes - Regiondo - Or', row.id, 'td-or'));
            tr.appendChild(this.createEditableCell(row['Quota - Regiondo - Or'], 'Quota - Regiondo - Or', row.id, 'td-or td-quota'));
            tr.appendChild(this.createEditableCell(row['Ventes - OT - Or'], 'Ventes - OT - Or', row.id, 'td-or'));
            tr.appendChild(this.createEditableCell(row['Quota - OT - Or'], 'Quota - OT - Or', row.id, 'td-or td-quota'));
            tr.appendChild(this.createCell(this.formatNumber(row['Total - Ventes - Or']), 'td-or td-total'));
            tr.appendChild(this.createEditableCell(row['Total - Quota - Or'], 'Total - Quota - Or', row.id, 'td-or td-quota'));
            tr.appendChild(this.createDeltaCell(row['Delta - Or'], row['Total - Ventes - Or'], row['Total - Quota - Or'], 'td-or'));

            tr.appendChild(this.createEditableCell(row['Ventes - Fever - Platinium'], 'Ventes - Fever - Platinium', row.id, 'td-platinium'));
            tr.appendChild(this.createEditableCell(row['Quota - Fever - Platinium'], 'Quota - Fever - Platinium', row.id, 'td-platinium td-quota'));
            tr.appendChild(this.createEditableCell(row['Ventes - Regiondo - Platinium'], 'Ventes - Regiondo - Platinium', row.id, 'td-platinium'));
            tr.appendChild(this.createEditableCell(row['Quota - Regiondo - Platinium'], 'Quota - Regiondo - Platinium', row.id, 'td-platinium td-quota'));
            tr.appendChild(this.createEditableCell(row['Ventes - OT - Platinium'], 'Ventes - OT - Platinium', row.id, 'td-platinium'));
            tr.appendChild(this.createEditableCell(row['Quota - OT - Platinium'], 'Quota - OT - Platinium', row.id, 'td-platinium td-quota'));
            tr.appendChild(this.createCell(this.formatNumber(row['Total - Ventes - Platinium']), 'td-platinium td-total'));
            tr.appendChild(this.createEditableCell(row['Total - Quota - Platinium'], 'Total - Quota - Platinium', row.id, 'td-platinium td-quota'));
            tr.appendChild(this.createDeltaCell(row['Delta - Platinium'], row['Total - Ventes - Platinium'], row['Total - Quota - Platinium'], 'td-platinium'));

            tr.appendChild(this.createEditableCell(row['Ventes - Fever - Argent'], 'Ventes - Fever - Argent', row.id, 'td-argent'));
            tr.appendChild(this.createEditableCell(row['Quota - Fever - Argent'], 'Quota - Fever - Argent', row.id, 'td-argent td-quota'));
            tr.appendChild(this.createEditableCell(row['Ventes - Regiondo - Argent'], 'Ventes - Regiondo - Argent', row.id, 'td-argent'));
            tr.appendChild(this.createEditableCell(row['Quota - Regiondo - Argent'], 'Quota - Regiondo - Argent', row.id, 'td-argent td-quota'));
            tr.appendChild(this.createEditableCell(row['Ventes - OT - Argent'], 'Ventes - OT - Argent', row.id, 'td-argent'));
            tr.appendChild(this.createEditableCell(row['Quota - OT - Argent'], 'Quota - OT - Argent', row.id, 'td-argent td-quota'));
            tr.appendChild(this.createCell(this.formatNumber(row['Total - Ventes - Argent']), 'td-argent td-total'));
            tr.appendChild(this.createEditableCell(row['Total - Quota - Argent'], 'Total - Quota - Argent', row.id, 'td-argent td-quota'));
            tr.appendChild(this.createDeltaCell(row['Delta - Argent'], row['Total - Ventes - Argent'], row['Total - Quota - Argent'], 'td-argent'));

            tr.appendChild(this.createEditableCell(row['Total - Ventes - Fever'], 'Total - Ventes - Fever', row.id, 'td-total-section td-total'));
            tr.appendChild(this.createPercentageCell(row['Total - Ventes - Fever (%)'], 'td-total-section'));
            tr.appendChild(this.createEditableCell(row['Total - Ventes - Regiondo'], 'Total - Ventes - Regiondo', row.id, 'td-total-section td-total'));
            tr.appendChild(this.createPercentageCell(row['Total - Ventes - Regiondo (%)'], 'td-total-section'));
            tr.appendChild(this.createEditableCell(row['Total - Ventes - OT'], 'Total - Ventes - OT', row.id, 'td-total-section td-total'));
            tr.appendChild(this.createPercentageCell(row['Total - Ventes - OT (%)'], 'td-total-section'));
            tr.appendChild(this.createEditableCell(row['Total - Ventes'], 'Total - Ventes', row.id, 'td-total-section td-total'));
            tr.appendChild(this.createEditableCell(row['Total - Quota'], 'Total - Quota', row.id, 'td-total-section td-quota'));
            tr.appendChild(this.createDeltaCell(row['Total - Delta'], row['Total - Ventes'], row['Total - Quota'], 'td-total-section'));
            tr.appendChild(this.createTauxRemplissageCell(row['Taux de remplissage']));

            tbody.appendChild(tr);
        });
    }

    createCell(content, className = '') {
        const td = document.createElement('td');
        td.textContent = content;
        if (className) td.className = className;
        return td;
    }

    createDeltaCell(deltaValue, ventesValue, quotaValue, baseClass = '') {
        const td = document.createElement('td');
        td.className = `td-delta ${baseClass}`;

        if (deltaValue === null || deltaValue === undefined) {
            td.textContent = '-';
            return td;
        }

        const delta = parseFloat(deltaValue) || 0;
        const quota = parseFloat(quotaValue) || 1;

        const percentage = quota > 0 ? Math.max(0, Math.min(100, (delta / quota) * 100)) : 0;

        const progressBar = document.createElement('div');
        progressBar.className = 'delta-progress';
        progressBar.style.width = percentage + '%';

        const valueSpan = document.createElement('span');
        valueSpan.className = 'delta-value';
        valueSpan.textContent = delta;

        td.appendChild(progressBar);
        td.appendChild(valueSpan);

        return td;
    }

    createPercentageCell(value, baseClass = '') {
        const td = document.createElement('td');
        td.className = `td-percentage ${baseClass}`;

        if (value === null || value === undefined) {
            td.textContent = '-';
            return td;
        }

        const numValue = parseFloat(value);
        td.textContent = numValue.toFixed(0) + '%';

        return td;
    }


    createEditableCell(value, fieldName, recordId, baseClass = '') {
        const td = document.createElement('td');
        td.className = `td-editable ${baseClass}`;
        td.textContent = this.formatNumber(value);
        td.dataset.value = value; // Store raw value

        td.addEventListener('dblclick', () => {
            if (td.classList.contains('td-editing')) return;

            const originalValue = td.dataset.value;
            td.classList.add('td-editing');
            td.textContent = '';

            const input = document.createElement('input');
            input.type = 'number';
            input.value = originalValue !== undefined && originalValue !== null ? originalValue : '';
            input.addEventListener('click', e => e.stopPropagation()); // Prevent bubbling

            // Save on Enter, Cancel on Escape
            input.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    const newValue = input.value;
                    // Optimistic update
                    td.classList.remove('td-editing');
                    td.textContent = this.formatNumber(parseFloat(newValue));
                    td.dataset.value = newValue;

                    try {
                        await this.updateAirtableField(recordId, fieldName, parseFloat(newValue));
                        td.classList.add('td-saving');
                        setTimeout(() => td.classList.remove('td-saving'), 1000);
                        // Reload mostly to update totals/deltas
                        await this.loadData();
                    } catch (err) {
                        console.error('Update failed', err);
                        alert('Erreur lors de la sauvegarde');
                        // Revert
                        td.textContent = this.formatNumber(originalValue);
                        td.dataset.value = originalValue;
                    }
                } else if (e.key === 'Escape') {
                    td.classList.remove('td-editing');
                    td.textContent = this.formatNumber(originalValue);
                }
            });

            // Save on blur? Maybe risky if just clicking away. Let's stick to Enter for now or confirm on blur.
            // Let's support blur as save for better UX.
            input.addEventListener('blur', async () => {
                // If we are still editing (didn't hit Enter/Escape which remove the class)
                if (td.classList.contains('td-editing')) {
                    const newValue = input.value;
                    if (parseFloat(newValue) === parseFloat(originalValue) || (newValue === '' && !originalValue)) {
                        td.classList.remove('td-editing');
                        td.textContent = this.formatNumber(originalValue);
                        return;
                    }

                    td.classList.remove('td-editing');
                    if (newValue === '') {
                        td.textContent = '-'; // or whatever formatNumber returns for null
                    } else {
                        td.textContent = this.formatNumber(parseFloat(newValue));
                    }
                    td.dataset.value = newValue;

                    try {
                        await this.updateAirtableField(recordId, fieldName, newValue === '' ? null : parseFloat(newValue));
                        td.classList.add('td-saving');
                        setTimeout(() => td.classList.remove('td-saving'), 1000);
                        await this.loadData();
                    } catch (err) {
                        console.error('Update failed', err);
                        alert('Erreur lors de la sauvegarde');
                        td.textContent = this.formatNumber(originalValue);
                        td.dataset.value = originalValue;
                    }
                }
            });

            td.appendChild(input);
            input.focus();
        });

        return td;
    }

    async updateAirtableField(recordId, fieldName, value) {
        const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.BASE_ID}/${encodeURIComponent(AIRTABLE_CONFIG.TABLE_NAME)}/${recordId}`;

        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_CONFIG.API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: {
                    [fieldName]: value
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Erreur Update Airtable: ${response.status}`);
        }
        return await response.json();
    }

    createTauxRemplissageCell(value) {
        const td = document.createElement('td');
        td.className = 'td-remplissage';

        if (value === null || value === undefined || value === '') {
            td.textContent = '-';
            return td;
        }

        const numValue = parseFloat(value);
        let percentage;

        if (numValue <= 1) {
            percentage = Math.round(numValue * 100);
        } else {
            percentage = Math.round(numValue);
        }

        td.textContent = percentage + '%';

        if (percentage >= 100) {
            td.style.backgroundColor = '#C6EFCE';
            td.style.color = '#006100';
        } else if (percentage > 0) {
            td.style.backgroundColor = '#FFEB9C';
            td.style.color = '#9C5700';
        } else {
            td.style.backgroundColor = '#F8696B';
            td.style.color = 'white';
        }

        return td;
    }

    populateFilters() {
        const villes = [...new Set(this.data.map(r => r['Ville']).filter(Boolean))].sort();

        const villeSelect = document.getElementById('filterVille');
        villeSelect.innerHTML = '<option value="">Toutes les villes</option>';
        villes.forEach(ville => {
            const option = document.createElement('option');
            option.value = ville;
            option.textContent = ville;
            villeSelect.appendChild(option);
        });
    }

    applyFilters() {
        const villeFilter = document.getElementById('filterVille').value;
        const dateStartFilter = document.getElementById('filterDateStart').value;
        const dateEndFilter = document.getElementById('filterDateEnd').value;

        this.filteredData = this.data.filter(row => {
            let match = true;

            if (villeFilter && row['Ville'] !== villeFilter) {
                match = false;
            }

            if (row['_parsedDate']) {
                if (dateStartFilter && dateEndFilter) {
                    const startDate = new Date(dateStartFilter);
                    const endDate = new Date(dateEndFilter);
                    endDate.setHours(23, 59, 59, 999);
                    if (row['_parsedDate'] < startDate || row['_parsedDate'] > endDate) {
                        match = false;
                    }
                } else if (dateStartFilter) {
                    const filterDate = new Date(dateStartFilter);
                    const rowDateStr = row['_parsedDate'].toDateString();
                    const filterDateStr = filterDate.toDateString();
                    if (rowDateStr !== filterDateStr) {
                        match = false;
                    }
                } else if (dateEndFilter) {
                    const filterDate = new Date(dateEndFilter);
                    const rowDateStr = row['_parsedDate'].toDateString();
                    const filterDateStr = filterDate.toDateString();
                    if (rowDateStr !== filterDateStr) {
                        match = false;
                    }
                }
            }

            return match;
        });

        this.renderTableBody();
    }

    formatNumber(value) {
        if (value === null || value === undefined) return '-';
        return new Intl.NumberFormat('fr-FR').format(value);
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'flex' : 'none';
    }

    showError() {
        document.getElementById('error').style.display = 'block';
    }

    hideError() {
        document.getElementById('error').style.display = 'none';
    }

    updateLastUpdate() {
        const now = new Date();
        document.getElementById('lastUpdate').textContent = `Dernière mise à jour: ${now.toLocaleTimeString('fr-FR')}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (AIRTABLE_CONFIG.API_KEY === 'VOTRE_CLE_API_ICI' || AIRTABLE_CONFIG.BASE_ID === 'VOTRE_BASE_ID_ICI') {
        document.getElementById('loading').innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h2 style="color: #f59e0b; margin-bottom: 20px;">⚙️ Configuration requise</h2>
                <p>Veuillez configurer vos identifiants Airtable dans config.js</p>
            </div>
        `;
        return;
    }
    new AirtableDashboard();
});
