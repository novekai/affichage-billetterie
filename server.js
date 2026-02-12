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

// Proxy for Listing Backups from Airtable "Backup Data" table
app.get('/api/list-backups', async (req, res) => {
    try {
        const apiKey = process.env.AIRTABLE_API_KEY || '';
        const baseId = process.env.AIRTABLE_BASE_ID || '';
        const tableName = 'Backup Data';

        if (!apiKey || !baseId) {
            return res.status(500).json({ error: 'Server configuration missing API Key or Base ID' });
        }

        const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=20`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Airtable list error (${response.status}):`, errorText);
            return res.status(response.status).json({
                error: 'Airtable list-backups error',
                status: response.status,
                details: errorText
            });
        }

        const data = await response.json();
        // Map to simpler format for frontend
        const backups = data.records.map(record => ({
            id: record.id,
            date: record.fields['Date'],
            backupId: record.fields['Id du backup']
        }));

        res.json(backups);
    } catch (error) {
        console.error('List backups proxy error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// Proxy for Triggering Restoration (POST)
app.post('/api/trigger-restore', async (req, res) => {
    try {
        const { recordId } = req.body;
        if (!recordId) {
            return res.status(400).json({ error: 'recordId is required' });
        }

        const webhookUrl = 'https://n8n.srv1189694.hstgr.cloud/webhook/gestion-billetterie-restaure-backup';

        // n8n expects recordId as a query param or in the body depending on configuration.
        // Based on CONCATENATE URL provided by user, it likely expects recordId=...
        const urlWithParams = `${webhookUrl}?recordId=${recordId}`;

        console.log(`Triggering Restore for RecordID: ${recordId}`);

        const response = await fetch(urlWithParams, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recordId }) // Send in body too just in case
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`n8n restore error (${response.status}):`, errorText);
            return res.status(response.status).json({
                error: 'n8n restoration error',
                status: response.status,
                details: errorText
            });
        }

        const result = await response.text(); // n8n might not return JSON
        res.json({ status: 'success', details: result });
    } catch (error) {
        console.error('Trigger restore proxy error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
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
            const errorText = await response.text();
            console.error(`n8n error (${response.status}):`, errorText);
            return res.status(response.status).json({
                error: 'n8n webhook error',
                status: response.status,
                details: errorText
            });
        }

        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error('Save snapshot proxy error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// Proxy for Updating Airtable Record
app.patch('/api/update-record', async (req, res) => {
    try {
        const { recordId, fieldName, value } = req.body;
        const apiKey = process.env.AIRTABLE_API_KEY || '';
        const baseId = process.env.AIRTABLE_BASE_ID || '';
        const tableName = process.env.AIRTABLE_TABLE_NAME || 'Allocation billetterie';

        console.log(`Update Request: Record=${recordId}, Field="${fieldName}", Value=${value}`);

        if (!apiKey || !baseId) {
            console.error('Missing Airtable credentials in environment variables');
            return res.status(500).json({ error: 'Server configuration missing API Key or Base ID' });
        }

        const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${recordId}`;
        console.log(`Airtable URL: ${url}`);

        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: {
                    [fieldName]: value
                }
            })
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error(`Airtable Error (${response.status}):`, JSON.stringify(responseData));
            return res.status(response.status).json({
                error: 'Airtable update error',
                status: response.status,
                details: responseData
            });
        }

        console.log('Airtable Update Success:', JSON.stringify(responseData));
        res.json(responseData);
    } catch (error) {
        console.error('Update record proxy error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

app.use(express.static(path.join(__dirname)));

app.listen(PORT, function () {
    console.log('Server running on port ' + PORT);
});
