class AirtableDashboard {
    constructor() {
        this.data = [];
        this.filteredData = [];
        this.isEditing = false;
        this.isLoading = false;
        this.lastDataUpdate = null;
        this.syncStatusInterval = null;
        this.isCheckingSyncStatus = false;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadData();

        // Poll léger sur le statut de synchro; le tableau ne se recharge que si last_sync_at change.
        if (this.syncStatusInterval) clearInterval(this.syncStatusInterval);
        this.syncStatusInterval = setInterval(() => {
            this.pollSyncStatus();
        }, 30000);

        window.dashboard = this; // Rendre accessible pour les boutons
        this.loadBackupList(); // Pré-charger la liste des sauvegardes immédiatement
    }

    bindEvents() {
        // Contrôles de la barre latérale (sidebar)
        document.getElementById('toggleHistoryBtn').addEventListener('click', () => this.toggleSidebar(true));
        document.getElementById('closeSidebarBtn').addEventListener('click', () => this.toggleSidebar(false));
        document.getElementById('sidebarOverlay').addEventListener('click', () => this.toggleSidebar(false));

        // Actions de la barre latérale
        document.getElementById('saveSnapshotBtn').addEventListener('click', () => this.saveSnapshot());
        document.getElementById('triggerRecoveryBtn').addEventListener('click', () => this.triggerRecovery());

        // Filtres
        document.getElementById('filterVille').addEventListener('change', () => {
            const villeFilter = document.getElementById('filterVille').value;
            const eventFilter = document.getElementById('filterEvent').value;
            this.populateEventOptions(villeFilter, eventFilter);
            this.applyFilters();
        });
        document.getElementById('filterEvent').addEventListener('change', () => this.applyFilters());
        document.getElementById('filterDateStart').addEventListener('change', () => this.applyFilters());
        document.getElementById('filterDateEnd').addEventListener('change', () => this.applyFilters());
        document.getElementById('resetFiltersBtn').addEventListener('click', () => this.resetFilters());
    }

    toggleSidebar(open) {
        const sidebar = document.getElementById('historySidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (open) {
            sidebar.classList.add('open');
            overlay.classList.add('open');
            this.loadBackupList(); // Rafraîchir la liste à l'ouverture
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

            // Rafraîchir la liste des sauvegardes pour afficher la nouvelle
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

            // Formatage de la date
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

            // Rafraîchir les données après quelques secondes pour voir les changements
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
        if (this.isLoading) return;
        this.isLoading = true;

        if (!silent) this.showLoading(true);
        this.hideError();

        try {
            const payload = await this.fetchAirtableData(force);
            this.lastDataUpdate = this.parseSyncDate(payload.lastSyncAt || payload.lastUpdate);
            this.data = this.sortRowsByDate(this.transformData(payload.records));
            this.filteredData = [...this.data];
            this.populateFilters();
            this.applyFilters();
            this.updateLastUpdateDisplay();

            if (!silent) this.showLoading(false);
            document.getElementById('tableContainer').style.display = 'block';
        } catch (error) {
            console.error('Erreur lors du chargement des données:', error);
            if (!silent) {
                this.showLoading(false);
                this.showError();
            }
        } finally {
            this.isLoading = false;
        }
    }

    async fetchAirtableData(force = false) {
        const url = force ? '/api/data?force=true' : '/api/data';
        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Erreur serveur: ${response.status}`);
        }

        const payload = await response.json();

        if (Array.isArray(payload)) {
            return {
                records: payload,
                lastUpdate: null,
                lastSyncAt: null
            };
        }

        return {
            records: Array.isArray(payload.records) ? payload.records : [],
            lastUpdate: payload.lastUpdate || null,
            lastSyncAt: payload.lastSyncAt || null
        };
    }

    async fetchSyncStatus(force = false) {
        const url = force ? '/api/sync-status?force=true' : '/api/sync-status';
        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Erreur sync-status: ${response.status}`);
        }

        return response.json();
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

