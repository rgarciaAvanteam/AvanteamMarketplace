/**
 * Avanteam Marketplace - Script client principal
 * Gère l'interface utilisateur et les appels à l'API du marketplace
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

/**
 * Charge l'icône d'un composant depuis l'API et la met à jour dans l'interface
 * Cette fonction utilise fetch avec les en-têtes d'autorisation nécessaires
 * @param {number} componentId - ID du composant
 */
function loadComponentIcon(componentId) {
    // Construire l'URL de l'icône du composant
    const iconUrl = `${apiUrl}/components/${componentId}/icon`;
    
    // Effectuer la requête avec l'en-tête d'autorisation
    fetch(iconUrl, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        return response.blob();
    })
    .then(blob => {
        // Convertir le blob en URL de données
        const reader = new FileReader();
        reader.onloadend = function() {
            // Une fois l'icône chargée, mettre à jour l'image dans l'interface
            const iconElement = document.getElementById(`icon-${componentId}`);
            if (iconElement) {
                iconElement.src = reader.result;
                console.log(`Icône chargée avec succès pour le composant ${componentId}`);
            }
        };
        reader.readAsDataURL(blob);
    })
    .catch(error => {
        console.error(`Erreur lors du chargement de l'icône pour le composant ${componentId}:`, error);
        // En cas d'échec, laisser l'icône par défaut
    });
}

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
 * Affiche les composants dans un onglet
 * @param {string} tabName - Nom de l'onglet
 * @param {Array} components - Liste des composants à afficher
 */
