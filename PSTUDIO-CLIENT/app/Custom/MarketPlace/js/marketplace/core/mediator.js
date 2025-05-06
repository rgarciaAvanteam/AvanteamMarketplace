/**
 * mediator.js - Médiateur central pour la gestion des modules du Marketplace
 * 
 * Ce module implémente un pattern médiateur qui:
 * - Gère l'enregistrement et l'accès aux modules
 * - Facilite la communication entre les modules sans créer de dépendances directes
 * - Fournit un système d'événements pour la communication publish/subscribe
 */

const MarketplaceMediator = (function() {
    // Registre des modules
    const modules = {};
    
    // Bus d'événements
    const events = {};
    
    /**
     * Enregistre un module dans le médiateur
     * @param {string} name - Nom unique du module
     * @param {Object} moduleInstance - Instance du module
     * @returns {Object} - L'instance du module enregistrée
     */
    function registerModule(name, moduleInstance) {
        if (modules[name]) {
            console.warn(`Module ${name} déjà enregistré, l'instance existante sera écrasée`);
        }
        
        modules[name] = moduleInstance;
        console.log(`Module ${name} enregistré avec succès`);
        
        return moduleInstance;
    }
    
    /**
     * Récupère un module par son nom
     * @param {string} name - Nom du module à récupérer
     * @returns {Object|null} - L'instance du module ou null si non trouvé
     */
    function getModule(name) {
        if (!modules[name]) {
            console.warn(`Module ${name} non trouvé dans le médiateur`);
            return null;
        }
        
        return modules[name];
    }
    
    /**
     * S'abonne à un événement
     * @param {string} eventName - Nom de l'événement
     * @param {Function} callback - Fonction à appeler lorsque l'événement est déclenché
     * @returns {Function} - Fonction permettant de se désabonner
     */
    function subscribe(eventName, callback) {
        if (!events[eventName]) {
            events[eventName] = [];
        }
        
        events[eventName].push(callback);
        
        // Retourne une fonction pour se désabonner
        return function unsubscribe() {
            events[eventName] = events[eventName].filter(cb => cb !== callback);
        };
    }
    
    /**
     * Publie un événement
     * @param {string} eventName - Nom de l'événement
     * @param {any} data - Données à passer aux abonnés
     */
    function publish(eventName, data) {
        if (!events[eventName]) {
            return;
        }
        
        events[eventName].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Erreur lors de l'exécution d'un callback pour l'événement ${eventName}:`, error);
            }
        });
    }
    
    /**
     * Crée un module avec injection de dépendances
     * @param {string} name - Nom du module
     * @param {Array<string>} dependencies - Tableau des noms des modules dont dépend ce module
     * @param {Function} factory - Fonction de création du module qui recevra les dépendances
     * @returns {Object} - L'instance du module créée
     */
    function defineModule(name, dependencies, factory) {
        console.log(`Définition du module ${name}`);
        
        // Vérifie si le module existe déjà
        if (modules[name]) {
            console.log(`Module ${name} déjà défini, utilisation de l'instance existante`);
            return modules[name];
        }
        
        // Charge les dépendances
        const deps = dependencies.map(dep => {
            const dependency = getModule(dep);
            if (!dependency) {
                console.error(`Dépendance ${dep} non trouvée pour le module ${name}`);
            }
            return dependency;
        });
        
        // Crée l'instance du module avec les dépendances
        const moduleInstance = factory.apply(null, deps);
        
        // Enregistre l'instance
        return registerModule(name, moduleInstance);
    }
    
    /**
     * Initialise un module après sa création
     * @param {string} name - Nom du module à initialiser
     * @param {any} config - Configuration à passer au module
     */
    function initModule(name, config) {
        const module = getModule(name);
        
        if (!module) {
            console.error(`Impossible d'initialiser le module ${name} car il n'existe pas`);
            return;
        }
        
        if (typeof module.init === 'function') {
            try {
                module.init(config);
                console.log(`Module ${name} initialisé avec succès`);
            } catch (error) {
                console.error(`Erreur lors de l'initialisation du module ${name}:`, error);
            }
        } else {
            console.warn(`Le module ${name} n'a pas de méthode d'initialisation`);
        }
    }
    
    /**
     * Démarre tous les modules enregistrés
     * @param {Object} globalConfig - Configuration globale à passer à tous les modules
     */
    function startAllModules(globalConfig) {
        console.log("Démarrage de tous les modules enregistrés");
        
        // Crée un tableau des noms de modules triés selon les dépendances
        const moduleNames = Object.keys(modules);
        
        // Initialise chaque module
        moduleNames.forEach(name => {
            initModule(name, globalConfig);
        });
        
        // Publie un événement pour indiquer que tous les modules sont initialisés
        publish('allModulesReady', { modules: moduleNames });
    }
    
    // API publique
    return {
        registerModule,
        getModule,
        subscribe,
        publish,
        defineModule,
        initModule,
        startAllModules
    };
})();

// Exposer le médiateur globalement pour l'utiliser dans d'autres scripts
window.MarketplaceMediator = MarketplaceMediator;