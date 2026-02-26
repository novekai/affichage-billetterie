const express = require('express');
const path = require('path');
const basicAuth = require('express-basic-auth');

const app = express();

// Récupération du mot de passe depuis les variables d'environnement (par ex. sur Railway)
const password = process.env.DASHBOARD_PASSWORD;

if (!password) {
    console.warn("ATTENTION : La variable d'environnement DASHBOARD_PASSWORD n'est pas définie. Un accès non sécurisé ou par défaut sera utilisé.");
}

app.use(basicAuth({
    users: { 'admin': password || 'admin' }, // Mot de passe local par défaut si manquant
    challenge: true,
    realm: 'Tableau de bord de billetterie'
}));


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
    'Show': { type: 'text', group: 'main' },
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
    'Show',
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

// Cache en mémoire amélioré avec rafraîchissement en arrière-plan
let dataCache = {
    records: null,
    lastUpdate: 0,
    isUpdating: false,
    ttl: 300000 // Cache standard de 5 minutes
};

// Champs cibles pour réduire la taille du payload et accélérer la réponse d'Airtable
const TARGET_FIELDS = [
    'Date',
    'Ville',
    'Show',
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

// Proxy pour récupérer les données principales d'Airtable
app.get('/api/data', async (req, res) => {
    try {
        const now = Date.now();
        const force = req.query.force === 'true';

        // 1. Si nous avons du cache et qu'il est valide, nous le renvoyons immédiatement
        if (!force && dataCache.records && dataCache.lastUpdate > 0 && (now - dataCache.lastUpdate < dataCache.ttl)) {
            console.log('Service des données valides depuis le cache');
            return res.json(dataCache.records);
        }

        // 2. Si nous avons un cache obsolète ET qu'il n'a pas été explicitement invalidé (lastUpdate > 0), 
        // nous le renvoyons immédiatement ET déclenchons la mise à jour en arrière-plan.
        // Si lastUpdate === 0, cela signifie qu'une mise à jour vient d'avoir lieu, nous DEVONS attendre les données fraîches.
        if (!force && dataCache.records && dataCache.lastUpdate > 0 && !dataCache.isUpdating) {
            console.log('Service des données obsolètes, rafraîchissement en arrière-plan déclenché...');
            refreshDataInBackground(); // Démarrer le rafraîchissement sans l'attendre
            return res.json(dataCache.records);
        }

        // 3. S'il n'y a pas de cache ou si le rafraîchissement est forcé, nous devons attendre les données fraîches
        const freshData = await refreshDataInBackground();
        res.json(freshData);

    } catch (error) {
        console.error('Erreur proxy données:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Fonction de récupération optimisée en arrière-plan avec filtrage des champs
 */
async function refreshDataInBackground() {
    if (dataCache.isUpdating) return dataCache.records;

    dataCache.isUpdating = true;
    try {
        const apiKey = process.env.AIRTABLE_API_KEY || '';
        const baseId = process.env.AIRTABLE_BASE_ID || '';
        const tableName = process.env.AIRTABLE_TABLE_NAME || 'Allocation billetterie';

        if (!apiKey || !baseId) throw new Error('Missing credentials (API Key or Base ID)');

        let allRecords = [];
        let offset = null;
        const baseUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;

        console.log(`[Cache Update] Fetching fresh data from Airtable...`);
        const startTime = Date.now();

        do {
            const params = new URLSearchParams();
            if (offset) params.append('offset', offset);
            params.append('view', 'Grid view');

            // Speed optimization: Only ask for specific fields
            TARGET_FIELDS.forEach(f => params.append('fields[]', f));

            const response = await fetch(`${baseUrl}?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Airtable error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            allRecords = allRecords.concat(data.records);
            offset = data.offset;
        } while (offset);

        // Mise à jour du cache global
        dataCache.records = allRecords;
        dataCache.lastUpdate = Date.now();
        console.log(`[Mise à jour Cache] Succès. ${allRecords.length} enregistrements en ${(Date.now() - startTime) / 1000}s`);

        return allRecords;
    } catch (err) {
        console.error('[Mise à jour Cache] ÉCHEC:', err.message);
        // S'il s'agissait du premier chargement, propager l'erreur. Si rafraîchissement arrière-plan, juste logger.
        if (!dataCache.records) throw err;
        return dataCache.records;
    } finally {
        dataCache.isUpdating = false;
    }
}

// Proxy pour lister les sauvegardes de la table Airtable "Backup Data"
app.get('/api/list-backups', async (req, res) => {
    try {
        const apiKey = process.env.AIRTABLE_API_KEY || '';
        const baseId = process.env.AIRTABLE_BASE_ID || '';
        const tableName = 'Backup Data';

        if (!apiKey || !baseId) {
            return res.status(500).json({ error: 'Configuration serveur manquante : Clé API ou Base ID' });
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
            console.error(`Erreur liste Airtable (${response.status}):`, errorText);
            return res.status(response.status).json({
                error: 'Erreur Airtable list-backups',
                status: response.status,
                details: errorText
            });
        }

        const data = await response.json();
        // Mapper vers un format plus simple pour le frontend
        const backups = data.records.map(record => ({
            id: record.id,
            date: record.fields['Date'],
            backupId: record.fields['Id du backup']
        }));

        res.json(backups);
    } catch (error) {
        console.error('Erreur proxy liste sauvegardes:', error);
        res.status(500).json({ error: error.message || 'Erreur Interne du Serveur' });
    }
});

// Proxy pour déclencher la restauration (POST)
app.post('/api/trigger-restore', async (req, res) => {
    try {
        const { recordId } = req.body;
        if (!recordId) {
            return res.status(400).json({ error: 'recordId est requis' });
        }

        const webhookUrl = 'https://n8n.srv1189694.hstgr.cloud/webhook/gestion-billetterie-restaure-backup';

        const urlWithParams = `${webhookUrl}?recordId=${recordId}`;

        console.log(`Déclenchement de la restauration pour le RecordID: ${recordId}`);

        const response = await fetch(urlWithParams, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recordId })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Erreur restauration n8n (${response.status}):`, errorText);
            return res.status(response.status).json({
                error: 'Erreur de restauration n8n',
                status: response.status,
                details: errorText
            });
        }

        // IMPORTANT : Effacer le cache des données car la table est en cours de restauration
        dataCache.lastUpdate = 0;

        const result = await response.text();
        res.json({ status: 'success', details: result });
    } catch (error) {
        console.error('Erreur proxy déclenchement restauration:', error);
        res.status(500).json({ error: error.message || 'Erreur Interne du Serveur' });
    }
});

// Proxy pour déclencher la récupération (POST) - double connexion n8n (Fever & Regiondo)
app.post('/api/trigger-recovery', async (req, res) => {
    try {
        const webhookFever = 'https://n8n.srv1189694.hstgr.cloud/webhook/gestion-billetterie-actualiser-donnees-fever';
        const webhookRegiondo = 'https://n8n.srv1189694.hstgr.cloud/webhook/gestion-billetterie-actualiser-donnees-regiondo';

        console.log(`Déclenchement de la récupération double des données via n8n (Fever & Regiondo)...`);

        const [responseFever, responseRegiondo] = await Promise.all([
            fetch(webhookFever, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'recovery', source: 'fever', timestamp: new Date().toISOString() })
            }),
            fetch(webhookRegiondo, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'recovery', source: 'regiondo', timestamp: new Date().toISOString() })
            })
        ]);

        if (!responseFever.ok || !responseRegiondo.ok) {
            console.error(`Erreur récupération n8n : Fever=${responseFever.status}, Regiondo=${responseRegiondo.status}`);
            return res.status(500).json({
                error: 'Erreur récupération n8n',
                details: {
                    fever: responseFever.status,
                    regiondo: responseRegiondo.status
                }
            });
        }

        // Invalider le cache car de nouvelles données sont en cours de récupération
        dataCache.lastUpdate = 0;

        res.json({ status: 'success', details: 'Double récupération déclenchée' });
    } catch (error) {
        console.error('Erreur proxy déclenchement récupération:', error);
        res.status(500).json({ error: error.message || 'Erreur Interne du Serveur' });
    }
});

