/**
 * marketplace-ui.js - Gestion de l'interface utilisateur du Marketplace
 * Gère les onglets, les filtres et les interactions de base
 */

/**
 * Configure les gestionnaires d'événements pour les onglets
 */
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Mettre à jour le bouton actif
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Mettre à jour le contenu visible
            const tabId = this.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // Charger le contenu de l'onglet si nécessaire
            loadTabContent(tabId);
        });
    });
}

/**
 * Configure la recherche
 */
function setupSearch() {
    const searchInput = document.getElementById('search-components');
    
    searchInput.addEventListener('input', function() {
        currentFilter = this.value.toLowerCase();
        
        // Appliquer le filtre à l'onglet actif
        const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');
        filterComponents(activeTab, currentFilter);
    });
}

/**
 * Filtre les composants affichés selon un terme de recherche
 * @param {string} tabName - Nom de l'onglet à filtrer
 * @param {string} searchTerm - Terme de recherche
 */
function filterComponents(tabName, searchTerm) {
    if (!componentCache[tabName]) return;
    
    // Vérifier et normaliser les données en cache si nécessaire
    let components = componentCache[tabName];
    
    // Si l'objet en cache n'est pas un tableau, essayer d'extraire le tableau
    if (!Array.isArray(components)) {
        // Format spécifique de .NET avec $values
        if (components.components && components.components.$values && Array.isArray(components.components.$values)) {
            components = components.components.$values;
        }
        // Autres formats courants
        else if (components.items && Array.isArray(components.items)) {
            components = components.items;
        } else if (components.components && Array.isArray(components.components)) {
            components = components.components;
        } else if (components.data && Array.isArray(components.data)) {
            components = components.data;
        } else {
            console.error('Format de cache non pris en charge:', components);
            return;
        }
        // Mettre à jour le cache avec le tableau extrait
        componentCache[tabName] = components;
    }
    
    // Si recherche vide, afficher tous les composants
    if (!searchTerm) {
        return renderComponents(tabName, components);
    }
    
    // Filtrer les composants
    try {
        const filtered = components.filter(component => {
            return (component.displayName && component.displayName.toLowerCase().includes(searchTerm)) ||
                   (component.description && component.description.toLowerCase().includes(searchTerm)) ||
                   (component.category && component.category.toLowerCase().includes(searchTerm));
        });
        
        // Afficher les résultats filtrés
        renderComponents(tabName, filtered);
    } catch (error) {
        console.error('Erreur lors du filtrage des composants:', error);
        // Afficher les composants sans filtre en cas d'erreur
        renderComponents(tabName, components);
    }
}

/**
 * Charge le contenu pour un onglet spécifique
 * @param {string} tabName - Nom de l'onglet (compatible, updates, future)
 */
function loadTabContent(tabName) {
    // Si déjà chargé, appliquer simplement le filtre actuel
    if (componentCache[tabName]) {
        return filterComponents(tabName, currentFilter);
    }
    
    // Afficher le chargement
    const container = document.getElementById(`${tabName}-components`);
    container.innerHTML = '<div class="loading">Chargement des composants...</div>';
    
    // Construire l'URL
    const url = `${apiUrl}/components/${tabName}?clientId=${encodeURIComponent(clientId)}&version=${encodeURIComponent(platformVersion)}`;
    
    // Effectuer la requête à l'API
    fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur réseau: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log(`Réponse API pour ${tabName}:`, data);
        
        // Sauvegarder dans le cache
        componentCache[tabName] = data;
        
        // Afficher les composants
        renderComponents(tabName, data);
        
        // Appliquer le filtre si nécessaire
        if (currentFilter) {
            filterComponents(tabName, currentFilter);
        }
    })
    .catch(error => {
        console.error('Erreur lors du chargement des composants:', error);
        
        // Afficher le message d'erreur
        container.innerHTML = `
            <div class="error-message">
                <p>Une erreur est survenue lors du chargement des composants.</p>
                <p>Détail: ${error.message}</p>
                <button type="button" class="btn btn-retry" onclick="loadTabContent('${tabName}')">Réessayer</button>
            </div>
        `;
        
        // En mode développement, utiliser des données de test
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setTimeout(() => {
                useMockData(tabName);
            }, 1000);
        }
    });
}

/**
 * Formate une date ISO en format local
 * @param {string} isoDate - Date au format ISO
 * @returns {string} Date formatée
 */
function formatDate(isoDate) {
    const date = new Date(isoDate);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

/**
 * Rafraîchit les listes de composants après une installation ou désinstallation
 */
function refreshComponentLists() {
    // Vider le cache pour forcer le rechargement
    for (const category in componentCache) {
        componentCache[category] = null;
    }
    
    // Recharger l'onglet actif
    const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');
    loadTabContent(activeTab);
}

/**
 * Utilise des données de test pour le développement
 * @param {string} tabName - Nom de l'onglet
 */
function useMockData(tabName) {
    console.log(`Utilisation de données de test pour ${tabName}`);
    
    const mockData = {
        compatible: [
            {
                componentId: 1,
                name: 'workflow-designer',
                displayName: 'Workflow Designer',
                description: 'Éditeur graphique de workflows BPMN pour Process Studio',
                version: '1.2.0',
                category: 'Design',
                author: 'Avanteam',
                minPlatformVersion: '23.0',
                iconUrl: 'images/workflow-designer.svg'
            },
            {
                componentId: 2,
                name: 'doc-ai',
                displayName: 'Document AI',
                description: 'Extraction automatique de données depuis des documents avec IA',
                version: '0.9.5',
                category: 'IA',
                author: 'Avanteam Labs',
                minPlatformVersion: '22.0',
                iconUrl: 'images/doc-ai.svg'
            },
            {
                componentId: 3,
                name: 'advanced-reporting',
                displayName: 'Advanced Reporting',
                description: 'Rapports personnalisés et tableaux de bord analytiques',
                version: '2.1.0',
                category: 'Reporting',
                author: 'Avanteam',
                minPlatformVersion: '23.5',
                iconUrl: 'images/reporting.svg'
            }
        ],
        updates: [
            {
                componentId: 4,
                name: 'mobile-companion',
                displayName: 'Mobile Companion',
                description: 'Application mobile pour accéder à Process Studio en déplacement',
                version: '3.2.1',
                currentVersion: '3.1.0',
                category: 'Mobile',
                author: 'Avanteam',
                minPlatformVersion: '22.0',
                iconUrl: 'images/mobile.svg',
                isInstalled: true
            }
        ],
        future: [
            {
                componentId: 5,
                name: 'digital-signature',
                displayName: 'Digital Signature',
                description: 'Signature électronique de documents conforme eIDAS',
                version: '1.0.0-beta',
                category: 'Sécurité',
                author: 'Avanteam',
                minPlatformVersion: '24.0',
                iconUrl: 'images/sign.svg'
            }
        ]
    };
    
    // Sauvegarder dans le cache et afficher
    componentCache[tabName] = mockData[tabName] || [];
    renderComponents(tabName, mockData[tabName] || []);
}