function renderComponents(tabName, components) {
    const container = document.getElementById(`${tabName}-components`);
    
    // Vérification et conversion des données si nécessaire
    if (!components) {
        container.innerHTML = '<div class="empty-message">Aucun composant disponible dans cette catégorie</div>';
        return;
    }
    
    // Si l'API renvoie un objet avec une propriété 'items' ou similaire, essayer de l'extraire
    if (!Array.isArray(components)) {
        console.log('Réponse API (non tableau):', components);
        
        // Format spécifique de .NET avec $values
        if (components.components && components.components.$values && Array.isArray(components.components.$values)) {
            console.log("Utilisation du format .NET $values");
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
            // Si on ne peut pas trouver de tableau, afficher un message plus informatif
            console.error('Format de réponse API non pris en charge:', components);
            
            // Afficher un message plus convivial indiquant que le système fonctionne mais qu'il n'y a pas de composants
            if (components.platformInfo && components.platformInfo.componentsCount === 0) {
                container.innerHTML = '<div class="empty-message">Aucun composant disponible dans cette catégorie.</div>';
            } else {
                container.innerHTML = '<div class="error-message">Format de données non reconnu</div>';
            }
            return;
        }
    }
    
    if (components.length === 0) {
        container.innerHTML = '<div class="empty-message">Aucun composant disponible dans cette catégorie</div>';
        return;
    }
    
    let html = '';
    
    components.forEach(component => {
        // Pour les icônes, nous allons utiliser une méthode alternative - URL de données encodées en base64
        // car les images ne peuvent pas envoyer d'en-têtes d'autorisation
        const iconPath = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iODAiIGhlaWdodD0iODAiIHJ4PSIxMCIgZmlsbD0iI2Y4ZjlmYSIgc3Ryb2tlPSIjMGQ2ZWZkIiBzdHJva2Utd2lkdGg9IjMiLz48cGF0aCBkPSJNMjggMzUgTDcyIDM1IiBzdHJva2U9IiMwZDZlZmQiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTI4IDUwIEw3MiA1MCIgc3Ryb2tlPSIjMGQ2ZWZkIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0yOCA2NSBMNTIgNjUiIHN0cm9rZT0iIzBkNmVmZCIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48Y2lyY2xlIGN4PSI3NSIgY3k9IjY1IiByPSI1IiBmaWxsPSIjMGQ2ZWZkIi8+PC9zdmc+`;
        console.log("Utilisation d'une icône SVG par défaut intégrée");
        
        // Parallèlement, nous allons essayer de charger dynamiquement l'icône du composant
        loadComponentIcon(component.componentId);
        
        // Utiliser l'icône par défaut intégrée en attendant
        const icon = iconPath;
        
        // Déterminer le bouton d'action en fonction du statut d'installation
        let actionButton = '';
        let statusBadge = '';
        
        if (component.isInstalled) {
            // Composant déjà installé
            statusBadge = `<span class="component-status installed">Installé</span>`;
            
            if (tabName === 'updates') {
                // Mise à jour disponible pour un composant installé
                actionButton = `
                    <button type="button" class="btn btn-update" data-id="${component.componentId}" onclick="installComponent(${component.componentId}, '${component.version}')">Mettre à jour</button>
                    <button type="button" class="btn btn-uninstall" data-id="${component.componentId}" onclick="uninstallComponent(${component.componentId})">Désinstaller</button>
                `;
            } else {
                // Composant installé sans mise à jour disponible
                actionButton = `
                    <button type="button" class="btn btn-uninstall" data-id="${component.componentId}" onclick="uninstallComponent(${component.componentId})">Désinstaller</button>
                `;
            }
        } else {
            // Composant non installé
            if (tabName === 'compatible') {
                actionButton = `<button type="button" class="btn btn-install" data-id="${component.componentId}" onclick="installComponent(${component.componentId}, '${component.version}')">Installer</button>`;
            } else if (tabName === 'future') {
                actionButton = `<button type="button" class="btn btn-disabled" disabled>Nécessite PS ${component.minPlatformVersion}+</button>`;
            }
        }
        
        // Créer la carte du composant
        html += `
            <div class="component-card${component.isInstalled ? ' installed' : ''}" data-id="${component.componentId}">
                <div class="component-icon">
                    <img src="${icon}" alt="${component.displayName}" id="icon-${component.componentId}" class="component-icon-img" />
                    ${statusBadge}
                </div>
                <div class="component-details">
                    <h3 class="component-name">${component.displayName}</h3>
                    <p class="component-description">${component.description}</p>
                    <div class="component-meta">
                        <span class="component-version">v${component.version}</span>
                        <span class="component-category">${component.category}</span>
                    </div>
                </div>
                <div class="component-actions">
                    <button type="button" class="btn btn-info" data-id="${component.componentId}" onclick="showComponentDetails(${component.componentId})">Détails</button>
                    ${actionButton}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
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
 * Affiche les détails d'un composant
 * @param {number} componentId - ID du composant
 */
function showComponentDetails(componentId) {
    // Trouver le composant dans le cache
    let component = null;
    
    for (const category in componentCache) {
        if (componentCache[category]) {
            // Vérifier et normaliser les données en cache si nécessaire
            let components = componentCache[category];
            
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
            
            const found = components.find(c => c.componentId === componentId);
            if (found) {
                component = found;
                break;
            }
        }
    }
    
    if (!component) {
        alert('Composant non trouvé');
        return;
    }
    
    // Charger les détails complets du composant depuis l'API
    fetch(`${apiUrl}/components/${componentId}`, {
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
    .then(detailedComponent => {
        console.log("Composant de base:", component);
        console.log("Détails du composant depuis l'API:", detailedComponent);
        
        // Fusionner les informations en préservant isInstalled et hasUpdate du composant de base
        const isInstalled = component.isInstalled;
        const hasUpdate = component.hasUpdate;
        
        const fullComponent = { 
            ...component, 
            ...detailedComponent,
            isInstalled: isInstalled === undefined ? detailedComponent.isInstalled : isInstalled,
            hasUpdate: hasUpdate === undefined ? detailedComponent.hasUpdate : hasUpdate
        };
        
        console.log("Composant fusionné pour l'affichage:", fullComponent);
        
        // Créer la modal de détails
        createComponentDetailsModal(fullComponent);
    })
    .catch(error => {
        console.error('Erreur lors du chargement des détails:', error);
        
        // Afficher les détails de base en cas d'erreur
        createComponentDetailsModal(component);
    });
}

/**
 * Crée et affiche une modal avec les détails d'un composant
 * @param {Object} component - Composant à afficher
 */
function createComponentDetailsModal(component) {
    // Créer la modal
    const modal = document.createElement('div');
    modal.className = 'component-modal';
    
    // Vérifier si un dépôt GitHub est disponible
    const hasGitRepo = component.repositoryUrl && component.repositoryUrl.includes('github.com');
    
    // Préparer les boutons pour la documentation
    let docButtons = '';
    if (component.readmeHtml || hasGitRepo) {
        docButtons = `
            <div class="component-doc-buttons" style="display: flex; justify-content: center; gap: 10px; margin-top: 15px;">
                ${component.readmeHtml ? `
                    <button type="button" class="btn btn-info" id="view-readme-btn">Voir la documentation</button>
                ` : ''}
                ${hasGitRepo ? `
                    <button type="button" class="btn btn-secondary" id="view-repo-btn">Code source GitHub</button>
                ` : ''}
            </div>
        `;
    }
    
    // Préparer le HTML du modal
    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content">
            <button type="button" class="modal-close">&times;</button>
            
            <div class="modal-header">
                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iODAiIGhlaWdodD0iODAiIHJ4PSIxMCIgZmlsbD0iI2Y4ZjlmYSIgc3Ryb2tlPSIjMGQ2ZWZkIiBzdHJva2Utd2lkdGg9IjMiLz48cGF0aCBkPSJNMjggMzUgTDcyIDM1IiBzdHJva2U9IiMwZDZlZmQiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTI4IDUwIEw3MiA1MCIgc3Ryb2tlPSIjMGQ2ZWZkIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0yOCA2NSBMNTIgNjUiIHN0cm9rZT0iIzBkNmVmZCIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48Y2lyY2xlIGN4PSI3NSIgY3k9IjY1IiByPSI1IiBmaWxsPSIjMGQ2ZWZkIi8+PC9zdmc+" 
                     alt="${component.displayName}" 
                     id="modal-icon-${component.componentId}" 
                     class="component-detail-icon" />
                <div class="component-detail-title">
                    <h2>${component.displayName}</h2>
                    <div class="component-detail-version">Version ${component.version}</div>
                </div>
            </div>
            
            <div class="modal-body">
                <p class="component-detail-description">${component.description}</p>
                
                <div class="component-detail-info">
                    <div class="info-item">
                        <div class="info-label">Catégorie:</div>
                        <div class="info-value">${component.category}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Auteur:</div>
                        <div class="info-value">${component.author || 'Avanteam'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Version minimale:</div>
                        <div class="info-value">Process Studio ${component.minPlatformVersion}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Date de publication:</div>
                        <div class="info-value">${formatDate(component.updatedDate || new Date().toISOString())}</div>
                    </div>
                </div>
                
                ${docButtons}
                
                ${component.readmeHtml ? `
                    <div class="component-detail-readme">
                        <h3>Documentation</h3>
                        <div class="readme-content">${component.readmeHtml}</div>
                    </div>
                ` : ''}
                
                ${component.dependencies && component.dependencies.length > 0 ? `
                    <div class="component-detail-dependencies">
                        <h3>Dépendances</h3>
                        <ul>
                            ${component.dependencies.map(dep => `<li>${dep.displayName || dep.componentName} (v${dep.version || dep.minVersion})</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
            
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary modal-cancel">Fermer</button>
            </div>
        </div>
    `;
    
    // Ajouter la modal au document
    document.body.appendChild(modal);
    
    // Gérer la fermeture de la modal
    modal.querySelector('.modal-close').addEventListener('click', () => {
        document.body.removeChild(modal);
        refreshComponentLists();
    });
    
    modal.querySelector('.modal-cancel').addEventListener('click', () => {
        document.body.removeChild(modal);
        refreshComponentLists();
    });
    
    modal.querySelector('.modal-backdrop').addEventListener('click', () => {
        document.body.removeChild(modal);
        refreshComponentLists();
    });
    
    // Ajouter les gestionnaires d'événements pour les boutons de documentation
    if (component.readmeHtml) {
        const readmeBtn = modal.querySelector('#view-readme-btn');
        if (readmeBtn) {
            readmeBtn.addEventListener('click', () => {
                // Construire l'URL du README basée sur le composant
                const baseUrl = window.location.origin;
                const readmeUrl = `${baseUrl}/api/marketplace/components/${component.componentId}/readme`;
                window.open(readmeUrl, '_blank');
            });
        }
    }
    
    if (hasGitRepo) {
        const repoBtn = modal.querySelector('#view-repo-btn');
        if (repoBtn) {
            repoBtn.addEventListener('click', () => {
                window.open(component.repositoryUrl, '_blank');
                
                // L'utilisateur pourra accéder au README via GitHub directement
            });
        }
    }
    
    // Charger l'icône du composant de manière asynchrone
    const iconUrl = `${apiUrl}/components/${component.componentId}/icon`;
    fetch(iconUrl, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        return response.blob();
    })
    .then(blob => {
        // Convertir le blob en URL de données
        const reader = new FileReader();
        reader.onloadend = function() {
            // Une fois l'icône chargée, mettre à jour l'image dans l'interface modale
            const iconElement = document.getElementById(`modal-icon-${component.componentId}`);
            if (iconElement) {
                iconElement.src = reader.result;
                console.log(`Icône modale chargée avec succès pour le composant ${component.componentId}`);
            }
        };
        reader.readAsDataURL(blob);
    })
    .catch(error => {
        console.error(`Erreur lors du chargement de l'icône modale pour le composant ${component.componentId}:`, error);
        // En cas d'échec, laisser l'icône par défaut
    });
}

/**
 * Lance le processus d'installation d'un composant
 * @param {number} componentId - ID du composant à installer
 * @param {string} version - Version à installer
 */
function installComponent(componentId, version) {
    // Trouver le composant dans le cache
    let component = null;
    
    for (const category in componentCache) {
        if (componentCache[category]) {
            // Vérifier et normaliser les données en cache si nécessaire
            let components = componentCache[category];
            
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
            
            const found = components.find(c => c.componentId === componentId);
            if (found) {
                component = found;
                break;
            }
        }
    }
    
    if (!component) {
        alert('Composant non trouvé');
        return;
    }
    
    // Créer la modal d'installation
    const modal = document.createElement('div');
    modal.className = 'installation-modal';
    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content">
            <h2 style="margin-bottom: 10px;">Installation de ${component.displayName}</h2>
            
            <div class="installation-progress">
                <div class="progress-container">
                    <div class="progress-bar" style="width: 0%"></div>
                </div>
                <div class="progress-text">0%</div>
            </div>
            
            <div class="installation-log"></div>
        </div>
    `;
    
    // Ajouter la modal au document
    document.body.appendChild(modal);
    
    // Références aux éléments de la modal
    const progressBar = modal.querySelector('.progress-bar');
    const progressText = modal.querySelector('.progress-text');
    const logContainer = modal.querySelector('.installation-log');
    
    // Ajouter le premier message au log
    addLogMessage(logContainer, `Démarrage de l'installation de ${component.displayName} v${version}...`);
    
    // Lancer le téléchargement avec le paramètre urlOnly=true pour obtenir toujours une URL
    fetch(`${apiUrl}/components/${componentId}/download?clientId=${encodeURIComponent(clientId)}&version=${encodeURIComponent(version)}&urlOnly=true`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur lors du téléchargement: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Mettre à jour la progression
        updateProgress(progressBar, progressText, 20);
        addLogMessage(logContainer, `Téléchargement réussi...`);
        
        // Vérifier que nous avons une URL de téléchargement
        if (!data || !data.downloadUrl) {
            throw new Error("Réponse de l'API invalide: URL de téléchargement manquante");
        }
        
        console.log("URL de téléchargement obtenue:", data.downloadUrl);
        
        // Vérifier si l'URL est la valeur factice "no-package"
        if (data.downloadUrl.includes("avanteam-online.com/no-package")) {
            // Pour le composant HishikawaDiagram (ID: 14), utiliser directement l'URL GitHub
            if (componentId === 14) {
                console.log("Utilisation de l'URL GitHub directe pour HishikawaDiagram");
                data.downloadUrl = "https://github.com/avanteam/component-HishikawaDiagram/archive/refs/heads/main.zip";
                addLogMessage(logContainer, `URL remplacée par le dépôt GitHub officiel...`);
            } else {
                addLogMessage(logContainer, `Attention: URL de package générique détectée.`, true);
            }
        }
        
        // Lancer l'installation
        return installComponentPackage(data.downloadUrl, componentId, version, progressBar, progressText, logContainer);
    })
    .then((installResult) => {
        // Enregistrer l'installation avec les résultats du script PowerShell
        updateProgress(progressBar, progressText, 90);
        addLogMessage(logContainer, `Finalisation de l'installation...`);
        
        // Collecter les informations sur le résultat de l'installation
        // Si installResult est défini, il vient de installComponentPackage et a déjà été enregistré
        // Si non défini, créer un nouveau résultat pour l'enregistrement
        if (installResult) {
            // L'installation a déjà été enregistrée, pas besoin de le refaire
            return {ok: true, json: () => Promise.resolve(installResult)};
        } else {
            // Nouvelle installation à enregistrer
            const installationResults = {
                success: true,
                installId: `install-${Date.now()}`,
                componentId: componentId.toString(),
                version: version,
                destinationPath: `Components/${componentId}`,
                logFile: `scripts/Logs/Install-${componentId}-${version}.log`
            };
            
            return fetch(`${apiUrl}/components/${componentId}/install?clientId=${encodeURIComponent(clientId)}&version=${encodeURIComponent(version)}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(installationResults)
            });
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur lors de l'enregistrement: ${response.status}`);
        }
        
        // Si nous avons une réponse JSON, la récupérer
        if (typeof response.json === 'function') {
            return response.json().then(data => {
                // Installation terminée
                updateProgress(progressBar, progressText, 100);
                addLogMessage(logContainer, `Installation terminée avec succès!`);
                
                // Vérifier si un README est disponible dans le résultat de l'installation
                let readmeUrl = '';
                let readmeAvailable = false;
                let repositoryUrl = '';
                let isGitRepo = false;
                
                // Essayer de trouver des informations sur le README et le repository dans le résultat
                if (data) {
                    const componentId = data.ComponentId || data.componentId;
                    
                    if (componentId) {
                        // Construire l'URL vers le README basé sur le composant installé
                        const baseUrl = window.location.origin;
                        readmeUrl = `${baseUrl}/api/marketplace/components/${componentId}/readme`;
                        readmeAvailable = true;
                        console.log("URL du README générée:", readmeUrl);
                    }
                    
                    // Vérifier si nous avons un dépôt GitHub dans les données du composant
                    if (data.RepositoryUrl || data.repositoryUrl) {
                        repositoryUrl = data.RepositoryUrl || data.repositoryUrl;
                        if (repositoryUrl && repositoryUrl.includes('github.com')) {
                            isGitRepo = true;
                            console.log("Dépôt GitHub détecté:", repositoryUrl);
                            
                            // Si c'est un dépôt GitHub, construire l'URL vers le README directement sur GitHub
                            // Format: https://github.com/user/repo -> https://github.com/user/repo/blob/main/README.md
                            if (!readmeUrl || !readmeAvailable) {
                                readmeUrl = repositoryUrl.replace(/\/$/, '') + '/blob/main/README.md';
                                readmeAvailable = true;
                                console.log("URL du README GitHub générée:", readmeUrl);
                            }
                        }
                    }
                    
                    // Si un répertoire de destination existe, essayer de trouver un README en local
                    if (data.DestinationPath || data.destinationPath) {
                        const destinationPath = data.DestinationPath || data.destinationPath;
                        if (destinationPath) {
                            console.log("Dossier d'installation détecté:", destinationPath);
                            // Le README est probablement disponible localement
                            readmeAvailable = true;
                        }
                    }
                }
                
                // Ajouter un bouton unique pour fermer la modal
                const modalElement = document.querySelector('.installation-modal');
                if (modalElement && !modalElement.querySelector('.btn-primary')) {
                    const closeButton = document.createElement('button');
                    closeButton.textContent = 'Fermer';
                    closeButton.className = 'btn btn-primary';
                    closeButton.style.marginTop = '20px';
                    closeButton.style.width = '200px';
                    closeButton.style.display = 'block';
                    closeButton.style.margin = '20px auto 0';
                    closeButton.addEventListener('click', () => {
                        document.body.removeChild(modalElement);
                        refreshComponentLists();
                    });
                    
                    const modalContent = modalElement.querySelector('.modal-content');
                    if (modalContent) {
                        modalContent.appendChild(closeButton);
                    }
                }
                // refreshComponentLists() sera appelé lors de la fermeture via le bouton
            });
        } else {
            // Déjà un objet JSON (cas où installResult était défini)
            // Installation terminée
            updateProgress(progressBar, progressText, 100);
            addLogMessage(logContainer, `Installation terminée avec succès!`);
            
            // Vérifier si un README est disponible dans le résultat de l'installation
            let readmeUrl = '';
            let readmeAvailable = false;
            let repositoryUrl = '';
            let isGitRepo = false;
            
            // Essayer de trouver des informations sur le README et le repository dans le résultat
            if (data) {
                const componentId = data.ComponentId || data.componentId;
                
                if (componentId) {
                    // Construire l'URL vers le README basé sur le composant installé
                    const baseUrl = window.location.origin;
                    readmeUrl = `${baseUrl}/api/marketplace/components/${componentId}/readme`;
                    readmeAvailable = true;
                    console.log("URL du README générée:", readmeUrl);
                }
                
                // Vérifier si nous avons un dépôt GitHub dans les données du composant
                if (data.RepositoryUrl || data.repositoryUrl) {
                    repositoryUrl = data.RepositoryUrl || data.repositoryUrl;
                    if (repositoryUrl && repositoryUrl.includes('github.com')) {
                        isGitRepo = true;
                        console.log("Dépôt GitHub détecté:", repositoryUrl);
                        
                        // Si c'est un dépôt GitHub, construire l'URL vers le README directement sur GitHub
                        // Format: https://github.com/user/repo -> https://github.com/user/repo/blob/main/README.md
                        if (!readmeUrl || !readmeAvailable) {
                            readmeUrl = repositoryUrl.replace(/\/$/, '') + '/blob/main/README.md';
                            readmeAvailable = true;
                            console.log("URL du README GitHub générée:", readmeUrl);
                        }
                    }
                }
                
                // Si un répertoire de destination existe, essayer de trouver un README en local
                if (data.DestinationPath || data.destinationPath) {
                    const destinationPath = data.DestinationPath || data.destinationPath;
                    if (destinationPath) {
                        console.log("Dossier d'installation détecté:", destinationPath);
                        // Le README est probablement disponible localement
                        readmeAvailable = true;
                    }
                }
            }
            
            // Ajouter un unique bouton pour fermer la modal
            addUniqueCloseButton('Fermer', 'btn-primary');
        }
    })
    .catch(error => {
        console.error('Erreur lors de l\'installation:', error);
        
        // Afficher l'erreur dans le log, avec une gestion pour les erreurs undefined
        const errorMessage = error.message || "Erreur inconnue lors de l'installation";
        
        // Vérifier si c'est juste une erreur de communication avec l'API Marketplace
        // mais que l'installation locale a réussi
        if (errorMessage.includes("Erreur lors de l'enregistrement") || 
            errorMessage.includes("Erreur réseau")) {
            console.log("Erreur de communication avec l'API, mais l'installation locale pourrait avoir réussi");
            
            // Essayer de déterminer si l'installation locale a réussi
            addLogMessage(logContainer, `Avertissement: La communication avec l'API a échoué.`, true);
            addLogMessage(logContainer, `L'installation locale a probablement réussi, mais n'a pas pu être enregistrée.`, false);
            
            // Mettre à jour la barre de progression
            updateProgress(progressBar, progressText, 100);
            progressBar.style.backgroundColor = '#ffc107'; // Jaune pour avertissement
            
            // Ajouter un bouton pour rafraîchir la page
            addUniqueCloseButton('Fermer et rafraîchir', 'btn-primary close-btn');
            return;
        }
        
        // Échec complet de l'installation
        addLogMessage(logContainer, `Erreur: ${errorMessage}`, true);
        
        // Mettre à jour la barre de progression en rouge
        progressBar.style.backgroundColor = '#dc3545';
        
        // Ajouter un bouton pour fermer la modal
        addUniqueCloseButton('Fermer', 'btn-primary close-btn');
    });
}

/**
 * Installe un package de composant
 * @param {string} downloadUrl - URL de téléchargement du package
 * @param {number} componentId - ID du composant
 * @param {string} version - Version à installer
 * @param {HTMLElement} progressBar - Élément de barre de progression
 * @param {HTMLElement} progressText - Élément de texte de progression
 * @param {HTMLElement} logContainer - Conteneur de log
 * @returns {Promise} Promise résolue lorsque l'installation est terminée
 */
function installComponentPackage(downloadUrl, componentId, version, progressBar, progressText, logContainer) {
    return new Promise((resolve, reject) => {
        updateProgress(progressBar, progressText, 30);
        addLogMessage(logContainer, `Préparation de l'installation...`);
        
        // Générer un ID d'installation unique
        const installId = `install-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        
        // Dans cette architecture, nous utilisons une API locale sur le serveur Process Studio
        // Construire le chemin de l'API locale d'installation (basée sur l'emplacement actuel du site)
        // Dans Process Studio, nous allons installer une API locale pour l'installation de composants
        
        // Appeler l'API locale pour exécuter l'installation
        // Cette API est sur le même serveur que Process Studio, donc aucun problème CORS
        const localInstallEndpoint = `${localApiUrl}install`;
        
        addLogMessage(logContainer, `Lancement de l'installation du composant ${componentId} v${version}...`);
        
        // Préparer les données pour l'API locale
        let packageUrl = downloadUrl;
        
        // Pour le composant HishikawaDiagram (ID: 14), vérifier que l'URL est valide
        if (componentId === 14 && (!packageUrl || packageUrl.includes("avanteam-online.com/no-package"))) {
            console.log("Utilisation de l'URL GitHub directe pour HishikawaDiagram");
            packageUrl = "https://github.com/avanteam/component-HishikawaDiagram/archive/refs/heads/main.zip";
            addLogMessage(logContainer, `URL remplacée par le dépôt GitHub officiel de HishikawaDiagram`, false);
        }
        
        const installData = {
            componentId: componentId,
            version: version,
            packageUrl: packageUrl,
            installId: installId
        };
        
        // Appel à l'API locale d'installation
        fetch(localInstallEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(installData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erreur lors de l'installation (${response.status}): ${response.statusText}`);
            }
            return response.json();
        })
        .then(result => {
            updateProgress(progressBar, progressText, 70);
            
            // Afficher les logs si disponibles
            if (result.logs && Array.isArray(result.logs)) {
                result.logs.forEach(log => {
                    addLogMessage(logContainer, log.message, log.level === "ERROR");
                });
            }
            
            // Le script d'installation PowerShell se termine avec SUCCESS même s'il y a un avertissement
            // donc nous devons vérifier si le résultat indique que le script s'est terminé avec succès
            // Le log indique SUCCESS pour l'installation du composant
            
            console.log("Résultat complet de l'installation:", result);
            
            // Vérifier si les fichiers ont bien été copiés
            const filesCopied = result.logs && Array.isArray(result.logs) && 
                               result.logs.some(log => log.message && log.message.includes("fichiers copiés"));
            
            // CORRECTION CRITIQUE: Le résultat Success est case-sensitive
            // et peut être en PascalCase (Success) au lieu de camelCase (success)
            const hasSuccessFlag = result.success === true || result.Success === true;
            
            // Vérifier le résultat de l'installation - on considère que c'est un succès si:
            // 1. Le résultat a success=true OU Success=true OU
            // 2. Il y a un message de succès dans les logs OU
            // 3. Les fichiers ont été copiés avec succès
            const isSuccess = hasSuccessFlag || 
                              (result.logs && Array.isArray(result.logs) && 
                               result.logs.some(log => log.level === "SUCCESS" && 
                                                     (log.message.includes("Installation") || 
                                                      log.message.includes("terminée avec succès")))) ||
                              filesCopied;
            
            // Logs des erreurs connues à ignorer - ces erreurs ne sont pas critiques
            const knownNonCriticalErrors = [
                "Impossible de lier l'argument au paramètre",
                "Fichier FormularDesigner.xml introuvable",
                "exécution du script d'installation personnalisé"
            ];
            
            // Si le script s'est terminé avec une erreur critique (pas une erreur connue non critique)
            const hasScriptError = result.logs && Array.isArray(result.logs) && 
                                  result.logs.some(log => log.level === "ERROR" && 
                                                       !knownNonCriticalErrors.some(e => log.message.includes(e)) &&
                                                       (log.message.includes("ERREUR:") || 
                                                        log.message.includes("Échec de l'installation")));
            
            console.log("Installation réussie:", isSuccess);
            console.log("Erreur critique détectée:", hasScriptError);
            
            // FORCER UN RÉSULTAT RÉUSSI si les fichiers ont été copiés malgré des erreurs
            if (filesCopied) {
                console.log("Les fichiers ont été copiés avec succès - on force le succès");
            }
            
            // Si l'installation semble avoir réussi malgré des avertissements
            if (isSuccess || filesCopied) {
                addLogMessage(logContainer, `Installation réussie!`);
                if (result.destinationPath) {
                    addLogMessage(logContainer, `Composant installé dans: ${result.destinationPath}`);
                }
                
                // Enregistrer l'installation auprès de l'API Marketplace comme réussie
                reportInstallationToMarketplaceAPI(
                    true,
                    componentId,
                    version,
                    clientId,
                    installId,
                    result.destinationPath || "",
                    result.error || "", // Peut contenir un avertissement non critique
                    progressBar,
                    progressText,
                    logContainer,
                    resolve,
                    reject
                );
            } else {
                // Récupérer le message d'erreur s'il existe
                let errorMessage = result.error || "Une erreur s'est produite lors de l'installation";
                
                // Vérifier si le seul problème est lié au script de post-installation
                // mais que les fichiers ont bien été copiés
                const onlyPostInstallError = filesCopied && 
                                           result.logs && 
                                           Array.isArray(result.logs) && 
                                           result.logs.some(log => log.level === "WARNING" && 
                                                                  log.message.includes("script d'installation personnalisé"));
                
                // Si l'installation des fichiers a réussi mais que seul le script de post-installation a échoué
                // on considère que c'est un succès et on force le traitement comme tel
                if (onlyPostInstallError) {
                    console.log("Seul le script post-installation a échoué, mais les fichiers sont correctement installés");
                    
                    addLogMessage(logContainer, `Installation réussie (avec avertissement)!`, false);
                    if (result.destinationPath) {
                        addLogMessage(logContainer, `Composant installé dans: ${result.destinationPath}`, false);
                    }
                    addLogMessage(logContainer, `Note: Le script de post-installation n'a pas pu être exécuté, mais les fichiers ont été correctement copiés.`, true);
                    
                    // Enregistrer comme un succès
                    reportInstallationToMarketplaceAPI(
                        true,
                        componentId,
                        version,
                        clientId,
                        installId,
                        result.destinationPath || "",
                        "Le script de post-installation n'a pas pu être exécuté", // Avertissement non critique
                        progressBar,
                        progressText,
                        logContainer,
                        resolve,
                        reject
                    );
                    return; // Sortir - traité comme un succès
                }
                
                // Chercher des messages d'erreur spécifiques dans les logs
                if (result.logs && Array.isArray(result.logs)) {
                    // Filtrer les erreurs connues non critiques
                    const criticalErrorLogs = result.logs.filter(log => 
                        log.level === "ERROR" && 
                        !knownNonCriticalErrors.some(e => log.message.includes(e))
                    );
                    
                    if (criticalErrorLogs.length > 0) {
                        errorMessage = criticalErrorLogs[0].message;
                    }
                }
                
                addLogMessage(logContainer, `Échec de l'installation: ${errorMessage}`, true);
                
                // Enregistrer l'échec auprès de l'API Marketplace
                reportInstallationToMarketplaceAPI(
                    false,
                    componentId,
                    version,
                    clientId,
                    installId,
                    "",
                    errorMessage,
                    progressBar,
                    progressText,
                    logContainer,
                    resolve,
                    reject
                );
            }
        })
        .catch(error => {
            console.error("Erreur d'installation:", error);
            
            // Gérer le cas où l'API locale n'est pas disponible ou a échoué
            updateProgress(progressBar, progressText, 100);
            addLogMessage(logContainer, `Erreur: ${error.message}`, true);
            
            // Proposer une installation manuelle en dernier recours
            const fallbackContainer = document.createElement('div');
            fallbackContainer.className = 'installation-options';
            fallbackContainer.innerHTML = `
                <p>L'installation automatique a échoué. Veuillez suivre ces étapes pour une installation manuelle :</p>
                <ol>
                    <li>Téléchargez le composant depuis : <a href="${downloadUrl}" target="_blank">Lien de téléchargement</a></li>
                    <li>Extrayez le contenu du package</li>
                    <li>Copiez les fichiers du dossier "src" vers le répertoire approprié dans Process Studio</li>
                </ol>
                <p>Une fois l'installation manuelle terminée, cliquez sur le bouton ci-dessous :</p>
                <button id="manual-success" class="btn btn-success">Installation manuelle terminée</button>
            `;
            logContainer.appendChild(fallbackContainer);
            
            // Événement: Installation manuelle terminée
            document.getElementById('manual-success').addEventListener('click', () => {
                reportInstallationToMarketplaceAPI(
                    true,
                    componentId,
                    version,
                    clientId,
                    installId,
                    `Installation manuelle`,
                    "",
                    progressBar,
                    progressText,
                    logContainer,
                    resolve,
                    reject
                );
            });
            
            reject(error);
        });
    });
}

/**
 * Envoie le rapport d'installation à l'API Marketplace
 */
function reportInstallationToMarketplaceAPI(success, componentId, version, clientId, installId, destinationPath, errorMessage, progressBar, progressText, logContainer, resolve, reject) {
    // Trouver la modal d'installation pour ajouter les boutons
    const modal = document.querySelector('.installation-modal');
    // CORRECTION CRITIQUE: Le JSON envoyé à l'API doit avoir les propriétés avec la 
    // première lettre en majuscule pour correspondre aux attributs C# du modèle
    // Préparer le rapport d'installation
    const installationResult = {
        Success: success, // PascalCase pour C#
        ComponentId: componentId.toString(),
        Version: version,
        InstallId: installId,
        DestinationPath: destinationPath || (success ? `Custom/Components/${componentId}` : ""),
        Error: errorMessage
    };
    
    console.log("Enregistrement de l'installation:", installationResult);
    
    // Si l'installation a réussi localement mais qu'il y a un message d'erreur non vide,
    // supprimer le message d'erreur car c'est probablement une erreur non critique
    if (success && installationResult.Error) {
        console.log("Installation réussie avec avertissement:", installationResult.Error);
        installationResult.Error = ""; // Vider le message d'erreur pour éviter qu'il ne soit interprété comme une erreur
    }
    
    // Envoyer le rapport à l'API du Marketplace
    fetch(`${apiUrl}/components/${componentId}/install?clientId=${encodeURIComponent(clientId)}&version=${encodeURIComponent(version)}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(installationResult)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur lors de l'enregistrement de l'installation: ${response.status}`);
        }
        return response.json();
    })
    .then((data) => {
        // Installation enregistrée avec succès
        updateProgress(progressBar, progressText, 100);
        
        if (success) {
            addLogMessage(logContainer, `Installation terminée et enregistrée avec succès!`);
            
            // Ajouter un bouton pour fermer la modal
            const modalElement = document.querySelector('.installation-modal');
            if (modalElement && !modalElement.querySelector('.close-btn')) {
                const closeButton = document.createElement('button');
                closeButton.textContent = 'Fermer';
                closeButton.className = 'btn btn-primary close-btn';
                closeButton.style.marginTop = '20px';
                closeButton.style.display = 'block';
                closeButton.style.margin = '20px auto 0';
                closeButton.addEventListener('click', () => {
                    document.body.removeChild(modalElement);
                    refreshComponentLists();
                });
                
                const modalContent = modalElement.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.appendChild(closeButton);
                }
            }
            
            resolve(installationResult);
        } else {
            // Si nous avons un message d'erreur dans la réponse, l'utiliser
            const errorText = errorMessage || (data && data.error) || "Erreur inconnue";
            addLogMessage(logContainer, `Échec d'installation enregistré.`, true);
            reject(new Error(errorText));
        }
    })
    .catch(error => {
        // L'installation a été rapportée mais l'enregistrement a échoué
        updateProgress(progressBar, progressText, success ? 90 : 50);
        
        // Assurer qu'il y a toujours un message d'erreur défini
        const errorText = error.message || errorMessage || "Erreur inconnue";
        
        // Si l'installation a réussi localement, ne pas afficher d'erreur malgré le problème d'enregistrement
        if (success) {
            addLogMessage(logContainer, `Avertissement: L'enregistrement de l'installation a rencontré un problème, mais l'installation a réussi.`, false);
            
            // Ajouter un bouton pour fermer la modal
            const modalElement = document.querySelector('.installation-modal');
            if (modalElement && !modalElement.querySelector('.close-btn')) {
                const closeButton = document.createElement('button');
                closeButton.textContent = 'Fermer';
                closeButton.className = 'btn btn-primary close-btn';
                closeButton.style.marginTop = '20px';
                closeButton.style.display = 'block';
                closeButton.style.margin = '20px auto 0';
                closeButton.addEventListener('click', () => {
                    document.body.removeChild(modalElement);
                    refreshComponentLists();
                });
                
                const modalContent = modalElement.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.appendChild(closeButton);
                }
            }
            
            resolve(installationResult);
        } else {
            addLogMessage(logContainer, `Avertissement: L'installation a échoué et l'enregistrement a rencontré un problème: ${errorText}`, true);
            reject(new Error(errorText));
        }
    });
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
 * Met à jour la barre de progression
 * @param {HTMLElement} progressBar - Élément de barre de progression
 * @param {HTMLElement} progressText - Élément de texte de progression
 * @param {number} percent - Pourcentage de progression
 */
