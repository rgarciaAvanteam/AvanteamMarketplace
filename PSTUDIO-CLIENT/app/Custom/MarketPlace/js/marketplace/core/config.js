/**
 * config.js - Gestion centralisée de la configuration du Marketplace
 * 
 * Ce module gère toutes les configurations nécessaires au fonctionnement du Marketplace,
 * en centralisant l'accès et en assurant la persistance des valeurs.
 */

MarketplaceMediator.defineModule('config', ['utils'], function(utils) {
    // Valeurs par défaut
    const defaults = {
        apiUrl: '',
        apiKey: '',
        clientId: '',
        platformVersion: '',
        localApiUrl: '/api-installer/'
    };
    
    // Sauvegarde locale des valeurs
    let config = { ...defaults };
    
    /**
     * Initialise la configuration avec les valeurs disponibles
     */
    function init() {
        console.log("Initialisation de la configuration...");
        console.log("URL actuelle:", window.location.href);
        
        // 1. Essayer de récupérer depuis localStorage (persistance)
        try {
            const storedConfig = utils.getFromStorage('marketplace_config', null);
            if (storedConfig) {
                Object.assign(config, storedConfig);
                console.log("Config depuis localStorage:", storedConfig);
            }
        } catch (e) {
            console.warn("Erreur lors de la récupération de la configuration depuis localStorage", e);
        }
        
        // 2. Essayer de récupérer depuis window (priorité haute)
        if (typeof window.apiUrl !== 'undefined') config.apiUrl = window.apiUrl;
        if (typeof window.apiKey !== 'undefined') config.apiKey = window.apiKey;
        if (typeof window.clientId !== 'undefined') config.clientId = window.clientId;
        if (typeof window.platformVersion !== 'undefined') config.platformVersion = window.platformVersion;
        
        // 3. Essayer de récupérer depuis les variables globales
        if (typeof apiUrl !== 'undefined' && apiUrl) config.apiUrl = apiUrl;
        if (typeof apiKey !== 'undefined' && apiKey) config.apiKey = apiKey;
        if (typeof clientId !== 'undefined' && clientId) config.clientId = clientId;
        if (typeof platformVersion !== 'undefined' && platformVersion) config.platformVersion = platformVersion;
        
        // 4. Récupérer depuis les champs cachés
        try {
            const apiUrlField = document.getElementById('hfApiUrl');
            const apiKeyField = document.getElementById('hfApiKey');
            const clientIdField = document.getElementById('hfClientId');
            const platformVersionField = document.getElementById('hfPlatformVersion');
            
            if (apiUrlField && apiUrlField.value) config.apiUrl = apiUrlField.value;
            if (apiKeyField && apiKeyField.value) config.apiKey = apiKeyField.value;
            if (clientIdField && clientIdField.value) config.clientId = clientIdField.value;
            if (platformVersionField && platformVersionField.value) config.platformVersion = platformVersionField.value;
        } catch (e) {
            console.warn("Erreur lors de la récupération de la configuration depuis les champs cachés", e);
        }
        
        // 5. Vérifier l'élément d'affichage de version s'il existe
        if (!config.platformVersion) {
            try {
                const versionDisplay = document.querySelector('.marketplace-version .version-value');
                if (versionDisplay && versionDisplay.textContent.trim()) {
                    config.platformVersion = versionDisplay.textContent.trim();
                }
            } catch (e) {
                console.warn("Erreur lors de la récupération de la version depuis l'affichage", e);
            }
        }
        
        // 6. Tenter de récupérer depuis le fichier version.txt
        if (!config.platformVersion || config.platformVersion.trim() === '') {
            console.log("Tentative de récupération de la version depuis version.txt");
            try {
                // Utiliser une requête AJAX pour lire le fichier version.txt en relatif
                const xhr = new XMLHttpRequest();
                
                // Construire un chemin relatif vers le fichier version.txt au niveau app
                // Depuis Custom/MarketPlace, nous devons remonter de deux niveaux (../../version.txt)
                xhr.open('GET', '../../version.txt', false); // Synchrone pour simplicité
                
                // Demander une réponse de type ArrayBuffer pour traiter les différents encodages
                xhr.responseType = 'arraybuffer';
                xhr.send(null);
                
                if (xhr.status === 200) {
                    // Vérifier le contenu du fichier (peut être en UTF-16LE, UTF-8, etc.)
                    const buffer = xhr.response;
                    console.log("Taille du fichier version.txt:", buffer.byteLength, "octets");
                    
                    // Détecter l'encodage en vérifiant le BOM
                    let version = '';
                    const dataView = new DataView(buffer);
                    
                    // UTF-16LE BOM: FF FE
                    if (buffer.byteLength >= 2 && dataView.getUint8(0) === 0xFF && dataView.getUint8(1) === 0xFE) {
                        console.log("Détection d'encodage UTF-16LE");
                        // Décoder en UTF-16LE (Windows standard)
                        const utf16leArray = new Uint16Array(buffer, 2); // Ignorer le BOM
                        version = String.fromCharCode.apply(null, utf16leArray);
                    } else {
                        // Supposer UTF-8 ou autre encodage standard
                        console.log("Pas de BOM UTF-16 détecté, décodage en UTF-8");
                        version = new TextDecoder().decode(buffer);
                    }
                    
                    console.log("Contenu brut de version.txt:", version);
                    
                    // Supprimer tous les caractères non visibles sauf les chiffres et le point
                    version = version.replace(/[^\d\.vV]/g, '');
                    
                    // Enlever le "v" ou "V" au début s'il existe
                    if (version.match(/^[vV]/)) {
                        version = version.substring(1);
                    }
                    
                    console.log("Version après nettoyage:", version);
                    
                    // Vérifier qu'il s'agit bien d'un format de version (chiffres et points)
                    if (/^\d+(\.\d+)*$/.test(version)) {
                        console.log("Version récupérée depuis version.txt:", version);
                        config.platformVersion = version;
                    } else {
                        console.warn("Format de version invalide dans version.txt:", version);
                    }
                } else {
                    console.warn("Fichier version.txt non trouvé (statut", xhr.status, ")");
                }
            } catch (e) {
                console.warn("Erreur lors de la lecture du fichier version.txt:", e);
            }
        }
        
        // 7. Tenter de récupérer depuis l'iframe parent (dernier recours)
        if (!config.apiUrl || !config.apiKey || !config.platformVersion) {
            try {
                if (window.parent && window.parent !== window) {
                    console.log("Tentative de récupération depuis l'iframe parent");
                    if (window.parent.apiUrl) config.apiUrl = window.parent.apiUrl;
                    if (window.parent.apiKey) config.apiKey = window.parent.apiKey;
                    if (window.parent.clientId) config.clientId = window.parent.clientId;
                    if (window.parent.platformVersion) config.platformVersion = window.parent.platformVersion;
                }
            } catch (e) {
                console.warn("Erreur lors de la récupération de la configuration depuis le parent", e);
            }
        }
        
        // 8. Valeur fallback pour platformVersion si toujours non définie
        if (!config.platformVersion || config.platformVersion.trim() === '') {
            console.warn("Version de plateforme non trouvée, utilisation de la valeur par défaut");
            config.platformVersion = "23.10.0"; // Valeur par défaut
        }
        
        // 8. Sauvegarder dans localStorage pour persistance entre rechargements
        saveConfig();
        
        // 9. Publier un événement pour notifier que la configuration est prête
        MarketplaceMediator.publish('configReady', { ...config });
        
        console.log("Configuration initialisée:", config);
    }
    
    /**
     * Sauvegarde la configuration dans localStorage
     */
    function saveConfig() {
        try {
            utils.saveToStorage('marketplace_config', config);
            utils.saveToStorage('marketplace_configTimestamp', new Date().getTime());
        } catch (e) {
            console.warn("Erreur lors de la sauvegarde de la configuration", e);
        }
    }
    
    /**
     * Définit une valeur de configuration
     * @param {string} key - Clé de configuration
     * @param {any} value - Valeur à définir
     */
    function set(key, value) {
        config[key] = value;
        saveConfig();
        MarketplaceMediator.publish('configUpdated', { key, value, config: { ...config } });
    }
    
    /**
     * Obtient une valeur de configuration
     * @param {string} key - Clé de configuration
     * @returns {any} - Valeur de configuration
     */
    function get(key) {
        return config[key];
    }
    
    /**
     * Obtient toute la configuration
     * @returns {Object} - Configuration complète
     */
    function getAll() {
        return { ...config };
    }
    
    // Getters spécifiques pour les valeurs les plus utilisées
    function getApiUrl() { return get('apiUrl'); }
    function getApiKey() { 
        // Récupérer la clé API de la configuration
        const apiKey = get('apiKey');
        
        if (!apiKey || apiKey.trim() === '') {
            console.warn("Clé API non configurée ou vide");
        }
        
        return apiKey; 
    }
    function getClientId() { return get('clientId'); }
    function getPlatformVersion() { return get('platformVersion'); }
    function getLocalApiUrl() { return get('localApiUrl'); }
    
    // API publique du module
    return {
        init,
        set,
        get,
        getAll,
        getApiUrl,
        getApiKey,
        getClientId,
        getPlatformVersion,
        getLocalApiUrl
    };
});