            // Pré-calculer le nom d'affichage de l'événement
            if (row['Show']) {
                row._displayEvent = (Array.isArray(row['Show']) ? row['Show'].join(', ') : String(row['Show'])).trim();
            } else {
                row._displayEvent = '';
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

    parseSyncDate(value) {
        if (!value) return null;

        const isoDate = new Date(value);
        if (!Number.isNaN(isoDate.getTime())) {
            return isoDate;
        }

        const usMeridiemMatch = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(am|pm)$/i);
        if (usMeridiemMatch) {
            const month = parseInt(usMeridiemMatch[1], 10) - 1;
            const day = parseInt(usMeridiemMatch[2], 10);
            const year = parseInt(usMeridiemMatch[3], 10);
            let hour = parseInt(usMeridiemMatch[4], 10);
            const minute = parseInt(usMeridiemMatch[5], 10);
            const meridiem = usMeridiemMatch[6].toLowerCase();

            if (meridiem === 'pm' && hour < 12) hour += 12;
            if (meridiem === 'am' && hour === 12) hour = 0;

            return new Date(year, month, day, hour, minute);
        }

        const frDateTimeMatch = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
        if (frDateTimeMatch) {
            const day = parseInt(frDateTimeMatch[1], 10);
            const month = parseInt(frDateTimeMatch[2], 10) - 1;
            const year = parseInt(frDateTimeMatch[3], 10);
            const hour = parseInt(frDateTimeMatch[4], 10);
            const minute = parseInt(frDateTimeMatch[5], 10);

            return new Date(year, month, day, hour, minute);
        }

        return null;
    }

    hasSyncDateChanged(nextSyncDate) {
        if (!this.lastDataUpdate || !nextSyncDate) {
            return false;
        }

        return this.lastDataUpdate.getTime() !== nextSyncDate.getTime();
    }

    async pollSyncStatus(force = false) {
        if (this.isCheckingSyncStatus || this.isEditing) return;

        this.isCheckingSyncStatus = true;

        try {
            const payload = await this.fetchSyncStatus(force);
            const nextSyncDate = this.parseSyncDate(payload.lastSyncAt);
            const syncDateChanged = this.hasSyncDateChanged(nextSyncDate);
            const shouldRefreshDisplay = (
                (!this.lastDataUpdate && nextSyncDate) ||
                (this.lastDataUpdate && !nextSyncDate) ||
                syncDateChanged
            );

            this.lastDataUpdate = nextSyncDate;

            if (shouldRefreshDisplay) {
                this.updateLastUpdateDisplay();
            }

            if (syncDateChanged) {
                await this.loadData(true, true);
            }
        } catch (error) {
            console.error('Erreur de lecture du statut de synchronisation:', error);
        } finally {
            this.isCheckingSyncStatus = false;
        }
    }

    sortRowsByDate(rows) {
        return [...rows].sort((a, b) => {
            const dateA = a._parsedDate ? a._parsedDate.getTime() : Number.MAX_SAFE_INTEGER;
            const dateB = b._parsedDate ? b._parsedDate.getTime() : Number.MAX_SAFE_INTEGER;

            if (dateA !== dateB) {
                return dateA - dateB;
            }

            return String(a['Ville'] || '').localeCompare(String(b['Ville'] || ''), 'fr', { sensitivity: 'base' });
        });
    }

