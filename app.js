class AirtableDashboard {
    constructor() {
        this.data = [];
        this.filteredData = [];
        this.isEditing = false;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadData();

        // Auto-refresh every 30 seconds (silent mode), only if not editing
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(() => {
            if (!this.isEditing) {
                this.loadData(true);
            }
        }, 30000);

        window.dashboard = this; // Make accessible for buttons
        this.loadBackupList(); // Pre-load backups immediately
    }

    bindEvents() {
        // Sidebar controls
        document.getElementById('toggleHistoryBtn').addEventListener('click', () => this.toggleSidebar(true));
        document.getElementById('closeSidebarBtn').addEventListener('click', () => this.toggleSidebar(false));
        document.getElementById('sidebarOverlay').addEventListener('click', () => this.toggleSidebar(false));

        // Sidebar actions
        document.getElementById('saveSnapshotBtn').addEventListener('click', () => this.saveSnapshot());
        document.getElementById('triggerRecoveryBtn').addEventListener('click', () => this.triggerRecovery());

        // Filters
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
            this.loadBackupList(); // Refresh list on open
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

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Server error details:', errorData);
                throw new Error(errorData.error || 'Erreur lors de la sauvegarde');
            }

            const status = document.getElementById('snapshotStatus');
            if (status) {
                status.textContent = 'Enregistre !';
                status.style.color = '#22c55e';
            }

            // Refresh the backup list to show the new one
            this.loadBackupList();

            setTimeout(() => {
                if (status) status.textContent = '';
            }, 3000);

        } catch (error) {
            const status = document.getElementById('snapshotStatus');
            if (status) {
                status.textContent = 'Erreur: ' + (error.message || '');
                status.style.color = '#ef4444';
            }
            console.error('Snapshot error:', error);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Enregistrer l\'instant T';
        }
    }

    async loadBackupList() {
        const listContainer = document.getElementById('recentSnapshots');

        try {
            const response = await fetch('/api/list-backups');
            if (!response.ok) throw new Error('Impossible de charger la liste');

            const backups = await response.json();
            this.renderBackupList(backups);
        } catch (error) {
            console.error('Load backups error:', error);
            if (listContainer) {
                listContainer.innerHTML = '<p class="sidebar-info" style="color:#ef4444">Erreur de chargement.</p>';
            }
        }
    }

    renderBackupList(backups) {
        const listContainer = document.getElementById('recentSnapshots');
        if (!listContainer) return;

        listContainer.innerHTML = '';

        if (backups.length === 0) {
            listContainer.innerHTML = '<p class="sidebar-info" style="text-align:center">Aucune sauvegarde trouvée.</p>';
            return;
        }

        backups.forEach(backup => {
            const div = document.createElement('div');
            div.className = 'history-item';

            // Date formatting
            let displayDate = backup.date || 'Date inconnue';

            div.innerHTML = `
                <div class="history-info">
                    <span class="history-time">Date: ${displayDate}</span>
                </div>
                <button onclick="dashboard.triggerRestore('${backup.id}')" class="btn-restore-mini">Restaurer</button>
            `;
            listContainer.appendChild(div);
        });
    }

    async triggerRestore(recordId) {
        if (!confirm('Voulez-vous vraiment restaurer cette version ? Les données actuelles seront remplacées.')) {
            return;
        }

        const status = document.getElementById('backupListStatus');
        if (status) {
            status.textContent = 'Restauration en cours...';
            status.style.color = '#3b82f6';
        }

        try {
            const response = await fetch('/api/trigger-restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recordId })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.details || errorData.error || 'Échec de la restauration');
            }

            if (status) {
                status.textContent = 'Demande ! Patientez environ 15 min...';
                status.style.color = '#22c55e';
            }

            // Refresh data after a few seconds to see changes
            setTimeout(() => {
                this.loadData();
                if (status) {
                    status.textContent = 'Donnees actualisees !';
                    setTimeout(() => status.textContent = '', 3000);
                }
            }, 8000);

        } catch (error) {
            console.error('Restore error:', error);
            if (status) {
                status.textContent = 'Erreur: ' + error.message;
                status.style.color = '#ef4444';
            }
        }
    }



    async loadData(silent = false, force = false) {
        if (!silent) this.showLoading(true);
        this.hideError();

        try {
            const records = await this.fetchAirtableData(force);
            this.data = this.transformData(records);
            this.filteredData = [...this.data];

            if (document.getElementById('filterVille').options.length <= 1) {
                this.populateFilters();
            }

            this.applyFilters();

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

    async fetchAirtableData(force = false) {
        const url = force ? '/api/data?force=true' : '/api/data';
        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Erreur serveur: ${response.status}`);
        }

        return await response.json();
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

            this.isEditing = true;
            const originalValue = td.dataset.value;
            td.classList.add('td-editing');
            td.innerHTML = '';

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'edit-input';
            input.value = originalValue;
            input.addEventListener('click', e => e.stopPropagation()); // Prevent bubbling

            const finishEdit = () => {
                this.isEditing = false;
                td.classList.remove('td-editing');
                td.textContent = this.formatNumber(originalValue);
            };

            // Save on Enter, Cancel on Escape
            input.addEventListener('keydown', async (e) => {
                if (e.key === 'Escape') {
                    finishEdit();
                }
                if (e.key === 'Enter') {
                    const newValue = input.value;
                    if (parseFloat(newValue) === parseFloat(originalValue) || (newValue === '' && !originalValue)) {
                        finishEdit();
                        return;
                    }

                    this.isEditing = false;
                    td.classList.remove('td-editing');
                    if (newValue === '') {
                        td.textContent = '-';
                    } else {
                        td.textContent = this.formatNumber(parseFloat(newValue));
                    }
                    td.dataset.value = newValue;

                    try {
                        await this.updateAirtableField(recordId, fieldName, newValue === '' ? null : parseFloat(newValue));
                        td.classList.add('td-saving');
                        setTimeout(() => td.classList.remove('td-saving'), 1000);
                        await this.loadData(true); // Silent reload to get calculated fields
                    } catch (err) {
                        console.error('Update failed', err);
                        alert(`Erreur : ${err.message}`);
                        td.textContent = this.formatNumber(originalValue);
                        td.dataset.value = originalValue;
                    }
                }
            });

            input.addEventListener('blur', () => {
                // If not already finished by Enter/Escape
                if (td.classList.contains('td-editing')) {
                    finishEdit();
                }
            });

            td.appendChild(input);
            input.focus();
        });

        return td;
    }

    async updateAirtableField(recordId, fieldName, value) {
        console.log(`[Proxy Update] Attempting: Record=${recordId}, Field="${fieldName}", Value=${value}`);

        const response = await fetch('/api/update-record', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recordId,
                fieldName,
                value
            })
        });

        const responseData = await response.json().catch(() => ({}));

        if (!response.ok) {
            console.error('[Proxy Update] Failure:', responseData);
            throw new Error(responseData.error || `Erreur Update (${response.status})`);
        }

        console.log('[Proxy Update] Success:', responseData);
        return responseData;
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
                const rowDate = new Date(row['_parsedDate']);
                rowDate.setHours(0, 0, 0, 0);

                if (dateStartFilter && dateEndFilter) {
                    const startDate = new Date(dateStartFilter);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(dateEndFilter);
                    endDate.setHours(23, 59, 59, 999);

                    if (rowDate < startDate || rowDate > endDate) {
                        match = false;
                    }
                } else if (dateStartFilter) {
                    const filterDate = new Date(dateStartFilter);
                    filterDate.setHours(0, 0, 0, 0);
                    // Match EXACT date if only Start is provided
                    if (rowDate.getTime() !== filterDate.getTime()) {
                        match = false;
                    }
                } else if (dateEndFilter) {
                    const filterDate = new Date(dateEndFilter);
                    filterDate.setHours(0, 0, 0, 0);
                    // Match EXACT date if only End is provided
                    if (rowDate.getTime() !== filterDate.getTime()) {
                        match = false;
                    }
                }
            } else if (dateStartFilter || dateEndFilter) {
                // If there's no date on the row but a filter is active, it's not a match
                match = false;
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

    async triggerRecovery() {
        const btn = document.getElementById('triggerRecoveryBtn');
        const originalText = btn.textContent;

        if (!confirm('Voulez-vous lancer la récupération des données ?')) return;

        btn.disabled = true;
        btn.textContent = 'Recuperation...';

        try {
            const response = await fetch('/api/trigger-recovery', {
                method: 'POST'
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Echec de la recuperation');
            }

            alert('Recuperation lancee avec succes !');
            // Refresh data after a short delay
            setTimeout(() => this.loadData(true), 3000);
        } catch (error) {
            console.error('Recovery error:', error);
            alert('Erreur: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Recuperer';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Check against actual placeholders in config.js
    if (AIRTABLE_CONFIG.API_KEY === 'VOTRE_CLE_API' || AIRTABLE_CONFIG.BASE_ID === 'VOTRE_BASE_ID') {
        const loadingDiv = document.getElementById('loading');
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                    <h2 style="color: #f59e0b; margin-bottom: 20px;">⚙️ Configuration requise</h2>
                    <p style="color: #4b5563;">Veuillez configurer vos identifiants Airtable dans <code>config.js</code> ou utiliser les variables d'environnement.</p>
                </div>
            `;
        }
        return;
    }
    new AirtableDashboard();
});
