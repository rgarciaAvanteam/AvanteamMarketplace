/**
 * marketplace-core.js - Module principal du Marketplace
 * Contient les variables globales, l'initialisation et les configurations de base
 */

// URL de l'API locale d'installation (.NET Core 6.0)
const localApiUrl = '/api-installer/';

// Cache des composants chargés
const componentCache = {
    compatible: null,
    updates: null,
    future: null
};

let currentFilter = '';

document.addEventListener('DOMContentLoaded', function() {
    // Initialiser la gestion des onglets
    setupTabs();
    
    // Initialiser la recherche
    setupSearch();
    
    // Charger les composants pour l'onglet actif
    loadTabContent('compatible');
});