    renderTableBody() {
        const tbody = document.getElementById('tableBody');
        const fragment = document.createDocumentFragment();

        this.filteredData.forEach(row => {
            const tr = document.createElement('tr');

            tr.appendChild(this.createCell(row['Date'] || '-', 'td-date td-sticky'));
            tr.appendChild(this.createCell(row['Ville'] || '-', 'td-ville td-sticky td-sticky-ville'));

            // Re-création de la boucle complète pour s'assurer qu'elle est complète
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

            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);
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

        const percentage = this.normalizePercentageValue(value);

        if (percentage === null) {
            td.textContent = '-';
            return td;
        }

        td.textContent = percentage + '%';

        return td;
    }


    createEditableCell(value, fieldName, recordId, baseClass = '') {
        const td = document.createElement('td');
        td.className = `td-editable ${baseClass}`;
        td.textContent = this.formatNumber(value);
        td.dataset.value = value; // Stocker la valeur brute

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
            input.addEventListener('click', e => e.stopPropagation()); // Empêcher la propagation du clic

            const finishEdit = () => {
                this.isEditing = false;
                td.classList.remove('td-editing');
                td.textContent = this.formatNumber(originalValue);
            };

            // Sauvegarder sur Entrée, Annuler sur Échap
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
                        await this.loadData(true); // Rechargement silencieux pour obtenir les champs calculés
                    } catch (err) {
                        console.error('Update failed', err);
                        alert(`Erreur : ${err.message}`);
                        td.textContent = this.formatNumber(originalValue);
                        td.dataset.value = originalValue;
                    }
                }
            });

            input.addEventListener('blur', () => {
                // Si pas déjà terminé par Entrée/Échap
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
        console.log(`[Mise à jour Proxy] Tentative : Record=${recordId}, Field="${fieldName}", Value=${value}`);

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
            console.error('[Mise à jour Proxy] Échec :', responseData);
            throw new Error(responseData.error || `Erreur Update (${response.status})`);
        }

        console.log('[Mise à jour Proxy] Succès :', responseData);
        return responseData;
    }

    createTauxRemplissageCell(value) {
        const td = document.createElement('td');
        td.className = 'td-remplissage';

        const percentage = this.normalizePercentageValue(value);

        if (percentage === null) {
            td.textContent = '-';
            return td;
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

    normalizePercentageValue(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        const numValue = parseFloat(value);
        if (Number.isNaN(numValue)) {
            return null;
        }

        if (numValue <= 1 && numValue >= -1) {
            return Math.round(numValue * 100);
        }

        return Math.round(numValue);
    }

    populateFilters() {
        const villeSelect = document.getElementById('filterVille');
        const eventSelect = document.getElementById('filterEvent');
        const selectedVille = villeSelect ? villeSelect.value : '';
        const selectedEvent = eventSelect ? eventSelect.value : '';
        const villes = [...new Set(this.data.map(r => r['Ville']).filter(Boolean))].sort();
        villeSelect.innerHTML = '<option value="">Toutes les villes</option>';
        villes.forEach(ville => {
            const option = document.createElement('option');
            option.value = ville;
            option.textContent = ville;
            villeSelect.appendChild(option);
        });

        villeSelect.value = villes.includes(selectedVille) ? selectedVille : '';
        this.populateEventOptions(villeSelect.value, selectedEvent);
    }

    populateEventOptions(villeFilter = '', selectedEvent = '') {
        const eventSelect = document.getElementById('filterEvent');
        if (!eventSelect) return;

        const rowsForEvents = villeFilter
            ? this.data.filter(row => row['Ville'] === villeFilter)
            : this.data;

        const events = [...new Set(rowsForEvents.map(row => row._displayEvent).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

        eventSelect.innerHTML = '<option value="">Tous les évènements</option>';
        events.forEach(ev => {
            const option = document.createElement('option');
            option.value = ev;
            option.textContent = ev;
            eventSelect.appendChild(option);
        });

        if (events.includes(selectedEvent)) {
            eventSelect.value = selectedEvent;
        } else {
            eventSelect.value = '';
        }
    }

    resetFilters() {
        const villeSelect = document.getElementById('filterVille');
        const eventSelect = document.getElementById('filterEvent');
        const dateStartInput = document.getElementById('filterDateStart');
        const dateEndInput = document.getElementById('filterDateEnd');

        if (villeSelect) {
            villeSelect.value = '';
        }

        if (dateStartInput) {
            dateStartInput.value = '';
        }

        if (dateEndInput) {
            dateEndInput.value = '';
        }

        this.populateEventOptions('', '');

        if (eventSelect) {
            eventSelect.value = '';
        }

        this.applyFilters();
    }

    applyFilters() {
        const villeFilter = document.getElementById('filterVille').value;
        const eventSelect = document.getElementById('filterEvent');
        this.populateEventOptions(villeFilter, eventSelect.value);
        const eventFilter = eventSelect.value;
        const dateStartFilter = document.getElementById('filterDateStart').value;
        const dateEndFilter = document.getElementById('filterDateEnd').value;

        this.filteredData = this.sortRowsByDate(this.data.filter(row => {
            let match = true;

            if (villeFilter && row['Ville'] !== villeFilter) {
                match = false;
            }

            // Filtrage rapide utilisant les valeurs pré-calculées
            if (eventFilter && row._displayEvent !== eventFilter) {
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
                    // Correspondance date EXACTE si seule la date de début est fournie
                    if (rowDate.getTime() !== filterDate.getTime()) {
                        match = false;
                    }
                } else if (dateEndFilter) {
                    const filterDate = new Date(dateEndFilter);
                    filterDate.setHours(0, 0, 0, 0);
                    // Correspondance date EXACTE si seule la date de fin est fournie
                    if (rowDate.getTime() !== filterDate.getTime()) {
                        match = false;
                    }
                }
            } else if (dateStartFilter || dateEndFilter) {
                // S'il n'y a pas de date sur la ligne mais qu'un filtre est actif, pas de correspondance
                match = false;
            }

            return match;
        }));

        let sumOr = 0, sumPlatinium = 0, sumArgent = 0;
        let sumQuotaOr = 0, sumQuotaPlatinium = 0, sumQuotaArgent = 0;

        this.filteredData.forEach(row => {
            sumOr += (row['Total - Ventes - Or'] || 0);
            sumQuotaOr += (row['Total - Quota - Or'] || 0);

            sumPlatinium += (row['Total - Ventes - Platinium'] || 0);
            sumQuotaPlatinium += (row['Total - Quota - Platinium'] || 0);

            sumArgent += (row['Total - Ventes - Argent'] || 0);
            sumQuotaArgent += (row['Total - Quota - Argent'] || 0);
        });

        const tableContainer = document.getElementById('tableContainer');

        // Masquage conditionnel des catégories (Or, Platinium, Argent) si les ventes ET les quotas sont à 0
        if (sumOr === 0 && sumQuotaOr === 0) {
            tableContainer.classList.add('hide-or');
        } else {
            tableContainer.classList.remove('hide-or');
        }

        if (sumPlatinium === 0 && sumQuotaPlatinium === 0) {
            tableContainer.classList.add('hide-platinium');
        } else {
            tableContainer.classList.remove('hide-platinium');
        }

        if (sumArgent === 0 && sumQuotaArgent === 0) {
            tableContainer.classList.add('hide-argent');
        } else {
            tableContainer.classList.remove('hide-argent');
        }

        this.renderTableBody();
    }

    updateLastUpdateDisplay() {
        const lastUpdateEl = document.getElementById('lastUpdate');
        if (!lastUpdateEl) return;

        if (!this.lastDataUpdate || Number.isNaN(this.lastDataUpdate.getTime())) {
            lastUpdateEl.textContent = '';
            return;
        }

        const formatter = new Intl.DateTimeFormat('fr-FR', {
            dateStyle: 'short',
            timeStyle: 'medium'
        });

        lastUpdateEl.textContent = `Dernière mise à jour : ${formatter.format(this.lastDataUpdate)}`;
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

        if (!confirm('Voulez-vous lancer l\'actualisation des ventes ?\n\nAttention : ce processus dure environ 10 minutes.')) return;

        btn.disabled = true;
        btn.textContent = 'Actualisation...';

        try {
            const response = await fetch('/api/trigger-recovery', {
                method: 'POST'
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                const detailMessage = Array.isArray(result.details)
                    ? result.details
                        .map(detail => `${detail.source} (${detail.method || 'POST'}): ${detail.status || 'erreur'}${detail.body ? ` - ${detail.body}` : ''}`)
                        .join(' | ')
                    : result.details;
                throw new Error(detailMessage || result.error || 'Echec de l\'actualisation des ventes');
            }

            alert('Actualisation lancée avec succès. Le tableau se rechargera automatiquement dès que last_sync_at sera mis à jour.');
            await this.pollSyncStatus(true);
        } catch (error) {
            console.error('Erreur actualisation des ventes :', error);
            alert('Erreur: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!AIRTABLE_CONFIG.HAS_SERVER_CONFIG) {
        const loadingDiv = document.getElementById('loading');
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                    <h2 style="color: #f59e0b; margin-bottom: 20px;">⚙️ Configuration requise</h2>
                    <p style="color: #4b5563;">Veuillez configurer les variables d'environnement du serveur avant de lancer le tableau de bord.</p>
                </div>
            `;
        }
        return;
    }
    new AirtableDashboard();
});
