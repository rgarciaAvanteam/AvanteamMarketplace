/**
 * marketplace-components.js - Gestion de l'affichage des composants
 * Gère le rendu et les détails des composants
 */

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
                    <div class="component-title-wrapper">
                        <h3 class="component-name">${component.displayName}</h3>
                        ${component.isInstalled ? `<button type="button" class="btn-icon help-icon" title="Voir la documentation" data-id="${component.componentId}" onclick="showComponentReadme(${component.componentId})"><i class="fas fa-question-circle"></i></button>` : ''}
                    </div>
                    <p class="component-description">${component.description}</p>
                    <div class="component-meta">
                        <span class="component-version">v${component.isInstalled && component.installedVersion ? component.installedVersion : component.version}</span>
                        <span class="component-category">${component.category}</span>
                        ${component.isInstalled && component.hasUpdate ? '<span class="component-update-badge">Mise à jour disponible</span>' : ''}
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
        
        // Fusionner les informations en préservant isInstalled, hasUpdate et installedVersion du composant de base
        const isInstalled = component.isInstalled;
        const hasUpdate = component.hasUpdate;
        const installedVersion = component.installedVersion;
        
        const fullComponent = { 
            ...component, 
            ...detailedComponent,
            isInstalled: isInstalled === undefined ? detailedComponent.isInstalled : isInstalled,
            hasUpdate: hasUpdate === undefined ? detailedComponent.hasUpdate : hasUpdate,
            installedVersion: installedVersion === undefined ? detailedComponent.installedVersion : installedVersion
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
                    <div class="component-detail-version">
                        Version ${component.isInstalled && component.installedVersion ? component.installedVersion : component.version}
                        ${component.isInstalled && component.hasUpdate ? '<span class="component-update-badge">Mise à jour disponible (v' + component.version + ')</span>' : ''}
                    </div>
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
                ${component.repositoryUrl ? `
                    <a href="${component.repositoryUrl}" target="_blank" class="btn btn-github">
                        <svg style="width:16px;height:16px;margin-right:6px" viewBox="0 0 24 24"><path fill="currentColor" d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z" /></svg> GitHub
                    </a>
                ` : ''}
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
 * Affiche le fichier Readme.html d'un composant installé
 * @param {number} componentId - ID du composant
 */
function showComponentReadme(componentId) {
    // Trouver le composant dans le cache pour vérifier s'il est installé
    let component = null;
    
    for (const category in componentCache) {
        if (componentCache[category]) {
            let components = componentCache[category];
            
            // Normaliser les données si nécessaire
            if (!Array.isArray(components)) {
                if (components.$values && Array.isArray(components.$values)) {
                    components = components.$values;
                } else if (components.components && Array.isArray(components.components)) {
                    components = components.components;
                } else if (components.components && components.components.$values && Array.isArray(components.components.$values)) {
                    components = components.components.$values;
                } else if (components.items && Array.isArray(components.items)) {
                    components = components.items;
                } else if (components.data && Array.isArray(components.data)) {
                    components = components.data;
                } else {
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
    
    if (!component || !component.isInstalled) {
        alert('Ce composant n\'est pas installé ou n\'existe pas');
        return;
    }
    
    // Construire le chemin vers le fichier ReadMe.html
    // Récupérer la variable BaseSite depuis window.top (frame parent)
    let basePath = '/';
    
    try {
        // Tentative d'accès à la variable BaseSite du parent
        if (window.top && typeof window.top.BaseSite !== 'undefined') {
            basePath = window.top.BaseSite;
            console.log("Utilisation de window.top.BaseSite:", basePath);
        }
    } catch (e) {
        console.error("Erreur lors de l'accès à window.top.BaseSite:", e);
    }
    
    // Supprimer le slash final s'il existe pour éviter les doubles slashes
    if (basePath.endsWith('/')) {
        basePath = basePath.slice(0, -1);
    }
    
    // Le chemin est {basePath}/Custom/MarketPlace/Components/{componentId}/ReadMe.html
    const readmeUrl = `${basePath}/Custom/MarketPlace/Components/${componentId}/ReadMe.html`;
    
    console.log(`Ouverture du fichier ReadMe: ${readmeUrl}`);
    
    // Ouvrir le fichier ReadMe dans une nouvelle fenêtre ou un nouvel onglet
    window.open(readmeUrl, `readme_${componentId}`, 'width=800,height=600,scrollbars=yes');
}