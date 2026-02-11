const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/config.js', (req, res) => {
    const apiKey = process.env.AIRTABLE_API_KEY || '';
    const baseId = process.env.AIRTABLE_BASE_ID || '';
    const tableName = process.env.AIRTABLE_TABLE_NAME || 'Allocation billetterie';

    const config = `
const AIRTABLE_CONFIG = {
    API_KEY: '${apiKey}',
    BASE_ID: '${baseId}',
    TABLE_NAME: '${tableName}'
};

const COLUMN_CONFIG = {
    'Date': { type: 'date', group: 'main' },
    'Ville': { type: 'text', group: 'main' },
    'Ventes - Fever - Or': { type: 'number', group: 'or' },
    'Quota - Fever - Or': { type: 'quota', group: 'or' },
    'Ventes - Regiondo - Or': { type: 'number', group: 'or' },
    'Quota - Regiondo - Or': { type: 'quota', group: 'or' },
    'Ventes - OT - Or': { type: 'number', group: 'or' },
    'Quota - OT - Or': { type: 'quota', group: 'or' },
    'Total - Ventes - Or': { type: 'total', group: 'or' },
    'Total - Quota - Or': { type: 'quota', group: 'or' },
    'Delta - Or': { type: 'delta', group: 'or' },
    'Ventes - Fever - Platinium': { type: 'number', group: 'platinium' },
    'Quota - Fever - Platinium': { type: 'quota', group: 'platinium' },
    'Ventes - Regiondo - Platinium': { type: 'number', group: 'platinium' },
    'Quota - Regiondo - Platinium': { type: 'quota', group: 'platinium' },
    'Ventes - OT - Platinium': { type: 'number', group: 'platinium' },
    'Quota - OT - Platinium': { type: 'quota', group: 'platinium' },
    'Total - Ventes - Platinium': { type: 'total', group: 'platinium' },
    'Total - Quota - Platinium': { type: 'quota', group: 'platinium' },
    'Delta - Platinium': { type: 'delta', group: 'platinium' },
    'Ventes - Fever - Argent': { type: 'number', group: 'argent' },
    'Quota - Fever - Argent': { type: 'quota', group: 'argent' },
    'Ventes - Regiondo - Argent': { type: 'number', group: 'argent' },
    'Quota - Regiondo - Argent': { type: 'quota', group: 'argent' },
    'Ventes - OT - Argent': { type: 'number', group: 'argent' },
    'Quota - OT - Argent': { type: 'quota', group: 'argent' },
    'Total - Ventes - Argent': { type: 'total', group: 'argent' },
    'Total - Quota - Argent': { type: 'quota', group: 'argent' },
    'Delta - Argent': { type: 'delta', group: 'argent' },
    'Total - Ventes - Fever': { type: 'total', group: 'total' },
    'Total - Ventes - Fever (%)': { type: 'percentage', group: 'total' },
    'Total - Ventes - Regiondo': { type: 'total', group: 'total' },
    'Total - Ventes - Regiondo (%)': { type: 'percentage', group: 'total' },
    'Total - Ventes - OT': { type: 'total', group: 'total' },
    'Total - Ventes - OT (%)': { type: 'percentage', group: 'total' },
    'Total - Ventes': { type: 'total', group: 'total' },
    'Total - Quota': { type: 'quota', group: 'total' },
    'Total - Delta': { type: 'delta', group: 'total' },
    'Taux de remplissage': { type: 'remplissage', group: 'main' }
};

const COLUMNS_ORDER = [
    'Date',
    'Ville',
    'Ventes - Fever - Or',
    'Quota - Fever - Or',
    'Ventes - Regiondo - Or',
    'Quota - Regiondo - Or',
    'Ventes - OT - Or',
    'Quota - OT - Or',
    'Total - Ventes - Or',
    'Total - Quota - Or',
    'Delta - Or',
    'Ventes - Fever - Platinium',
    'Quota - Fever - Platinium',
    'Ventes - Regiondo - Platinium',
    'Quota - Regiondo - Platinium',
    'Ventes - OT - Platinium',
    'Quota - OT - Platinium',
    'Total - Ventes - Platinium',
    'Total - Quota - Platinium',
    'Delta - Platinium',
    'Ventes - Fever - Argent',
    'Quota - Fever - Argent',
    'Ventes - Regiondo - Argent',
    'Quota - Regiondo - Argent',
    'Ventes - OT - Argent',
    'Quota - OT - Argent',
    'Total - Ventes - Argent',
    'Total - Quota - Argent',
    'Delta - Argent',
    'Total - Ventes - Fever',
    'Total - Ventes - Fever (%)',
    'Total - Ventes - Regiondo',
    'Total - Ventes - Regiondo (%)',
    'Total - Ventes - OT',
    'Total - Ventes - OT (%)',
    'Total - Ventes',
    'Total - Quota',
    'Total - Delta',
    'Taux de remplissage'
];
`;
    res.setHeader('Content-Type', 'application/javascript');
    res.send(config);
});

app.use(express.json({ limit: '50mb' }));

// Proxy for History Webhook (to avoid CORS)
app.get('/api/history', async (req, res) => {
    try {
        const date = req.query.date;
        const endDate = req.query.endDate;
        let webhookUrl = 'https://n8n.srv1189694.hstgr.cloud/webhook/gestion-billetterie-backup';

        const params = new URLSearchParams();
        if (date) params.append('date', date);
        if (endDate) params.append('endDate', endDate);

        const queryString = params.toString();
        if (queryString) webhookUrl += `?${queryString}`;

        const response = await fetch(webhookUrl);

        if (!response.ok) {
            throw new Error(`Webhook error: ${response.status}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Proxy for Saving Snapshot (POST)
app.post('/api/save-snapshot', async (req, res) => {
    try {
        const webhookUrl = 'https://n8n.srv1189694.hstgr.cloud/webhook/gestion-billetterie-backup';

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            throw new Error(`Webhook error: ${response.status}`);
        }

        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error('Save snapshot proxy error:', error);
        res.status(500).json({ error: 'Failed to save snapshot' });
    }
});

app.use(express.static(path.join(__dirname)));

app.listen(PORT, function () {
    console.log('Server running on port ' + PORT);
});
