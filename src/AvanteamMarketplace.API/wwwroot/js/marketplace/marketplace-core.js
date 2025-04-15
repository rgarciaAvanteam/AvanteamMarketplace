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

document.addEventListener('DOMContentLoaded', function() {
    // Initialiser la gestion des onglets
    setupTabs();
    
    // Initialiser la recherche
    setupSearch();
    
    // Initialiser l'affichage des versions
    initVersionsDisplay();
    
    // Charger les composants pour l'onglet actif
    loadTabContent('compatible');
});