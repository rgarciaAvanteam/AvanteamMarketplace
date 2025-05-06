/**
 * marketplace-core.js - Module principal du Marketplace
 * Contient les variables globales, l'initialisation et les configurations de base
 */

/**
 * Gestionnaire central de configuration pour éviter les problèmes de scope et timing
 */
const ConfigManager = (function() {
    // Valeurs par défaut
    const defaults = {
        apiUrl: '',
        apiKey: '',
        clientId: '',
        platformVersion: ''
    };
    
    // Sauvegarde locale des valeurs
    let currentValues = { ...defaults };
    
    /**
     * Initialise le gestionnaire de configuration avec les valeurs disponibles
     */
    function initialize() {
        // 1. Essayer de récupérer depuis window (priorité haute)
        if (typeof window.apiUrl !== 'undefined') currentValues.apiUrl = window.apiUrl;
        if (typeof window.apiKey !== 'undefined') currentValues.apiKey = window.apiKey;
        if (typeof window.clientId !== 'undefined') currentValues.clientId = window.clientId;
        if (typeof window.platformVersion !== 'undefined') currentValues.platformVersion = window.platformVersion;
        
        // 2. Essayer de récupérer depuis les variables globales
        if (typeof apiUrl !== 'undefined' && apiUrl) currentValues.apiUrl = apiUrl;
        if (typeof apiKey !== 'undefined' && apiKey) currentValues.apiKey = apiKey;
        if (typeof clientId !== 'undefined' && clientId) currentValues.clientId = clientId;
        if (typeof platformVersion !== 'undefined' && platformVersion) currentValues.platformVersion = platformVersion;
        
        // 3. Récupérer depuis localStorage (pour persistance iframe)
        try {
            if (window.localStorage) {
                const lsApiUrl = localStorage.getItem('marketplace_apiUrl');
                const lsApiKey = localStorage.getItem('marketplace_apiKey');
                const lsClientId = localStorage.getItem('marketplace_clientId');
                const lsPlatformVersion = localStorage.getItem('marketplace_platformVersion');
                
                if (lsApiUrl) currentValues.apiUrl = lsApiUrl;
                if (lsApiKey) currentValues.apiKey = lsApiKey;
                if (lsClientId) currentValues.clientId = lsClientId;
                if (lsPlatformVersion) currentValues.platformVersion = lsPlatformVersion;
            }
        } catch (e) {
            // Erreur silencieuse
        }
        
        // 4. Récupérer depuis les champs cachés
        try {
            const apiUrlField = document.getElementById('hfApiUrl');
            const apiKeyField = document.getElementById('hfApiKey');
            const clientIdField = document.getElementById('hfClientId');
            const platformVersionField = document.getElementById('hfPlatformVersion');
            
            if (apiUrlField && apiUrlField.value) currentValues.apiUrl = apiUrlField.value;
            if (apiKeyField && apiKeyField.value) currentValues.apiKey = apiKeyField.value;
            if (clientIdField && clientIdField.value) currentValues.clientId = clientIdField.value;
            if (platformVersionField && platformVersionField.value) currentValues.platformVersion = platformVersionField.value;
        } catch (e) {
            // Erreur silencieuse
        }
        
        // 5. Sauvegarder dans window pour accessibilité globale
        window.apiUrl = currentValues.apiUrl;
        window.apiKey = currentValues.apiKey;
        window.clientId = currentValues.clientId;
        window.platformVersion = currentValues.platformVersion;
        
        // 6. Sauvegarder dans localStorage pour persistance entre rechargements
        try {
            if (window.localStorage && currentValues.apiUrl && currentValues.apiKey) {
                localStorage.setItem('marketplace_apiUrl', currentValues.apiUrl);
                localStorage.setItem('marketplace_apiKey', currentValues.apiKey);
                localStorage.setItem('marketplace_clientId', currentValues.clientId);
                localStorage.setItem('marketplace_platformVersion', currentValues.platformVersion);
                localStorage.setItem('marketplace_configTimestamp', new Date().getTime());
            }
        } catch (e) {
            // Erreur silencieuse
        }
        
        // 7. Tenter de récupérer depuis l'iframe parent (dernier recours)
        if (!currentValues.apiUrl || !currentValues.apiKey) {
            try {
                if (window.parent && window.parent !== window) {
                    if (window.parent.apiUrl) currentValues.apiUrl = window.parent.apiUrl;
                    if (window.parent.apiKey) currentValues.apiKey = window.parent.apiKey;
                    if (window.parent.clientId) currentValues.clientId = window.parent.clientId;
                    if (window.parent.platformVersion) currentValues.platformVersion = window.parent.platformVersion;
                }
            } catch (e) {
                // Erreur silencieuse - accès cross-origin limité
            }
        }
    }
    
    /**
     * Obtient une valeur de configuration
     * @param {string} key - Clé de configuration (apiUrl, apiKey, etc.)
     * @returns {string} - Valeur de configuration
     */
    function getValue(key) {
        // Si la valeur n'est pas dans currentValues, essayer de la récupérer à nouveau
        if (!currentValues[key] || key === 'platformVersion') {
            initialize();
        }
        
        // Si platformVersion est toujours vide, essayer d'autres sources
        if (key === 'platformVersion' && !currentValues[key]) {
            // Essayer de lire directement depuis l'élément d'affichage de version s'il existe
            const versionDisplay = document.querySelector('.marketplace-version .version-value');
            if (versionDisplay && versionDisplay.textContent.trim()) {
                console.log("Récupération de platformVersion depuis l'élément d'affichage dans le DOM");
                currentValues[key] = versionDisplay.textContent.trim();
            }
        }
        
        return currentValues[key];
    }
    
    // Getters spécifiques
    function getApiUrl() { return getValue('apiUrl'); }
    function getApiKey() { return getValue('apiKey'); }
    function getClientId() { return getValue('clientId'); }
    function getPlatformVersion() { return getValue('platformVersion'); }
    
    // API publique du module
    return {
        initialize,
        getApiUrl,
        getApiKey,
        getClientId,
        getPlatformVersion
    };
})();

