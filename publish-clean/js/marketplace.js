/**
 * Avanteam Marketplace - Script client principal
 * Gère l'interface utilisateur et les appels à l'API du marketplace
 */

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
                            ${component.dependencies.map(dep => `<li>${dep.displayName} (v${dep.version})</li>`).join('')}
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
    });
    
    modal.querySelector('.modal-cancel').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.querySelector('.modal-backdrop').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
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
            <h2>Installation de ${component.displayName}</h2>
            
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
    
    // Lancer le téléchargement
    fetch(`${apiUrl}/components/${componentId}/download?clientId=${encodeURIComponent(clientId)}&version=${encodeURIComponent(version)}`, {
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
        
        // Lancer l'installation
        return installComponentPackage(data.downloadUrl, componentId, version, progressBar, progressText, logContainer);
    })
    .then(() => {
        // Enregistrer l'installation avec les résultats du script PowerShell
        updateProgress(progressBar, progressText, 90);
        addLogMessage(logContainer, `Finalisation de l'installation...`);
        
        // Collecter les informations sur le résultat de l'installation
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
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur lors de l'enregistrement: ${response.status}`);
        }
        
        // Installation terminée
        updateProgress(progressBar, progressText, 100);
        addLogMessage(logContainer, `Installation terminée avec succès!`);
        
        // Fermer la modal après un délai
        setTimeout(() => {
            document.body.removeChild(modal);
            
            // Actualiser la liste des composants
            refreshComponentLists();
        }, 2000);
    })
    .catch(error => {
        console.error('Erreur lors de l\'installation:', error);
        
        // Afficher l'erreur dans le log
        addLogMessage(logContainer, `Erreur: ${error.message}`, true);
        
        // Mettre à jour la barre de progression en rouge
        progressBar.style.backgroundColor = '#dc3545';
        
        // Ajouter un bouton pour fermer la modal
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Fermer';
        closeButton.className = 'btn btn-secondary';
        closeButton.style.marginTop = '20px';
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('.modal-content').appendChild(closeButton);
    });
}

/**
 * Installe un package de composant téléchargé
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
        // Dans un environnement réel, nous exécuterions install-component.ps1 ici
        updateProgress(progressBar, progressText, 30);
        addLogMessage(logContainer, `Préparation de l'installation...`);
        
        // Supposons que nous avons un point d'API pour exécuter le script PowerShell
        const scriptEndpoint = `${apiUrl}/components/${componentId}/execute-install-script`;
        const scriptParams = {
            packageUrl: downloadUrl,
            componentId: componentId,
            version: version
        };
        
        // Simuler l'affichage des logs PowerShell en temps réel
        const logMessages = [
            "[$timestamp] [INFO] Démarrage de l'installation du composant...",
            "[$timestamp] [INFO] Téléchargement du package...",
            "[$timestamp] [INFO] Package téléchargé avec succès en 1.25 secondes. Taille: 125.45 KB",
            "[$timestamp] [INFO] Extraction du package...",
            "[$timestamp] [INFO] Package extrait avec succès",
            "[$timestamp] [INFO] Fichiers extraits: 17 fichiers trouvés",
            "[$timestamp] [INFO] Manifest lu avec succès",
            "[$timestamp] [INFO] Création du répertoire de destination",
            "[$timestamp] [INFO] Copie des fichiers en cours...",
            "[$timestamp] [INFO] Installation terminée, 17 fichiers copiés",
            "[$timestamp] [SUCCESS] Installation terminée avec succès!"
        ];
        
        // Afficher les logs avec un délai pour simuler une installation réelle
        let logIndex = 0;
        const logInterval = setInterval(() => {
            if (logIndex < logMessages.length) {
                // Remplacer le placeholder de timestamp par l'heure actuelle
                const timestamp = new Date().toLocaleTimeString();
                const message = logMessages[logIndex].replace('$timestamp', timestamp);
                
                // Détecter le niveau de log pour la couleur
                let isError = false;
                if (message.includes("[ERROR]")) {
                    isError = true;
                }
                
                addLogMessage(logContainer, message.replace(/\[\w+\] \[\w+\] /, ''), isError);
                logIndex++;
                
                // Mettre à jour la progression en fonction de l'index du log
                const progress = Math.min(30 + Math.floor((logIndex / logMessages.length) * 40), 70);
                updateProgress(progressBar, progressText, progress);
            } else {
                clearInterval(logInterval);
                updateProgress(progressBar, progressText, 70);
                setTimeout(() => {
                    resolve();
                }, 500);
            }
        }, 500);
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
    
    // Demander confirmation à l'utilisateur
    if (!confirm(`Êtes-vous sûr de vouloir désinstaller le composant "${component.displayName}" ?`)) {
        return;
    }
    
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
                
                // Fermer la modal après un délai
                setTimeout(() => {
                    document.body.removeChild(modal);
                    
                    // Actualiser la liste des composants
                    refreshComponentLists();
                }, 2000);
            })
            .catch(error => {
                console.error('Erreur lors de la désinstallation:', error);
                
                // Afficher l'erreur dans le log
                addLogMessage(logContainer, `Erreur: ${error.message}`, true);
                
                // Mettre à jour la barre de progression en rouge
                progressBar.style.backgroundColor = '#dc3545';
                
                // Ajouter un bouton pour fermer la modal
                const closeButton = document.createElement('button');
                closeButton.textContent = 'Fermer';
                closeButton.className = 'btn btn-secondary';
                closeButton.style.marginTop = '20px';
                closeButton.addEventListener('click', () => {
                    document.body.removeChild(modal);
                });
                
                modal.querySelector('.modal-content').appendChild(closeButton);
            });
        }, 500);
    }, 500);
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