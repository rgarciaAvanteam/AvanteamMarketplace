/**
 * load-once.js - Système pour assurer un chargement unique des modules JavaScript
 */

// Créer un registre global pour les modules chargés
if (typeof window.loadedModules === 'undefined') {
    window.loadedModules = {};
}

/**
 * Fonction pour garantir qu'un module n'est défini qu'une seule fois
 * @param {string} name - Nom du module
 * @param {Function} factory - Fonction de fabrication du module
 * @returns {any} - Le module s'il existe déjà, sinon le résultat de la factory
 */
window.ensureModuleOnce = function(name, factory) {
    // Si le module est déjà enregistré, renvoyer l'instance existante
    if (window.loadedModules[name]) {
        console.log(`Module ${name} déjà chargé, utilisation de l'instance existante`);
        return window.loadedModules[name];
    }
    
    // Sinon, créer le module
    console.log(`Création du module ${name} pour la première fois`);
    const instance = factory();
    
    // Enregistrer le module dans le registre
    window.loadedModules[name] = instance;
    
    return instance;
};