// Proxy pour enregistrer un instantané (POST)
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
            console.error(`Erreur n8n (${response.status}):`, errorText);
            return res.status(response.status).json({
                error: 'Erreur webhook n8n',
                status: response.status,
                details: errorText
            });
        }

        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error('Erreur proxy enregistrement instantané:', error);
        res.status(500).json({ error: error.message || 'Erreur Interne du Serveur' });
    }
});

// Proxy pour mettre à jour un enregistrement Airtable
app.patch('/api/update-record', async (req, res) => {
    try {
        const { recordId, fieldName, value } = req.body;
        const apiKey = process.env.AIRTABLE_API_KEY || '';
        const baseId = process.env.AIRTABLE_BASE_ID || '';
        const tableName = process.env.AIRTABLE_TABLE_NAME || 'Allocation billetterie';

        console.log(`Demande de mise à jour : Record=${recordId}, Field="${fieldName}", Value=${value}`);

        if (!apiKey || !baseId) {
            console.error('Identifiants Airtable manquants dans les variables d\'environnement');
            return res.status(500).json({ error: 'Configuration serveur manquante : Clé API ou Base ID' });
        }

        const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${recordId}`;

        console.log(`[PATCH PROXY] Envoi vers Airtable : ${url}`);
        console.log(`[PATCH PROXY] Payload :`, JSON.stringify({ fields: { [fieldName]: value } }));

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
            console.error(`[PATCH PROXY] ÉCHEC (${response.status}) :`, JSON.stringify(responseData));
            return res.status(response.status).json({
                error: 'Erreur mise à jour Airtable',
                status: response.status,
                details: responseData
            });
        }

        console.log('[PATCH PROXY] SUCCÈS depuis Airtable :', JSON.stringify(responseData));

        // Effacer le cache principal des données pour que le tableau affiche la nouvelle valeur au prochain rafraîchissement
        dataCache.lastUpdate = 0;

        res.json(responseData);
    } catch (error) {
        console.error('Erreur proxy mise à jour enregistrement:', error);
        res.status(500).json({ error: error.message || 'Erreur Interne du Serveur' });
    }
});

app.use(express.static(path.join(__dirname)));

app.listen(PORT, function () {
    console.log('Serveur démarré sur le port ' + PORT);
});
