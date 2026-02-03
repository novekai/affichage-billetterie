class AirtableDashboard {
    constructor() {
        this.data = [];
        this.filteredData = [];
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadData();
    }

    bindEvents() {
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadData());
        document.getElementById('filterVille').addEventListener('change', () => this.applyFilters());
        document.getElementById('filterDateStart').addEventListener('change', () => this.applyFilters());
        document.getElementById('filterDateEnd').addEventListener('change', () => this.applyFilters());
        document.getElementById('btnReset').addEventListener('click', () => this.resetFilters());
    }

    resetFilters() {
        document.getElementById('filterVille').value = '';
        document.getElementById('filterDateStart').value = '';
        document.getElementById('filterDateEnd').value = '';
        this.filteredData = [...this.data];
        this.renderTableBody();
    }

    async loadData() {
        this.showLoading(true);
        this.hideError();

        try {
            const records = await this.fetchAirtableData();
            this.data = this.transformData(records);
            this.filteredData = [...this.data];

            this.populateFilters();
            this.renderTableBody();
            this.updateLastUpdate();

            this.showLoading(false);
            document.getElementById('tableContainer').style.display = 'block';
        } catch (error) {
            console.error('Erreur lors du chargement des données:', error);
            this.showLoading(false);
            this.showError();
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

            tr.appendChild(this.createCell(this.formatNumber(row['Ventes - Fever - Or']), 'td-or'));
            tr.appendChild(this.createCell(this.formatNumber(row['Quota - Fever - Or']), 'td-or td-quota'));
            tr.appendChild(this.createCell(this.formatNumber(row['Ventes - Regiondo - Or']), 'td-or'));
            tr.appendChild(this.createCell(this.formatNumber(row['Quota - Regiondo - Or']), 'td-or td-quota'));
            tr.appendChild(this.createCell(this.formatNumber(row['Ventes - OT - Or']), 'td-or'));
            tr.appendChild(this.createCell(this.formatNumber(row['Quota - OT - Or']), 'td-or td-quota'));
            tr.appendChild(this.createCell(this.formatNumber(row['Total - Ventes - Or']), 'td-or td-total'));
            tr.appendChild(this.createCell(this.formatNumber(row['Total - Quota - Or']), 'td-or td-quota'));
            tr.appendChild(this.createDeltaCell(row['Delta - Or'], row['Total - Ventes - Or'], row['Total - Quota - Or'], 'td-or'));

            tr.appendChild(this.createCell(this.formatNumber(row['Ventes - Fever - Platinium']), 'td-platinium'));
            tr.appendChild(this.createCell(this.formatNumber(row['Quota - Fever - Platinium']), 'td-platinium td-quota'));
            tr.appendChild(this.createCell(this.formatNumber(row['Ventes - Regiondo - Platinium']), 'td-platinium'));
            tr.appendChild(this.createCell(this.formatNumber(row['Quota - Regiondo - Platinium']), 'td-platinium td-quota'));
            tr.appendChild(this.createCell(this.formatNumber(row['Ventes - OT - Platinium']), 'td-platinium'));
            tr.appendChild(this.createCell(this.formatNumber(row['Quota - OT - Platinium']), 'td-platinium td-quota'));
            tr.appendChild(this.createCell(this.formatNumber(row['Total - Ventes - Platinium']), 'td-platinium td-total'));
            tr.appendChild(this.createCell(this.formatNumber(row['Total - Quota - Platinium']), 'td-platinium td-quota'));
            tr.appendChild(this.createDeltaCell(row['Delta - Platinium'], row['Total - Ventes - Platinium'], row['Total - Quota - Platinium'], 'td-platinium'));

            tr.appendChild(this.createCell(this.formatNumber(row['Ventes - Fever - Argent']), 'td-argent'));
            tr.appendChild(this.createCell(this.formatNumber(row['Quota - Fever - Argent']), 'td-argent td-quota'));
            tr.appendChild(this.createCell(this.formatNumber(row['Ventes - Regiondo - Argent']), 'td-argent'));
            tr.appendChild(this.createCell(this.formatNumber(row['Quota - Regiondo - Argent']), 'td-argent td-quota'));
            tr.appendChild(this.createCell(this.formatNumber(row['Ventes - OT - Argent']), 'td-argent'));
            tr.appendChild(this.createCell(this.formatNumber(row['Quota - OT - Argent']), 'td-argent td-quota'));
            tr.appendChild(this.createCell(this.formatNumber(row['Total - Ventes - Argent']), 'td-argent td-total'));
            tr.appendChild(this.createCell(this.formatNumber(row['Total - Quota - Argent']), 'td-argent td-quota'));
            tr.appendChild(this.createDeltaCell(row['Delta - Argent'], row['Total - Ventes - Argent'], row['Total - Quota - Argent'], 'td-argent'));

            tr.appendChild(this.createCell(this.formatNumber(row['Total - Ventes - Fever']), 'td-total-section td-total'));
            tr.appendChild(this.createPercentageCell(row['Total - Ventes - Fever (%)'], 'td-total-section'));
            tr.appendChild(this.createCell(this.formatNumber(row['Total - Ventes - Regiondo']), 'td-total-section td-total'));
            tr.appendChild(this.createPercentageCell(row['Total - Ventes - Regiondo (%)'], 'td-total-section'));
            tr.appendChild(this.createCell(this.formatNumber(row['Total - Ventes - OT']), 'td-total-section td-total'));
            tr.appendChild(this.createPercentageCell(row['Total - Ventes - OT (%)'], 'td-total-section'));
            tr.appendChild(this.createCell(this.formatNumber(row['Total - Ventes']), 'td-total-section td-total'));
            tr.appendChild(this.createCell(this.formatNumber(row['Total - Quota']), 'td-total-section td-quota'));
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
