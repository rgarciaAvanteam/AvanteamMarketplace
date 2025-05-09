/**
 * module-registry.js - Système pour éviter les redéclarations de modules
 * Chargé en premier pour garantir que le registre est disponible avant les autres scripts
 */

// Définir l'espace de noms global pour les modules Marketplace
window.Marketplace = window.Marketplace || {};

// Registre des modules déjà chargés
window.Marketplace.moduleRegistry = window.Marketplace.moduleRegistry || {};

// Version du système de modules
window.Marketplace.moduleVersion = '1.0.0';

/**
 * Récupère ou crée un module en s'assurant qu'il n'est défini qu'une seule fois
 * @param {string} name - Nom du module (sans préfixe Marketplace)
 * @param {Function} factory - Fonction qui crée le module
 * @returns {Object} L'instance du module
 */
window.Marketplace.defineModule = function(name, factory) {
    // Le nom complet inclut le préfixe Marketplace
    const fullName = 'Marketplace.' + name;
    
    // Si le module existe déjà, l'utiliser
    if (window.Marketplace.moduleRegistry[name]) {
        console.log(`Module ${name} déjà chargé, utilisation de l'instance existante`);
        return window.Marketplace.moduleRegistry[name];
    }
    
    // Créer une nouvelle instance du module
    console.log(`Création du module ${name} (v${window.Marketplace.moduleVersion})`);
    const moduleInstance = factory();
    
    // Enregistrer dans le registre pour une réutilisation ultérieure
    window.Marketplace.moduleRegistry[name] = moduleInstance;
    
    return moduleInstance;
};

// Afficher un message de démarrage
console.log("Système de modules Marketplace initialisé avec succès");