// URL de l'API locale d'installation (.NET Core 6.0)
const localApiUrl = '/api-installer/';

// Cache des composants chargés (exposé à window pour accès global)
window.componentCache = {
    compatible: null,
    updates: null,
    future: null
};
const componentCache = window.componentCache;

// Durée de validité du cache pour éviter les requêtes répétées
const cacheValidityDuration = 30 * 60 * 1000; // 30 minutes en millisecondes

// Stockage des temps de mise en cache
const componentCacheTime = {
    compatible: 0,
    updates: 0,
    future: 0
};

// Filtre de recherche courant
let currentFilter = '';

/**
 * Initialise l'interface avec le support des versions installées
 * Fonction appelée une fois que tous les modules sont chargés
 */
function initVersionsDisplay() {
    // Ajouter un élément de style pour le bouton GitHub s'il n'existe pas
    if (!document.getElementById('github-button-style')) {
        const style = document.createElement('style');
        style.id = 'github-button-style';
        style.innerHTML = `
            .btn-github {
                background-color: #24292e;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            .btn-github:hover {
                background-color: #1b1f23;
                color: white;
                text-decoration: none;
            }
            .component-update-badge {
                display: inline-block;
                background-color: #ffc107;
                color: #212529;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 0.75rem;
                margin-left: 8px;
                font-weight: bold;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Rafraîchit toutes les listes de composants
 * Utile après une authentification ou un changement d'état majeur
 */
function refreshComponentLists() {
    console.log("Rafraîchissement des listes de composants");
    
    // Réinitialiser le cache pour forcer le rechargement complet
    for (const category in componentCacheTime) {
        componentCacheTime[category] = 0;
    }
    
    // Récupérer l'onglet actif
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
        const tabId = activeTab.id;
        const tabName = tabId.replace('-tab', '');
        console.log(`Onglet actif: ${tabName}`)
        
        // Forcer le chargement de l'onglet actif
        loadTabContent(tabName);
    } else {
        // Fallback - charger l'onglet compatible par défaut
        loadTabContent('compatible');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialiser le gestionnaire de configuration
    ConfigManager.initialize();
    
    // Initialiser la gestion des onglets
    setupTabs();
    
    // Initialiser la recherche
    setupSearch();
    
    // Initialiser l'affichage des versions
    initVersionsDisplay();
    
    // Initialiser l'authentification si disponible
    if (typeof MarketplaceAuth !== 'undefined') {
        MarketplaceAuth.init(ConfigManager.getApiUrl());
    }
    
    // Charger les composants pour l'onglet actif (avec délai pour s'assurer que tout est prêt)
    setTimeout(() => {
        loadTabContent('compatible');
    }, 100);
});