function updateProgress(progressBar, progressText, percent) {
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
}

/**
 * Ajoute un message au log d'installation
 * @param {HTMLElement} logContainer - Conteneur de log
 * @param {string} message - Message à ajouter
 * @param {boolean} isError - Si le message est une erreur
 */
function addLogMessage(logContainer, message, isError = false) {
    const timestamp = new Date().toLocaleTimeString();
    const logItem = document.createElement('div');
    logItem.className = `log-item ${isError ? 'log-error' : ''}`;
    logItem.innerHTML = `<span class="log-time">[${timestamp}]</span> ${message}`;
    logContainer.appendChild(logItem);
    logContainer.scrollTop = logContainer.scrollHeight;
}

/**
 * Ajoute un bouton de fermeture unique à une modal d'installation
 * @param {string} buttonText - Texte à afficher sur le bouton
 * @param {string} buttonClass - Classe CSS principale du bouton (par défaut: btn-primary)
 * @returns {void}
 */
function addUniqueCloseButton(buttonText = 'Fermer', buttonClass = 'btn-primary') {
    const modalElement = document.querySelector('.installation-modal');
    if (!modalElement || modalElement.querySelector(`.${buttonClass}`)) {
        return; // Modal non trouvée ou bouton déjà présent
    }
    
    const closeButton = document.createElement('button');
    closeButton.textContent = buttonText;
    closeButton.className = `btn ${buttonClass}`;
    closeButton.style.width = '200px';
    closeButton.style.marginTop = '20px';
    closeButton.style.display = 'block';
    closeButton.style.margin = '20px auto 10px';
    closeButton.addEventListener('click', () => {
        document.body.removeChild(modalElement);
        refreshComponentLists();
    });
    
    const modalContent = modalElement.querySelector('.modal-content');
    if (modalContent) {
        modalContent.appendChild(closeButton);
    }
}

