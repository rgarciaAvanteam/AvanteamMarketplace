/**
 * components.js - Module de gestion des composants du Marketplace
 * 
 * Gère l'affichage, le filtrage et les actions sur les composants du Marketplace.
 */

MarketplaceMediator.defineModule('components', ['config', 'utils', 'auth'], function(config, utils, auth) {
    // Cache des composants par onglet
    let componentsCache = {
        compatible: [],
        updates: [],
        future: []
    };
    
    // Composants filtrés par onglet
    let filteredComponents = {
        compatible: [],
        updates: [],
        future: []
    };
    
    // Version de la plateforme (utilisée pour les comparaisons de compatibilité)
    let platformVersion = '';
    
    // Configuration du cache
    const CACHE_CONFIG = {
        // Durée de validité du cache en millisecondes
        defaultValidityDuration: 30 * 60 * 1000, // 30 minutes par défaut
        // Préfixe pour les clés de stockage
        keyPrefix: 'marketplace_components_',
        // Suffixe pour les timestamps
        timestampSuffix: '_timestamp'
    };
    
    /**
     * Système de gestion de cache centralisé
     */
    const cacheManager = {
        /**
         * Vérifie si des données en cache sont disponibles et valides pour une clé donnée
         * @param {string} cacheKey - Clé de cache
         * @param {number} [validityDuration] - Durée de validité en millisecondes (optionnel)
         * @returns {boolean} - true si le cache est valide, false sinon
         */
        isValid(cacheKey, validityDuration) {
            const duration = validityDuration || CACHE_CONFIG.defaultValidityDuration;
            const timestampKey = `${CACHE_CONFIG.keyPrefix}${cacheKey}${CACHE_CONFIG.timestampSuffix}`;
            const timestamp = utils.getFromStorage(timestampKey, 0);
            
            return (Date.now() - timestamp) < duration;
        },
        
        /**
         * Récupère des données depuis le cache
         * @param {string} cacheKey - Clé de cache
         * @param {Object} options - Options
         * @param {boolean} [options.checkValidity=true] - Vérifier si le cache est valide
         * @param {number} [options.validityDuration] - Durée de validité personnalisée
         * @param {*} [options.defaultValue=[]] - Valeur par défaut si le cache est invalide/inexistant
         * @returns {*} - Données du cache ou valeur par défaut
         */
        get(cacheKey, options = {}) {
            const opts = {
                checkValidity: true,
                validityDuration: CACHE_CONFIG.defaultValidityDuration,
                defaultValue: [],
                ...options
            };
            
            // Si le cache doit être vérifié et qu'il n'est pas valide, retourner la valeur par défaut
            if (opts.checkValidity && !this.isValid(cacheKey, opts.validityDuration)) {
                return opts.defaultValue;
            }
            
            // Pour les composants, vérifier d'abord dans le cache en mémoire
            if (cacheKey in componentsCache && componentsCache[cacheKey].length > 0) {
                return componentsCache[cacheKey];
            }
            
            // Sinon, retourner la valeur par défaut
            return opts.defaultValue;
        },
        
        /**
         * Stocke des données dans le cache
         * @param {string} cacheKey - Clé de cache
         * @param {*} data - Données à stocker
         * @param {Object} options - Options
         * @param {boolean} [options.updateTimestamp=true] - Mettre à jour le timestamp
         * @param {boolean} [options.updateMemoryCache=true] - Mettre à jour le cache en mémoire
         * @param {boolean} [options.updateFilteredCache=true] - Mettre à jour le cache filtré
         */
        set(cacheKey, data, options = {}) {
            const opts = {
                updateTimestamp: true,
                updateMemoryCache: true,
                updateFilteredCache: true,
                ...options
            };
            
            // Mettre à jour le timestamp si demandé
            if (opts.updateTimestamp) {
                const timestampKey = `${CACHE_CONFIG.keyPrefix}${cacheKey}${CACHE_CONFIG.timestampSuffix}`;
                utils.saveToStorage(timestampKey, Date.now());
            }
            
            // Mettre à jour le cache en mémoire si demandé et si c'est une clé valide
            if (opts.updateMemoryCache && cacheKey in componentsCache) {
                componentsCache[cacheKey] = Array.isArray(data) ? [...data] : data;
            }
            
            // Mettre à jour également le cache filtré si demandé
            if (opts.updateFilteredCache && cacheKey in filteredComponents) {
                filteredComponents[cacheKey] = Array.isArray(data) ? [...data] : data;
            }
        },
        
        /**
         * Invalide une entrée de cache spécifique
         * @param {string} cacheKey - Clé de cache à invalider
         * @param {boolean} [clearMemoryCache=true] - Effacer aussi le cache en mémoire
         */
        invalidate(cacheKey, clearMemoryCache = true) {
            const timestampKey = `${CACHE_CONFIG.keyPrefix}${cacheKey}${CACHE_CONFIG.timestampSuffix}`;
            
            // Mettre le timestamp à 0 pour invalider le cache
            utils.saveToStorage(timestampKey, 0);
            
            // Vider le cache en mémoire si demandé
            if (clearMemoryCache && cacheKey in componentsCache) {
                componentsCache[cacheKey] = [];
                
                // Vider également le cache filtré
                if (cacheKey in filteredComponents) {
                    filteredComponents[cacheKey] = [];
                }
            }
        },
        
        /**
         * Invalide toutes les entrées de cache
         * @param {boolean} [clearMemoryCache=true] - Effacer aussi le cache en mémoire
         */
        invalidateAll(clearMemoryCache = true) {
            // Invalider chaque cache
            for (const tabName in componentsCache) {
                this.invalidate(tabName, clearMemoryCache);
            }
        }
    };
    
    /**
     * Fonction utilitaire centralisée pour effectuer des requêtes API
     * @param {string} endpoint - Point de terminaison de l'API (sans l'URL de base)
     * @param {Object} options - Options de la requête
     * @param {string} options.method - Méthode HTTP (GET, POST, etc.)
     * @param {Object} options.headers - En-têtes HTTP supplémentaires
     * @param {Object} options.body - Corps de la requête (pour POST, PUT, etc.)
     * @param {number} options.timeout - Délai d'expiration en millisecondes
     * @param {string} options.context - Contexte de la requête (pour les événements)
     * @param {Object} options.defaultErrorResponse - Réponse par défaut en cas d'erreur
     * @param {boolean} options.returnRawResponse - Si true, retourne l'objet response avant parsing JSON
     * @returns {Promise<Object>} - Promesse résolue avec les données de la réponse
     */
    function apiRequest(endpoint, options = {}) {
        const apiUrl = config.getApiUrl();
        
        if (!apiUrl) {
            const error = new Error("URL API non configurée");
            
            // Publier un événement pour informer d'autres modules
            MarketplaceMediator.publish('apiConfigError', {
                message: error.message,
                context: options.context || 'apiRequest'
            });
            
            return Promise.reject(error);
        }
        
        // Construire l'URL complète
        const url = endpoint.startsWith('http') ? endpoint : `${apiUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
        
        // Préparer les en-têtes avec authentification
        const defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        const headers = prepareAuthHeaders({ ...defaultHeaders, ...options.headers });
        
        // Configuration du timeout
        const timeout = options.timeout || 15000; // 15 secondes par défaut
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        // Préparer les options de fetch
        const fetchOptions = {
            method: options.method || 'GET',
            headers: headers,
            signal: controller.signal
        };
        
        // Ajouter le corps de la requête si nécessaire
        if (options.body && ['POST', 'PUT', 'PATCH'].includes(fetchOptions.method)) {
            fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        }
        
        // Publier un événement de début de requête si un contexte est fourni
        if (options.context) {
            MarketplaceMediator.publish('apiRequestStarted', {
                context: options.context,
                url: url
            });
        }
        
        // Effectuer la requête
        return fetch(url, fetchOptions)
            .then(response => {
                // Annuler le timeout
                clearTimeout(timeoutId);
                
                // Si demandé, retourner la réponse brute
                if (options.returnRawResponse) {
                    return response;
                }
                
                // Gérer les erreurs d'authentification (401, 403)
                if (response.status === 401 || response.status === 403) {
                    console.warn("Erreur d'authentification API - Le token du site client n'est pas valide ou a expiré");
                    
                    // Publier un événement d'authentification échouée
                    MarketplaceMediator.publish('apiAuthenticationError', {
                        status: response.status,
                        message: "Erreur d'authentification API - Le token du site client n'est pas valide ou a expiré",
                        context: options.context
                    });
                    
                    // Utiliser le module auth pour afficher une notification si ce n'est pas déjà fait
                    if (auth && auth.showNotification) {
                        auth.showNotification("Problème d'authentification avec l'API Marketplace. Veuillez contacter votre administrateur.", "warning");
                    }
                    
                    // Retourner une réponse par défaut si fournie
                    if (options.defaultErrorResponse) {
                        return options.defaultErrorResponse;
                    }
                    
                    // Sinon, propager l'erreur
                    const error = new Error(`Erreur d'authentification: ${response.status}`);
                    error.statusCode = response.status;
                    throw error;
                }
                
                // Gérer les erreurs 404 (resource non trouvée)
                if (response.status === 404) {
                    console.warn(`Resource non trouvée: ${url}`);
                    
                    // Publier un événement de ressource non trouvée
                    if (options.context) {
                        MarketplaceMediator.publish('apiResourceNotFound', {
                            status: response.status,
                            context: options.context,
                            url: url
                        });
                    }
                    
                    // Retourner une réponse par défaut si fournie
                    if (options.defaultErrorResponse) {
                        return options.defaultErrorResponse;
                    }
                    
                    // Sinon, propager l'erreur
                    const error = new Error(`Ressource non trouvée: ${url}`);
                    error.statusCode = response.status;
                    throw error;
                }
                
                // Gérer les erreurs serveur (5xx)
                if (response.status >= 500) {
                    console.error(`Erreur serveur (${response.status}) lors de la requête: ${url}`);
                    
                    // Publier un événement d'erreur serveur
                    MarketplaceMediator.publish('apiServerError', {
                        status: response.status,
                        message: `Erreur serveur API - Le serveur a répondu avec l'erreur ${response.status}`,
                        context: options.context
                    });
                    
                    // Afficher une notification si possible
                    if (auth && auth.showNotification) {
                        auth.showNotification("Le serveur Marketplace est momentanément indisponible. Veuillez réessayer plus tard.", "error");
                    }
                    
                    // Retourner une réponse par défaut si fournie
                    if (options.defaultErrorResponse) {
                        return options.defaultErrorResponse;
                    }
                    
                    // Sinon, propager l'erreur
                    const error = new Error(`Erreur serveur: ${response.status}`);
                    error.statusCode = response.status;
                    throw error;
                }
                
                // Gérer les autres erreurs HTTP
                if (!response.ok) {
                    console.error(`Erreur HTTP (${response.status}) lors de la requête: ${url}`);
                    
                    // Publier un événement d'erreur API
                    MarketplaceMediator.publish('apiError', {
                        status: response.status,
                        message: `Erreur API - Le serveur a répondu avec l'erreur ${response.status}`,
                        context: options.context
                    });
                    
                    // Retourner une réponse par défaut si fournie
                    if (options.defaultErrorResponse) {
                        return options.defaultErrorResponse;
                    }
                    
                    // Sinon, propager l'erreur
                    const error = new Error(`Erreur HTTP: ${response.status}`);
                    error.statusCode = response.status;
                    throw error;
                }
                
                // Traiter la réponse JSON
                return response.json().catch(e => {
                    console.warn("Erreur lors du parsing JSON de la réponse:", e);
                    return {}; // Retourner un objet vide en cas d'erreur de parsing
                });
            })
            .then(data => {
                // Publier un événement de fin de requête si un contexte est fourni
                if (options.context) {
                    MarketplaceMediator.publish('apiRequestCompleted', {
                        context: options.context,
                        success: true
                    });
                }
                
                return data;
            })
            .catch(error => {
                // Annuler le timeout au cas où
                clearTimeout(timeoutId);
                
                console.error(`Erreur lors de la requête API vers ${url}:`, error);
                
                // Publier un événement d'erreur générique
                MarketplaceMediator.publish('apiRequestError', {
                    context: options.context,
                    error: error.message,
                    statusCode: error.statusCode || 'network'
                });
                
                // Si c'est une erreur d'expiration de délai, afficher une notification spécifique
                if (error.name === 'AbortError') {
                    if (auth && auth.showNotification) {
                        auth.showNotification("Le temps de réponse de l'API est trop long. Veuillez réessayer plus tard.", "error");
                    }
                }
                
                // Retourner une réponse par défaut si fournie
                if (options.defaultErrorResponse) {
                    return options.defaultErrorResponse;
                }
                
                // Sinon, propager l'erreur
                throw error;
            });
    }
    
    /**
     * Initialise le module des composants
     */
    function init() {
        console.log("Initialisation du module des composants");
        
        platformVersion = config.getPlatformVersion();
        console.log("Version de plateforme récupérée:", platformVersion);
        
        // S'abonner aux événements pertinents et à la mise à jour de la configuration
        MarketplaceMediator.subscribe('authStateChanged', onAuthStateChanged);
        MarketplaceMediator.subscribe('filtersChanged', onFiltersChanged);
        MarketplaceMediator.subscribe('searchPerformed', onSearchPerformed);
        MarketplaceMediator.subscribe('configUpdated', onConfigUpdated);
        
        // Vérifier la validité du token API
        checkApiConnection();
        
        // Initialiser un événement pour indiquer que le module est prêt
        MarketplaceMediator.publish('componentsModuleReady', {});
    }
    
    /**
     * Vérifie la validité de la connexion à l'API
     */
    function checkApiConnection() {
        // S'assurer que platformVersion est bien défini et correctement formaté
        if (!platformVersion || platformVersion.trim() === '') {
            console.warn("Version de plateforme non définie, tentative de récupération...");
            platformVersion = config.getPlatformVersion();
            
            if (!platformVersion || platformVersion.trim() === '') {
                console.warn("Impossible de récupérer la version de la plateforme, utilisation de la valeur par défaut");
                platformVersion = "23.10.0"; // Valeur par défaut
            }
        }
        
        // Nettoyer la version pour éviter les caractères problématiques
        const cleanVersion = platformVersion.trim().replace(/\s+/g, '');
        
        // Construire le paramètre de requête
        const clientId = config.getClientId() || '';
        const endpoint = `/components/compatible?version=${encodeURIComponent(cleanVersion)}&clientId=${encodeURIComponent(clientId)}&limit=1`;
        
        // Utiliser apiRequest pour effectuer la vérification
        apiRequest(endpoint, {
            method: 'GET',
            timeout: 10000, // 10 secondes
            context: 'checkApiConnection',
            returnRawResponse: true // On veut juste vérifier le statut, pas parser le JSON
        })
        .then(response => {
            if (response.ok) {
                console.log("Connexion à l'API Marketplace établie avec succès");
                // Publier un événement pour notifier d'autres modules
                MarketplaceMediator.publish('apiConnectionSuccessful', {
                    message: "Connexion à l'API Marketplace établie avec succès"
                });
            }
            return response;
        })
        .catch(error => {
            // Les erreurs sont déjà gérées dans apiRequest, mais nous pouvons ajouter une logique supplémentaire si nécessaire
            console.warn("Erreur de connexion gérée:", error.message);
        });
    }
    
    /**
     * Gère les changements d'état d'authentification
     * @param {Object} authState - Nouvel état d'authentification
     */
    function onAuthStateChanged(authState) {
        // Recharger les composants si l'état d'authentification a changé
        // car l'API peut renvoyer des informations différentes selon l'authentification
        refreshAllComponents();
    }
    
    /**
     * Gère les changements de filtres
     * @param {Object} filters - Filtres actifs
     */
    function onFiltersChanged(filters) {
        applyFilters(filters);
    }
    
    /**
     * Gère les recherches
     * @param {string} searchTerm - Terme de recherche
     */
    function onSearchPerformed(searchTerm) {
        applySearch(searchTerm);
    }
    
    /**
     * Gère les mises à jour de configuration
     * @param {Object} data - Données mises à jour
     */
    function onConfigUpdated(data) {
        console.log("Mise à jour de la configuration détectée:", data);
        
        // Si la version de la plateforme a changé, la mettre à jour
        if (data.key === 'platformVersion' && data.value !== platformVersion) {
            console.log(`Version de plateforme mise à jour: ${platformVersion} -> ${data.value}`);
            platformVersion = data.value;
            
            // Rafraîchir les composants pour tenir compte de la nouvelle version
            refreshAllComponents();
        }
    }
    
    /**
     * Charge les composants pour un onglet spécifique
     * @param {string} tabName - Nom de l'onglet (compatible, updates, future)
     * @returns {Promise<Array>} - Promesse résolue avec les composants chargés
     */
    function loadComponents(tabName) {
        console.log(`Chargement des composants pour l'onglet ${tabName}`);
        
        // Vérifier si des données en cache sont disponibles et valides
        const cachedComponents = cacheManager.get(tabName);
        
        if (cachedComponents && cachedComponents.length > 0) {
            console.log(`Utilisation du cache pour l'onglet ${tabName}`);
            
            // Notifier que les composants sont chargés
            MarketplaceMediator.publish('componentsLoaded', {
                tabName,
                components: cachedComponents,
                fromCache: true
            });
            
            return Promise.resolve(cachedComponents);
        }
        
        // S'assurer que platformVersion est bien défini
        if (!platformVersion || platformVersion.trim() === '') {
            console.warn("Version de plateforme non définie, tentative de récupération...");
            platformVersion = config.getPlatformVersion();
            
            if (!platformVersion || platformVersion.trim() === '') {
                console.warn("Impossible de récupérer la version de plateforme, utilisation de la valeur par défaut");
                platformVersion = "23.10.0"; // Valeur par défaut
            }
        }
        
        // Nettoyer la version pour éviter les espaces ou caractères problématiques
        const cleanVersion = platformVersion.trim().replace(/\s+/g, '');
        console.log(`Chargement des composants ${tabName} avec platformVersion=${cleanVersion}`);
        
        // Construire l'endpoint selon l'onglet
        const clientId = config.getClientId() || '';
        let endpoint = '';
        
        switch (tabName) {
            case 'compatible':
                endpoint = `/components/compatible?version=${encodeURIComponent(cleanVersion)}`;
                break;
            case 'updates':
                endpoint = `/components/updates?version=${encodeURIComponent(cleanVersion)}`;
                break;
            case 'future':
                endpoint = `/components/future?version=${encodeURIComponent(cleanVersion)}`;
                break;
            default:
                endpoint = `/components/compatible?version=${encodeURIComponent(cleanVersion)}`;
        }
        
        // Ajouter l'ID client
        if (clientId) {
            endpoint += `&clientId=${encodeURIComponent(clientId)}`;
        }
        
        // Publier un événement pour indiquer le début du chargement
        MarketplaceMediator.publish('componentsLoading', {
            tabName: tabName,
            endpoint: endpoint
        });
        
        // Valeur par défaut en cas d'erreur d'authentification
        const defaultErrorResponse = { components: [], platformInfo: { version: cleanVersion } };
        
        // Utiliser apiRequest pour effectuer la requête
        return apiRequest(endpoint, {
            method: 'GET',
            timeout: 20000, // 20 secondes timeout
            context: `loadComponents_${tabName}`,
            defaultErrorResponse: defaultErrorResponse
        })
        .then(data => {
            console.log(`Réponse API pour ${tabName}:`, data);
            
            // Extraire et normaliser les composants
            const components = normalizeComponentData(data);
            
            // Mettre à jour le cache avec le gestionnaire centralisé
            cacheManager.set(tabName, components);
            
            // Notifier que les composants sont chargés
            MarketplaceMediator.publish('componentsLoaded', {
                tabName,
                components: components,
                fromCache: false
            });
            
            return components;
        })
        .catch(error => {
            console.error(`Erreur lors du chargement des composants pour ${tabName}:`, error);
            
            // Publier un événement d'erreur spécifique à loadComponents
            MarketplaceMediator.publish('componentsLoadError', {
                tabName: tabName,
                error: error.message,
                statusCode: error.statusCode || 'network'
            });
            
            throw error;
        });
    }
    
    /**
     * Normalise les données des composants reçues de l'API
     * @param {Object|Array} data - Données à normaliser
     * @returns {Array} - Tableau de composants normalisé
     */
    function normalizeComponentData(data) {
        // Vérification et conversion des données si nécessaire
        if (!data) {
            return [];
        }
        
        // Extraire le tableau de composants selon le format
        const components = utils.extractArray(data.components || data);
        
        // Ajouter les informations de platform si disponibles
        if (data.platformInfo) {
            platformVersion = data.platformInfo.version || platformVersion;
        }
        
        // Normaliser chaque composant
        return components.map(component => ({
            ...component,
            // Normaliser les tags
            tagsArray: utils.normalizeTags(component.tags)
        }));
    }
    
    /**
     * Détermine la version à afficher pour un composant
     * @param {Object} component - Composant
     * @param {string} tabName - Onglet actif
     * @returns {string} - Version à afficher
     */
    function getDisplayVersion(component, tabName) {
        switch (tabName) {
            case 'compatible':
                // Dans l'onglet "Disponible", afficher la version installée ou disponible
                return component.isInstalled && component.installedVersion 
                    ? component.installedVersion 
                    : component.version;
                
            case 'updates':
                // Dans l'onglet "Mises à jour", afficher la version vers laquelle on peut faire la mise à jour
                return getLatestCompatibleVersion(component);
                
            case 'future':
                // Dans l'onglet "À venir", afficher la version du composant non supporté
                return component.version;
                
            default:
                // Par défaut, afficher la version du composant
                return component.version;
        }
    }
    
    /**
     * Détermine la dernière version compatible d'un composant
     * @param {Object} component - Composant à analyser
     * @returns {string} - Dernière version compatible
     */
    function getLatestCompatibleVersion(component) {
        // Si le composant n'a pas de 'eligibleVersions', utiliser la version standard
        if (!component.eligibleVersions || !Array.isArray(component.eligibleVersions) || component.eligibleVersions.length === 0) {
            // Si la version actuelle n'est pas compatible (version future), elle ne doit pas être indiquée comme mise à jour
            if (component.minPlatformVersion && component.minPlatformVersion > platformVersion) {
                // Retourner une version qui serait compatible, s'il y en a une
                return component.installedVersion || "?";
            }
            return component.version;
        }

        // Trier les versions par ordre décroissant (en supposant un format semver x.y.z)
        const sortedVersions = [...component.eligibleVersions].sort((a, b) => {
            return utils.compareVersions(b, a);
        });

        // Trouver la version la plus récente compatible avec la version actuelle de Process Studio
        for (const version of sortedVersions) {
            const versionInfo = component.versionInfos 
                ? component.versionInfos.find(v => v.version === version) 
                : null;
                
            if (!versionInfo || 
                !versionInfo.minPlatformVersion || 
                versionInfo.minPlatformVersion <= platformVersion) {
                
                // Vérifier aussi maxPlatformVersion si disponible
                if (!versionInfo || 
                    !versionInfo.maxPlatformVersion || 
                    versionInfo.maxPlatformVersion >= platformVersion) {
                    return version;
                }
            }
        }

        // Fallback à la version actuelle si aucune version compatible n'est trouvée
        return component.version;
    }
    
    /**
     * Affiche la version d'un composant avec contexte
     * @param {Object} component - Composant
     * @returns {string} - Version formatée avec contexte
     */
    function getDisplayVersionWithContext(component) {
        // Préparer une variable pour le badge de version maximale
        let maxVersionBadge = '';
        
        // Ajouter un badge si la version maximale est définie et que cette version est inférieure ou égale à la version actuelle de PS
        if (component.maxPlatformVersion && parseFloat(component.maxPlatformVersion) <= parseFloat(platformVersion)) {
            maxVersionBadge = `<span class="component-max-version-badge">Non supporté après PS ${component.maxPlatformVersion}</span>`;
        }

        // Vérifier si le composant vient de l'onglet "updates"
        if (component.sourceTab === 'updates') {
            // Pour l'onglet "Mises à jour", toujours utiliser la dernière version compatible
            const latestCompatibleVersion = getLatestCompatibleVersion(component);
            return `${component.installedVersion} <span class="component-update-badge">Mise à jour disponible (v${latestCompatibleVersion})</span> ${maxVersionBadge}`;
        }
        
        // Pour les autres onglets, appliquer la logique standard
        if (component.isInstalled) {
            // Si le composant est installé
            if (component.hasUpdate) {
                // Avec une mise à jour disponible - Utiliser la dernière version compatible
                const latestCompatibleVersion = getLatestCompatibleVersion(component);
                return `${component.installedVersion} <span class="component-update-badge">Mise à jour disponible (v${latestCompatibleVersion})</span> ${maxVersionBadge}`;
            } else {
                // Sans mise à jour
                return `${component.installedVersion} ${maxVersionBadge}`;
            }
        } else {
            // Si le composant n'est pas installé
            if (component.minPlatformVersion && component.minPlatformVersion > platformVersion) {
                // S'il s'agit d'un composant futur
                return `${component.version} <span class="component-future-badge">Nécessite PS ${component.minPlatformVersion}+</span>`;
            } else {
                // S'il s'agit d'un composant disponible
                return `${component.version} ${maxVersionBadge}`;
            }
        }
    }
    
    /**
     * Charge l'icône d'un composant
     * @param {number} componentId - ID du composant
     * @returns {Promise<string>} - URL de données de l'icône
     */
    function loadComponentIcon(componentId) {
        // Icône par défaut à utiliser en cas d'erreur
        const defaultIcon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iODAiIGhlaWdodD0iODAiIHJ4PSIxMCIgZmlsbD0iI2Y4ZjlmYSIgc3Ryb2tlPSIjMGQ2ZWZkIiBzdHJva2Utd2lkdGg9IjMiLz48cGF0aCBkPSJNMjggMzUgTDcyIDM1IiBzdHJva2U9IiMwZDZlZmQiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTI4IDUwIEw3MiA1MCIgc3Ryb2tlPSIjMGQ2ZWZkIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0yOCA2NSBMNTIgNjUiIHN0cm9rZT0iIzBkNmVmZCIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48Y2lyY2xlIGN4PSI3NSIgY3k9IjY1IiByPSI1IiBmaWxsPSIjMGQ2ZWZkIi8+PC9zdmc+';
        
        // Construire le chemin de l'endpoint d'icône du composant
        const endpoint = `/components/${encodeURIComponent(componentId)}/icon`;
        
        // Utiliser apiRequest pour obtenir l'icône avec le returnRawResponse activé
        // car nous voulons traiter directement le blob de l'image
        return apiRequest(endpoint, {
            headers: {
                'Accept': 'image/*'
            },
            timeout: 10000, // 10 secondes timeout
            context: `loadComponentIcon_${componentId}`,
            returnRawResponse: true // Nous voulons traiter le blob nous-mêmes
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            return response.blob();
        })
        .then(blob => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        })
        .catch(error => {
            // En cas d'erreur, retourner l'icône par défaut sans bloquer le flux
            console.warn(`Erreur de chargement de l'icône ${componentId}:`, error);
            return defaultIcon;
        });
    }
    
    /**
     * Applique des filtres aux composants
     * @param {Object} filters - Filtres à appliquer
     */
    function applyFilters(filters) {
        // Pour chaque onglet, appliquer les filtres
        for (const tabName in componentsCache) {
            const components = componentsCache[tabName];
            
            // Appliquer les filtres
            filteredComponents[tabName] = components.filter(component => {
                // Filtre par catégorie
                if (filters.categories && filters.categories.length > 0) {
                    if (!component.category || !filters.categories.includes(component.category)) {
                        return false;
                    }
                }
                
                // Filtre par tag
                if (filters.tags && filters.tags.length > 0) {
                    const componentTags = component.tagsArray || [];
                    if (componentTags.length === 0 || !componentTags.some(tag => filters.tags.includes(tag))) {
                        return false;
                    }
                }
                
                // Filtre par version
                if (filters.versions && filters.versions.length > 0) {
                    if (!component.version || !filters.versions.includes(component.version)) {
                        return false;
                    }
                }
                
                // Filtre par texte de recherche
                if (filters.searchTerm && filters.searchTerm.length > 0) {
                    const searchTerm = filters.searchTerm.toLowerCase();
                    return (component.displayName && component.displayName.toLowerCase().includes(searchTerm)) ||
                           (component.description && component.description.toLowerCase().includes(searchTerm)) ||
                           (component.category && component.category.toLowerCase().includes(searchTerm));
                }
                
                return true;
            });
            
            // Notifier du changement
            MarketplaceMediator.publish('componentsFiltered', {
                tabName,
                components: filteredComponents[tabName]
            });
        }
    }
    
    /**
     * Applique un terme de recherche aux composants
     * @param {string} searchTerm - Terme de recherche
     */
    function applySearch(searchTerm) {
        // Appliquer les filtres avec le terme de recherche
        applyFilters({ searchTerm });
    }
    
    /**
     * Réinitialise les filtres
     */
    function resetFilters() {
        // Pour chaque onglet, réinitialiser les filtres
        for (const tabName in componentsCache) {
            // Récupérer les composants du cache et les assigner au filteredComponents
            const cachedComponents = cacheManager.get(tabName, { checkValidity: false });
            filteredComponents[tabName] = [...cachedComponents];
            
            // Notifier du changement
            MarketplaceMediator.publish('componentsFiltered', {
                tabName,
                components: filteredComponents[tabName]
            });
        }
    }
    
    /**
     * Rafraîchit tous les composants (réinitialise le cache)
     */
    function refreshAllComponents() {
        // Utiliser le gestionnaire de cache pour invalider toutes les entrées
        cacheManager.invalidateAll();
        
        // Notifier du changement
        MarketplaceMediator.publish('componentsNeedRefresh', {});
    }
    
    /**
     * Génère le HTML pour un composant
     * @param {Object} component - Composant à afficher
     * @param {string} tabName - Onglet actif
     * @returns {string} - HTML du composant
     */
    function renderComponentHtml(component, tabName) {
        // Pour les icônes, nous allons utiliser une méthode alternative - URL de données encodées en base64
        // car les images ne peuvent pas envoyer d'en-têtes d'autorisation
        const defaultIcon = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iODAiIGhlaWdodD0iODAiIHJ4PSIxMCIgZmlsbD0iI2Y4ZjlmYSIgc3Ryb2tlPSIjMGQ2ZWZkIiBzdHJva2Utd2lkdGg9IjMiLz48cGF0aCBkPSJNMjggMzUgTDcyIDM1IiBzdHJva2U9IiMwZDZlZmQiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTI4IDUwIEw3MiA1MCIgc3Ryb2tlPSIjMGQ2ZWZkIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0yOCA2NSBMNTIgNjUiIHN0cm9rZT0iIzBkNmVmZCIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48Y2lyY2xlIGN4PSI3NSIgY3k9IjY1IiByPSI1IiBmaWxsPSIjMGQ2ZWZkIi8+PC9zdmc+`;
        
        // Déterminer le bouton d'action en fonction du statut d'installation
        let actionButton = '';
        let statusBadge = '';
        
        if (component.isInstalled) {
            // Composant déjà installé
            statusBadge = `<span class="component-status installed">Installé</span>`;
            
            if (tabName === 'updates') {
                // Mise à jour disponible pour un composant installé
                // Utiliser la dernière version compatible avec la version actuelle de Process Studio
                const latestCompatibleVersion = getLatestCompatibleVersion(component);
                actionButton = `
                    <button type="button" class="btn btn-update" data-id="${component.componentId}" data-version="${latestCompatibleVersion}">Mettre à jour</button>
                    <button type="button" class="btn btn-uninstall" data-id="${component.componentId}">Désinstaller</button>
                `;
            } else {
                // Composant installé sans mise à jour disponible
                actionButton = `
                    <button type="button" class="btn btn-uninstall" data-id="${component.componentId}">Désinstaller</button>
                `;
            }
        } else {
            // Composant non installé
            if (tabName === 'compatible') {
                actionButton = `<button type="button" class="btn btn-install" data-id="${component.componentId}" data-version="${component.version}">Installer</button>`;
            } else if (tabName === 'future') {
                actionButton = `<button type="button" class="btn btn-disabled" disabled>Nécessite PS ${component.minPlatformVersion}+</button>`;
            }
        }
        
        // Créer la carte du composant
        return `
            <div class="component-card${component.isInstalled ? ' installed' : ''}" data-id="${component.componentId}">
                <div class="component-icon">
                    <img src="${defaultIcon}" alt="${component.displayName}" id="icon-${component.componentId}" class="component-icon-img" />
                    ${statusBadge}
                </div>
                <div class="component-details">
                    <div class="component-title-wrapper">
                        <h3 class="component-name">${component.displayName}</h3>
                        ${component.isInstalled ? `<button type="button" class="btn-icon help-icon" title="Voir la documentation" data-id="${component.componentId}"><i class="fas fa-question-circle"></i></button>` : ''}
                    </div>
                    <p class="component-description">${component.description}</p>
                    <div class="component-meta">
                        <span class="component-version">v${getDisplayVersion(component, tabName)}</span>
                        <span class="component-category">${component.category || 'Non catégorisé'}</span>
                        ${component.isInstalled && component.hasUpdate ? '<span class="component-update-badge">Mise à jour disponible</span>' : ''}
                        ${tabName === 'future' && component.minPlatformVersion ? `<span class="component-future-badge">Nécessite PS ${component.minPlatformVersion}+</span>` : ''}
                        ${component.maxPlatformVersion && parseFloat(component.maxPlatformVersion) <= parseFloat(platformVersion) ? 
                          `<span class="component-max-version-badge">Non supporté après PS ${component.maxPlatformVersion}</span>` : 
                          ''}
                        ${component.tagsArray && component.tagsArray.length > 0 ? `
                        <div class="component-tags">
                            ${component.tagsArray.slice(0, 2).map(tag => `<span class="component-tag">${tag}</span>`).join('')}
                            ${component.tagsArray.length > 2 ? '<span class="component-tag">...</span>' : ''}
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="component-actions">
                    <button type="button" class="btn btn-info" data-id="${component.componentId}">Détails</button>
                    ${actionButton}
                </div>
            </div>
        `;
    }
    
    /**
     * Obtient un composant par son ID
     * @param {number} componentId - ID du composant
     * @returns {Object|null} - Composant ou null si non trouvé
     */
    function getComponentById(componentId) {
        // Convertir componentId en nombre pour être sûr (au cas où c'est une chaîne)
        const idToFind = parseInt(componentId, 10);
        
        // Chercher dans tous les onglets du cache principal
        for (const tabName in componentsCache) {
            const component = componentsCache[tabName].find(c => parseInt(c.componentId, 10) === idToFind);
            if (component) {
                // Ajouter l'onglet source au composant
                return { ...component, sourceTab: tabName };
            }
        }
        
        // Si le composant n'est pas trouvé, tenter une recherche plus approfondie
        console.log(`Composant #${componentId} non trouvé dans le cache standard, recherche approfondie...`);
        
        // Parcourir le filteredComponents également
        for (const tabName in filteredComponents) {
            const component = filteredComponents[tabName].find(c => parseInt(c.componentId, 10) === idToFind);
            if (component) {
                console.log(`Composant #${componentId} trouvé dans filteredComponents.${tabName}`);
                return { ...component, sourceTab: tabName };
            }
        }
        
        // Dernière tentative: vérifier si une variable globale componentCache existe (compatibilité avec l'ancien code)
        try {
            if (typeof window.componentCache !== 'undefined') {
                console.log("Tentative de recherche dans le componentCache global (ancien code)");
                
                for (const category in window.componentCache) {
                    if (window.componentCache[category]) {
                        // Vérifier et normaliser les données en cache si nécessaire
                        let components = window.componentCache[category];
                        
                        // Si l'objet en cache n'est pas un tableau, essayer d'extraire le tableau
                        if (!Array.isArray(components)) {
                            // Format direct $values 
                            if (components.$values && Array.isArray(components.$values)) {
                                components = components.$values;
                            }
                            // Format imbriqué
                            else if (components.components && Array.isArray(components.components)) {
                                components = components.components;
                            } 
                            // Format imbriqué avec $values
                            else if (components.components && components.components.$values && Array.isArray(components.components.$values)) {
                                components = components.components.$values;
                            } 
                            // Autres formats courants
                            else if (components.items && Array.isArray(components.items)) {
                                components = components.items;
                            } 
                            else if (components.data && Array.isArray(components.data)) {
                                components = components.data;
                            }
                            // Si ce n'est toujours pas un tableau, passer à la catégorie suivante
                            else {
                                continue;
                            }
                        }
                        
                        const found = components.find(c => parseInt(c.componentId, 10) === idToFind);
                        if (found) {
                            console.log(`Composant #${componentId} trouvé dans le cache global (ancien code)`);
                            return { ...found, sourceTab: 'global' };
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("Erreur lors de la recherche dans le cache global:", e);
        }
        
        console.warn(`Composant #${componentId} introuvable dans tous les caches`);
        return null;
    }
    
    /**
     * Obtient les détails complets d'un composant
     * @param {number} componentId - ID du composant
     * @returns {Promise<Object>} - Promesse résolue avec les détails du composant
     */
    function getComponentDetails(componentId) {
        // Publier un événement pour indiquer le début du chargement des détails
        MarketplaceMediator.publish('componentDetailsLoading', {
            componentId: componentId
        });
        
        // Créer les réponses par défaut pour les différents cas d'erreur
        const defaultErrorResponses = {
            auth: { 
                componentId: componentId,
                displayName: "Détails non disponibles",
                description: "Problème d'authentification. Veuillez contacter votre administrateur.",
                category: "Erreur d'authentification",
                version: "N/A",
                authError: true
            },
            notFound: { 
                componentId: componentId,
                displayName: "Composant non trouvé",
                description: "Ce composant n'existe pas ou n'est plus disponible.",
                category: "Erreur",
                version: "N/A",
                notFound: true
            },
            server: { 
                componentId: componentId,
                displayName: "Erreur serveur",
                description: "Une erreur est survenue sur le serveur. Veuillez réessayer plus tard.",
                category: "Erreur serveur",
                version: "N/A",
                serverError: true
            },
            timeout: {
                componentId: componentId,
                displayName: "Délai d'attente dépassé",
                description: "Le serveur n'a pas répondu dans le délai imparti. Veuillez réessayer plus tard.",
                category: "Erreur de délai",
                version: "N/A",
                timeoutError: true
            }
        };
        
        // Construire le endpoint pour les détails du composant
        const endpoint = `/components/${encodeURIComponent(componentId)}`;
        
        // Utiliser apiRequest pour obtenir les détails du composant
        return apiRequest(endpoint, {
            method: 'GET',
            timeout: 15000, // 15 secondes timeout
            context: 'getComponentDetails',
            // Personnaliser les réponses d'erreur selon le type d'erreur HTTP
            // Cette logique est gérée dans apiRequest mais nous voulons des réponses spécifiques
            defaultErrorResponse: null // On va gérer les erreurs spécifiquement dans le catch
        })
        .then(detailedComponent => {
            console.log("Détails du composant depuis l'API:", detailedComponent);
            
            // Vérifier si on a un vrai composant ou un objet d'erreur
            if (detailedComponent && !detailedComponent.error) {
                // Récupérer le composant de base avec l'onglet source
                const baseComponent = getComponentById(componentId);
                
                // Fusionner les informations si on a un baseComponent
                const mergedComponent = baseComponent ? {
                    ...baseComponent,
                    ...detailedComponent,
                    // Préserver ces propriétés du composant de base
                    isInstalled: baseComponent.isInstalled === undefined ? detailedComponent.isInstalled : baseComponent.isInstalled,
                    hasUpdate: baseComponent.hasUpdate === undefined ? detailedComponent.hasUpdate : baseComponent.hasUpdate,
                    installedVersion: baseComponent.installedVersion === undefined ? detailedComponent.installedVersion : baseComponent.installedVersion,
                    tagsArray: utils.normalizeTags(detailedComponent.tags || baseComponent.tags)
                } : {
                    ...detailedComponent,
                    tagsArray: utils.normalizeTags(detailedComponent.tags || [])
                };
                
                // Publier un événement pour indiquer que les détails sont chargés
                MarketplaceMediator.publish('componentDetailsLoaded', {
                    componentId: componentId,
                    component: mergedComponent
                });
                
                return mergedComponent;
            }
            
            // C'est un objet d'erreur, à retourner tel quel
            return detailedComponent;
        })
        .catch(error => {
            console.error(`Erreur lors du chargement des détails du composant ${componentId}:`, error);
            
            // Publier un événement d'erreur générique
            MarketplaceMediator.publish('componentDetailsLoadError', {
                componentId: componentId,
                error: error.message
            });
            
            // Déterminer le type d'erreur et renvoyer la réponse adaptée
            if (error.name === 'AbortError') {
                return defaultErrorResponses.timeout;
            }
            
            if (error.statusCode === 401 || error.statusCode === 403) {
                return defaultErrorResponses.auth;
            }
            
            if (error.statusCode === 404) {
                return defaultErrorResponses.notFound;
            }
            
            if (error.statusCode >= 500) {
                return defaultErrorResponses.server;
            }
            
            // Pour les autres erreurs, réutiliser le composant de base si disponible
            const baseComponent = getComponentById(componentId);
            if (baseComponent) {
                return {
                    ...baseComponent,
                    description: baseComponent.description || "Une erreur est survenue lors du chargement des détails. " + error.message,
                    errorLoading: true
                };
            }
            
            // Sinon, créer un composant d'erreur générique
            return { 
                componentId: componentId,
                displayName: "Erreur de chargement",
                description: `Une erreur est survenue lors du chargement des détails: ${error.message}`,
                category: "Erreur",
                version: "N/A",
                errorLoading: true
            };
        });
    }
    
    /**
     * Récupère les composants filtrés pour un onglet
     * @param {string} tabName - Nom de l'onglet
     * @returns {Array} - Composants filtrés
     */
    function getFilteredComponents(tabName) {
        return filteredComponents[tabName] || [];
    }
    
    /**
     * Récupère le nombre de composants visibles dans l'onglet actif
     * @param {string} tabName - Nom de l'onglet (optionnel)
     * @returns {number} - Nombre de composants visibles
     */
    function getVisibleComponentsCount(tabName) {
        // Si tabName n'est pas fourni, utiliser l'onglet actif
        if (!tabName) {
            const activeTab = document.querySelector('.tab-content.active');
            if (!activeTab) return 0;
            
            tabName = activeTab.id.replace('-tab', '');
        }
        
        return filteredComponents[tabName] ? filteredComponents[tabName].length : 0;
    }
    
    /**
     * Prépare les en-têtes d'authentification pour les requêtes API
     * @param {Object} headers - Objet d'en-têtes à compléter
     * @returns {Object} - Objet d'en-têtes avec authentification
     */
    function prepareAuthHeaders(headers = {}) {
        // Assurons-nous que headers est un objet
        if (!headers) headers = {};
        
        // Récupérer la clé API du Web.config
        const apiKey = config.getApiKey();
        
        console.log("Préparation des en-têtes d'authentification:");
        console.log("- apiKey présente:", !!apiKey);
        
        // Ajouter les en-têtes standard s'ils ne sont pas déjà présents
        if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
        
        if (!headers['Accept']) {
            headers['Accept'] = 'application/json';
        }
        
        // Utiliser la même méthode que l'ancien code qui fonctionnait:
        // Format Bearer token (même si cela semble incorrect pour l'API)
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
            console.log("En-tête d'autorisation ajouté avec le token du Web.config (format Bearer)");
        } else {
            console.warn("ATTENTION: Aucune clé API trouvée dans le Web.config - Les appels API risquent d'échouer");
        }
        
        return headers;
    }
    
    // API publique
    return {
        init,
        loadComponents,
        getDisplayVersion,
        getDisplayVersionWithContext,
        loadComponentIcon,
        applyFilters,
        resetFilters,
        refreshAllComponents,
        renderComponentHtml,
        getComponentById,
        getComponentDetails,
        getFilteredComponents,
        getVisibleComponentsCount,
        prepareAuthHeaders,  // Exposer la fonction d'aide
        apiRequest,  // Exposer la fonction de requête API centralisée
        cacheManager  // Exposer le gestionnaire de cache
    };
});