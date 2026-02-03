# Tableau de Bord - Ventes Tickets

Un site web pour afficher les données de ventes de tickets depuis Airtable avec des barres de progression.

## 📋 Configuration

### Étape 1: Obtenir vos identifiants Airtable

1. **Créer un Personal Access Token:**
   - Allez sur [https://airtable.com/create/tokens](https://airtable.com/create/tokens)
   - Cliquez sur "Create new token"
   - Donnez un nom au token (ex: "Dashboard Tickets")
   - Dans "Scopes", ajoutez:
     - `data.records:read`
   - Dans "Access", sélectionnez votre base de données
   - Cliquez sur "Create token" et copiez le token

2. **Trouver votre Base ID:**
   - Ouvrez votre base Airtable dans le navigateur
   - L'URL ressemble à: `https://airtable.com/appXXXXXXXXXXXXXX/...`
   - Le Base ID est la partie qui commence par `app` (ex: `appXXXXXXXXXXXXXX`)

3. **Nom de la table:**
   - C'est le nom exact de votre table dans Airtable

### Étape 2: Configurer le fichier config.js

Ouvrez le fichier `config.js` et remplacez les valeurs:

```javascript
const AIRTABLE_CONFIG = {
    API_KEY: 'patXXXXXXXXXXXXXX.XXXX...',  // Votre Personal Access Token
    BASE_ID: 'appXXXXXXXXXXXXXX',           // Votre Base ID
    TABLE_NAME: 'Nom de votre table'         // Le nom exact de la table
};
```

## 🚀 Utilisation

### Option 1: Ouvrir directement (simple)
Double-cliquez sur `index.html` pour ouvrir dans votre navigateur.

**Note:** Certains navigateurs peuvent bloquer les requêtes API en local. Utilisez l'option 2 si cela ne fonctionne pas.

### Option 2: Serveur local (recommandé)

#### Avec Python:
```bash
# Python 3
python -m http.server 8000

# Puis ouvrez http://localhost:8000
```

#### Avec Node.js:
```bash
npx serve .

# Puis ouvrez l'URL affichée
```

#### Avec VS Code:
Installez l'extension "Live Server" et cliquez sur "Go Live" en bas à droite.

## 📊 Colonnes affichées

Le tableau affiche les colonnes suivantes depuis Airtable:

### Informations principales
- Date
- Ville

### Catégorie Or 🥇
- Ventes - Fever - Or
- Quota - Fever - Or
- Ventes - Regiondo - Or
- Quota - Regiondo - Or
- Ventes - OT - Or
- Quota - OT - Or
- Total - Ventes - Or
- Total - Quota - Or
- Delta - Or

### Catégorie Platinium 💎
- Ventes - Fever - Platinium
- Quota - Fever - Platinium
- Ventes - Regiondo - Platinium
- Quota - Regiondo - Platinium
- Ventes - OT - Platinium
- Quota - OT - Platinium
- Total - Ventes - Platinium
- Total - Quota - Platinium
- Delta - Platinium

### Catégorie Argent 🥈
- Ventes - Fever - Argent
- Quota - Fever - Argent
- Ventes - Regiondo - Argent
- Quota - Regiondo - Argent
- Ventes - OT - Argent
- Quota - OT - Argent
- Total - Ventes - Argent
- Total - Quota - Argent
- Delta - Argent

### Totaux généraux 📈
- Total - Ventes - Fever
- Total - Ventes - Fever (%)
- Total - Ventes - Regiondo
- Total - Ventes - Regiondo (%)
- Total - Ventes - OT
- Total - Ventes - OT (%)
- Total - Ventes
- Total - Quota
- Total - Delta
- Statut

## ✨ Fonctionnalités

- ✅ Affichage des données en temps réel depuis Airtable
- ✅ Barres de progression pour les ventes vs quotas
- ✅ Filtrage par ville et statut
- ✅ Cartes récapitulatives avec totaux
- ✅ Mise en forme colorée par catégorie (Or, Platinium, Argent)
- ✅ Indicateurs visuels pour les deltas positifs/négatifs
- ✅ Badges de statut (Atteint, En cours, Non atteint)
- ✅ Bouton d'actualisation manuelle
- ✅ Design responsive

## 🔧 Personnalisation

### Modifier les colonnes
Éditez la liste `COLUMNS_ORDER` dans `config.js` pour ajouter, supprimer ou réordonner les colonnes.

### Modifier les styles
Éditez `styles.css` pour personnaliser les couleurs et le design.

## ❓ Dépannage

**"Erreur de chargement des données"**
- Vérifiez que votre token API est valide
- Vérifiez que le Base ID est correct
- Vérifiez que le nom de la table est exact (sensible à la casse)
- Vérifiez que votre token a accès à cette base

**Problème CORS**
- Utilisez un serveur local (voir Option 2 ci-dessus)
- Ou utilisez un navigateur avec les restrictions CORS désactivées (non recommandé en production)