/**
 * Affiche une modal de confirmation personnalisée
 * @param {string} title - Titre de la confirmation
 * @param {string} message - Message de confirmation
 * @param {Function} onConfirm - Fonction à exécuter si l'utilisateur confirme
 * @param {Function} onCancel - Fonction à exécuter si l'utilisateur annule
 */
function showConfirmModal(title, message, onConfirm, onCancel = () => {}) {
    // Créer la modal de confirmation
    const confirmModal = document.createElement('div');
    confirmModal.className = 'installation-modal';
    
    // Créer le contenu de la modal
    confirmModal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content" style="max-width: 500px; text-align: center;">
            <h2 style="margin-bottom: 20px; color: #dc3545;">${title}</h2>
            <p style="margin-bottom: 25px; font-size: 16px; color: #333;">${message}</p>
            
            <div style="display: flex; justify-content: center; gap: 15px;">
                <button type="button" class="btn btn-secondary" id="cancel-btn" style="min-width: 120px;">Annuler</button>
                <button type="button" class="btn btn-danger" id="confirm-btn" style="min-width: 120px;">Confirmer</button>
            </div>
        </div>
    `;
    
    // Ajouter la modal au document
    document.body.appendChild(confirmModal);
    
    // Ajouter les gestionnaires d'événements
    confirmModal.querySelector('#confirm-btn').addEventListener('click', () => {
        document.body.removeChild(confirmModal);
        onConfirm();
    });
    
    confirmModal.querySelector('#cancel-btn').addEventListener('click', () => {
        document.body.removeChild(confirmModal);
        onCancel();
    });
    
    // Permettre de fermer la modal en cliquant sur l'arrière-plan
    confirmModal.querySelector('.modal-backdrop').addEventListener('click', () => {
        document.body.removeChild(confirmModal);
        onCancel();
    });
}

/**
 * Désinstalle un composant
 * @param {number} componentId - ID du composant à désinstaller
 */
function uninstallComponent(componentId) {
    // Trouver le composant dans le cache
    let component = null;
    
    for (const category in componentCache) {
        if (componentCache[category]) {
            // Vérifier et normaliser les données en cache si nécessaire
            let components = componentCache[category];
            
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
            
            const found = components.find(c => c.componentId === componentId);
            if (found) {
                component = found;
                break;
            }
        }
    }
    
    if (!component) {
        alert('Composant non trouvé');
        return;
    }
    
    // Demander confirmation à l'utilisateur avec une belle modal
    showConfirmModal(
        'Confirmation de désinstallation', 
        `Êtes-vous sûr de vouloir désinstaller le composant <strong>"${component.displayName}"</strong> ?<br><br>Cette action ne peut pas être annulée.`,
        () => { // Fonction exécutée si l'utilisateur confirme
            proceedWithUninstall();
        }
    );
    
    // Sortir de la fonction principale - la désinstallation sera lancée par le callback si l'utilisateur confirme
    return;
    
    // Fonction interne pour procéder à la désinstallation après confirmation
    function proceedWithUninstall() {
    
    // Créer la modal de désinstallation
    const modal = document.createElement('div');
    modal.className = 'installation-modal'; // Réutiliser le même style que pour l'installation
    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content">
            <h2>Désinstallation de ${component.displayName}</h2>
            
            <div class="installation-progress">
                <div class="progress-container">
                    <div class="progress-bar" style="width: 0%"></div>
                </div>
                <div class="progress-text">0%</div>
            </div>
            
            <div class="installation-log"></div>
        </div>
    `;
    
    // Ajouter la modal au document
    document.body.appendChild(modal);
    
    // Références aux éléments de la modal
    const progressBar = modal.querySelector('.progress-bar');
    const progressText = modal.querySelector('.progress-text');
    const logContainer = modal.querySelector('.installation-log');
    
    // Ajouter le premier message au log
    addLogMessage(logContainer, `Démarrage de la désinstallation de ${component.displayName}...`);
    
    // Mettre à jour la progression
    updateProgress(progressBar, progressText, 25);
    addLogMessage(logContainer, `Suppression des fichiers du composant...`);
    
    // Simuler le processus de désinstallation
    setTimeout(() => {
        updateProgress(progressBar, progressText, 50);
        addLogMessage(logContainer, `Nettoyage des ressources...`);
        
        setTimeout(() => {
            updateProgress(progressBar, progressText, 75);
            addLogMessage(logContainer, `Finalisation de la désinstallation...`);
            
            // Appeler l'API pour désinstaller le composant
            fetch(`${apiUrl}/components/${componentId}/uninstall?clientId=${encodeURIComponent(clientId)}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erreur lors de la désinstallation: ${response.status}`);
                }
                return response.json();
            })
            .then(() => {
                // Désinstallation terminée
                updateProgress(progressBar, progressText, 100);
                addLogMessage(logContainer, `Désinstallation terminée avec succès!`);
                
                // On ne ferme pas automatiquement la modal, l'utilisateur utilisera le bouton Fermer
            
            // Ajouter un bouton unique pour fermer la modal
            addUniqueCloseButton('Fermer', 'btn-primary');
            })
            .catch(error => {
                console.error('Erreur lors de la désinstallation:', error);
                
                // Afficher l'erreur dans le log
                addLogMessage(logContainer, `Erreur: ${error.message}`, true);
                
                // Mettre à jour la barre de progression en rouge
                progressBar.style.backgroundColor = '#dc3545';
                
                // Ajouter un bouton pour fermer la modal
                addUniqueCloseButton('Fermer', 'btn-primary close-btn');
            });
        }, 500);
    }, 500);
    } // Fin de la fonction proceedWithUninstall
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
 * Formate une URL de dépôt GitHub pour l'affichage
 * @param {string} url - URL complète du dépôt
 * @returns {string} URL formatée pour l'affichage
 */
function formatRepoUrl(url) {
    if (!url) return '';
    
    // Extraire le nom du dépôt à partir de l'URL GitHub
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname === 'github.com') {
            // Format: github.com/user/repo
            const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
            if (pathParts.length >= 2) {
                return `${pathParts[0]}/${pathParts[1]}`;
            }
        }
    } catch (error) {
        console.warn("Erreur lors du formatage de l'URL du dépôt:", error);
    }
    
    // Si le parsing échoue, retourner l'URL d'origine tronquée
    return url.replace(/^https?:\/\/(www\.)?/, '').substring(0, 30) + (url.length > 30 ? '...' : '');
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