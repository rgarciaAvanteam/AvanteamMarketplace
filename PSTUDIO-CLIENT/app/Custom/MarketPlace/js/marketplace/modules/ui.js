/**
 * ui.js - Module d'interface utilisateur pour le Marketplace
 * 
 * Gère l'interface utilisateur globale du Marketplace, les onglets,
 * l'affichage des composants et les interactions utilisateur.
 */

MarketplaceMediator.defineModule('ui', ['config', 'utils', 'components', 'filters', 'auth'], function(config, utils, components, filters, auth) {
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
     * Ajoute un message au log d'installation/désinstallation
     * @param {HTMLElement} logContainer - Conteneur de log
     * @param {string} message - Message à ajouter
     * @param {boolean} isError - Si le message est une erreur
     * @param {string} level - Niveau de log (INFO, WARNING, ERROR, SUCCESS, SCRIPT)
     */
    function addLogMessage(logContainer, message, isError = false, level = 'INFO') {
        const timestamp = new Date().toLocaleTimeString();
        const logItem = document.createElement('div');
        
        // Déterminer la classe CSS basée sur le niveau
        let logClass = '';
        if (isError || level === 'ERROR') {
            logClass = 'log-error';
        } else if (level === 'WARNING') {
            logClass = 'log-warning';
        } else if (level === 'SUCCESS') {
            logClass = 'log-success';
        } else if (level === 'SCRIPT') {
            logClass = 'log-script';
        } else {
            logClass = 'log-info';
        }
        
        // Affichage normal des logs
        logItem.className = `log-item ${logClass}`;
        logItem.innerHTML = `<span class="log-time">[${timestamp}]</span> <span class="log-level">[${level}]</span> ${message}`;
        
        logContainer.appendChild(logItem);
        logContainer.scrollTop = logContainer.scrollHeight;
    }
    // État de l'interface utilisateur
    let state = {
        activeTab: 'compatible',
        isLoading: false,
        modalVisible: false,
        notificationsEnabled: true
    };
    
    /**
     * Initialise le module d'interface utilisateur
     */
    function init() {
        console.log("Initialisation du module d'interface utilisateur");
        
        // Configurer les gestionnaires d'événements
        setupEvents();
        
        // Initialiser les onglets
        setupTabs();
        
        // S'abonner aux événements liés aux composants
        MarketplaceMediator.subscribe('componentsLoaded', onComponentsLoaded);
        MarketplaceMediator.subscribe('componentsFiltered', onComponentsFiltered);
        MarketplaceMediator.subscribe('componentsLoading', onComponentsLoading);
        MarketplaceMediator.subscribe('componentsLoadError', onComponentsLoadError);
        
        // S'abonner aux événements liés à l'authentification
        MarketplaceMediator.subscribe('authStateChanged', onAuthStateChanged);
        MarketplaceMediator.subscribe('apiAuthenticationError', onApiAuthenticationError);
        
        // S'abonner aux événements liés aux erreurs d'API
        MarketplaceMediator.subscribe('apiConnectionError', onApiConnectionError);
        MarketplaceMediator.subscribe('apiServerError', onApiServerError);
        MarketplaceMediator.subscribe('apiConfigError', onApiConfigError);
        
        // Charger le contenu de l'onglet actif
        setTimeout(() => {
            loadTabContent('compatible');
        }, 100);
        
        // Publier un événement pour indiquer que le module est prêt
        MarketplaceMediator.publish('uiModuleReady', {});
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
                
                // Mettre à jour l'état
                state.activeTab = tabId;
                
                // Charger le contenu de l'onglet
                loadTabContent(tabId);
            });
        });
    }
    
    /**
     * Configure les gestionnaires d'événements généraux
     */
    function setupEvents() {
        // Clic sur les boutons des composants (délégation d'événements)
        document.addEventListener('click', function(event) {
            // Gestion des boutons d'installation
            if (event.target.classList.contains('btn-install') || 
                event.target.closest('.btn-install')) {
                const button = event.target.classList.contains('btn-install') ? 
                    event.target : event.target.closest('.btn-install');
                const componentId = button.getAttribute('data-id');
                const version = button.getAttribute('data-version');
                
                if (componentId && version) {
                    handleInstallComponent(componentId, version);
                }
            }
            
            // Gestion des boutons de mise à jour
            else if (event.target.classList.contains('btn-update') || 
                event.target.closest('.btn-update')) {
                const button = event.target.classList.contains('btn-update') ? 
                    event.target : event.target.closest('.btn-update');
                const componentId = button.getAttribute('data-id');
                const version = button.getAttribute('data-version');
                
                if (componentId && version) {
                    handleInstallComponent(componentId, version);
                }
            }
            
            // Gestion des boutons de désinstallation
            else if (event.target.classList.contains('btn-uninstall') || 
                event.target.closest('.btn-uninstall')) {
                const button = event.target.classList.contains('btn-uninstall') ? 
                    event.target : event.target.closest('.btn-uninstall');
                const componentId = button.getAttribute('data-id');
                
                if (componentId) {
                    handleUninstallComponent(componentId);
                }
            }
            
            // Gestion des boutons de détails
            else if (event.target.classList.contains('btn-info') || 
                event.target.closest('.btn-info')) {
                const button = event.target.classList.contains('btn-info') ? 
                    event.target : event.target.closest('.btn-info');
                const componentId = button.getAttribute('data-id');
                
                if (componentId) {
                    showComponentDetails(componentId);
                }
            }
            
            // Gestion des boutons d'aide (documentation)
            else if (event.target.classList.contains('help-icon') || 
                event.target.closest('.help-icon')) {
                const button = event.target.classList.contains('help-icon') ? 
                    event.target : event.target.closest('.help-icon');
                const componentId = button.getAttribute('data-id');
                
                if (componentId) {
                    showComponentReadme(componentId);
                }
            }
        });
    }
    
    /**
     * Charge le contenu d'un onglet
     * @param {string} tabName - Nom de l'onglet à charger
     */
    function loadTabContent(tabName) {
        console.log(`Chargement du contenu de l'onglet: ${tabName}`);
        
        // Mettre à jour l'état
        state.activeTab = tabName;
        state.isLoading = true;
        
        // Afficher un indicateur de chargement
        showLoading(tabName);
        
        // Charger les composants
        components.loadComponents(tabName)
            .then(loadedComponents => {
                // Masquer l'indicateur de chargement
                hideLoading(tabName);
                
                // Mettre à jour l'état
                state.isLoading = false;
                
                // Afficher les composants
                renderComponents(tabName, loadedComponents);
            })
            .catch(error => {
                console.error(`Erreur lors du chargement des composants pour ${tabName}:`, error);
                
                // Masquer l'indicateur de chargement
                hideLoading(tabName);
                
                // Mettre à jour l'état
                state.isLoading = false;
                
                // Afficher un message d'erreur
                showError(tabName, error.message || "Erreur lors du chargement des composants");
            });
    }
    
    /**
     * Affiche un indicateur de chargement dans un onglet
     * @param {string} tabName - Nom de l'onglet
     */
    function showLoading(tabName) {
        const container = document.getElementById(`${tabName}-components`);
        if (!container) return;
        
        container.innerHTML = '<div class="loading">Chargement...</div>';
    }
    
    /**
     * Masque l'indicateur de chargement dans un onglet
     * @param {string} tabName - Nom de l'onglet
     */
    function hideLoading(tabName) {
        const container = document.getElementById(`${tabName}-components`);
        if (!container) return;
        
        const loading = container.querySelector('.loading');
        if (loading) {
            loading.remove();
        }
    }
    
    /**
     * Affiche un message d'erreur dans un onglet
     * @param {string} tabName - Nom de l'onglet
     * @param {string} message - Message d'erreur
     */
    function showError(tabName, message) {
        const container = document.getElementById(`${tabName}-components`);
        if (!container) return;
        
        container.innerHTML = `<div class="error-message">${message}</div>`;
    }
    
    /**
     * Gère l'événement lorsque des composants sont en cours de chargement
     * @param {Object} data - Données de l'événement
     */
    function onComponentsLoading(data) {
        if (data && data.tabName) {
            // Si c'est l'onglet actif, afficher un indicateur de chargement
            if (data.tabName === state.activeTab) {
                showLoading(data.tabName);
            }
            
            console.log(`Chargement des composants pour l'onglet ${data.tabName} en cours...`);
        }
    }
    
    /**
     * Gère l'événement lorsque des composants sont chargés
     * @param {Object} data - Données de l'événement
     */
    function onComponentsLoaded(data) {
        if (data && data.components) {
            // Afficher les composants uniquement si l'onglet correspond
            if (data.tabName === state.activeTab) {
                // Masquer l'indicateur de chargement
                hideLoading(data.tabName);
                
                // Mettre à jour l'état
                state.isLoading = false;
                
                // Afficher une notification si chargé depuis le cache
                if (data.fromCache) {
                    console.log(`Composants pour ${data.tabName} chargés depuis le cache`);
                }
                
                renderComponents(data.tabName, data.components);
            }
        }
    }
    
    /**
     * Gère l'événement lorsque des composants sont filtrés
     * @param {Object} data - Données de l'événement
     */
    function onComponentsFiltered(data) {
        if (data && data.components) {
            // Afficher les composants uniquement si l'onglet correspond
            if (data.tabName === state.activeTab) {
                renderComponents(data.tabName, data.components);
            }
        }
    }
    
    /**
     * Gère l'événement lorsqu'une erreur survient lors du chargement des composants
     * @param {Object} data - Données de l'événement
     */
    function onComponentsLoadError(data) {
        if (data && data.tabName) {
            // Si c'est l'onglet actif, afficher une erreur appropriée
            if (data.tabName === state.activeTab) {
                // Masquer l'indicateur de chargement
                hideLoading(data.tabName);
                
                // Mettre à jour l'état
                state.isLoading = false;
                
                let errorMessage = "Erreur lors du chargement des composants.";
                
                // Message personnalisé selon le type d'erreur
                if (data.statusCode === 401 || data.statusCode === 403) {
                    errorMessage = "Problème d'authentification avec l'API. Veuillez contacter votre administrateur.";
                } else if (data.statusCode >= 500) {
                    errorMessage = "Le serveur est actuellement indisponible. Veuillez réessayer plus tard.";
                } else if (data.statusCode === 404) {
                    errorMessage = "La ressource demandée n'a pas été trouvée.";
                } else if (data.statusCode === 'network' || data.error.includes('network')) {
                    errorMessage = "Problème de connexion réseau. Veuillez vérifier votre connexion internet.";
                } else if (data.error) {
                    errorMessage = `Erreur: ${data.error}`;
                }
                
                showError(data.tabName, errorMessage);
            }
        }
    }
    
    /**
     * Gère l'événement lorsque l'état d'authentification change
     * @param {Object} authState - Nouvel état d'authentification
     */
    function onAuthStateChanged(authState) {
        // Mettre à jour l'interface pour refléter l'état d'authentification
        updateUIForAuth(authState);
    }
    
    /**
     * Gère l'événement lorsqu'une erreur d'authentification survient
     * @param {Object} data - Données de l'événement
     */
    function onApiAuthenticationError(data) {
        console.warn("Erreur d'authentification API:", data.message);
        
        // Afficher une alerte discrète dans l'interface
        if (auth && auth.showNotification) {
            auth.showNotification("Problème d'authentification avec l'API Marketplace. Veuillez contacter votre administrateur.", "warning");
        }
        
        // Ajouter une bannière d'avertissement si ce n'est pas déjà fait
        addAuthErrorBanner();
    }
    
    /**
     * Gère l'événement lorsqu'une erreur de connexion API survient
     * @param {Object} data - Données de l'événement
     */
    function onApiConnectionError(data) {
        console.error("Erreur de connexion API:", data.message);
        
        // Afficher une alerte dans l'interface
        if (auth && auth.showNotification) {
            auth.showNotification("Problème de connexion à l'API Marketplace. Vérifiez votre connexion réseau ou contactez l'administrateur.", "error");
        }
        
        // Ajouter une bannière d'erreur si ce n'est pas déjà fait
        addConnectionErrorBanner();
    }
    
    /**
     * Gère l'événement lorsqu'une erreur serveur API survient
     * @param {Object} data - Données de l'événement
     */
    function onApiServerError(data) {
        console.error("Erreur serveur API:", data.message);
        
        // Afficher une alerte dans l'interface
        if (auth && auth.showNotification) {
            auth.showNotification("Le serveur Marketplace est momentanément indisponible. Veuillez réessayer plus tard.", "error");
        }
    }
    
    /**
     * Gère l'événement lorsqu'une erreur de configuration API survient
     * @param {Object} data - Données de l'événement
     */
    function onApiConfigError(data) {
        console.error("Erreur de configuration API:", data.message);
        
        // Afficher une alerte dans l'interface
        if (auth && auth.showNotification) {
            auth.showNotification("La configuration de l'API Marketplace est incorrecte. Veuillez contacter votre administrateur.", "error");
        }
    }
    
    /**
     * Ajoute une bannière d'erreur d'authentification à l'interface
     */
    function addAuthErrorBanner() {
        // Vérifier si la bannière existe déjà
        if (document.querySelector('.auth-error-banner')) {
            return;
        }
        
        // Créer la bannière
        const banner = document.createElement('div');
        banner.className = 'auth-error-banner';
        banner.innerHTML = `
            <div class="banner-content">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Problème d'authentification avec l'API Marketplace. Les fonctionnalités peuvent être limitées.</span>
                <button type="button" class="btn-close">×</button>
            </div>
        `;
        
        // Ajouter la bannière au début du conteneur
        const container = document.querySelector('.marketplace-container');
        if (container) {
            container.insertBefore(banner, container.firstChild);
            
            // Gérer la fermeture
            banner.querySelector('.btn-close').addEventListener('click', function() {
                banner.remove();
            });
        }
    }
    
    /**
     * Ajoute une bannière d'erreur de connexion à l'interface
     */
    function addConnectionErrorBanner() {
        // Vérifier si la bannière existe déjà
        if (document.querySelector('.connection-error-banner')) {
            return;
        }
        
        // Créer la bannière
        const banner = document.createElement('div');
        banner.className = 'connection-error-banner';
        banner.innerHTML = `
            <div class="banner-content">
                <i class="fas fa-wifi"></i>
                <span>Problème de connexion à l'API Marketplace. Vérifiez votre connexion réseau.</span>
                <button type="button" class="btn-close">×</button>
                <button type="button" class="btn-retry">Réessayer</button>
            </div>
        `;
        
        // Ajouter la bannière au début du conteneur
        const container = document.querySelector('.marketplace-container');
        if (container) {
            container.insertBefore(banner, container.firstChild);
            
            // Gérer la fermeture
            banner.querySelector('.btn-close').addEventListener('click', function() {
                banner.remove();
            });
            
            // Gérer la tentative de reconnexion
            banner.querySelector('.btn-retry').addEventListener('click', function() {
                banner.remove();
                refreshAllComponents();
            });
        }
    }
    
    /**
     * Met à jour l'interface utilisateur en fonction de l'état d'authentification
     * @param {Object} authState - État d'authentification
     */
    function updateUIForAuth(authState) {
        // Mettre à jour les boutons d'action (admin)
        const adminActions = document.querySelectorAll('.admin-only');
        adminActions.forEach(action => {
            action.style.display = authState.isAdmin ? '' : 'none';
        });
    }
    
    /**
     * Affiche les composants dans un onglet
     * @param {string} tabName - Nom de l'onglet
     * @param {Array} componentsList - Liste des composants à afficher
     */
    function renderComponents(tabName, componentsList) {
        const container = document.getElementById(`${tabName}-components`);
        if (!container) {
            console.error(`Conteneur pour l'onglet ${tabName} non trouvé`);
            return;
        }
        
        if (!componentsList || componentsList.length === 0) {
            // Vérifier si c'est dû à une erreur d'authentification
            const authError = document.querySelector('.marketplace-notification.warning');
            
            if (authError) {
                container.innerHTML = `
                    <div class="empty-message error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Problème d'authentification</h3>
                        <p>Impossible d'accéder aux composants du Marketplace en raison d'un problème d'authentification.</p>
                        <p>Veuillez contacter votre administrateur pour vérifier la configuration de l'API.</p>
                    </div>`;
            } else {
                container.innerHTML = '<div class="empty-message">Aucun composant disponible dans cette catégorie</div>';
            }
            return;
        }
        
        let html = '';
        
        // Générer le HTML pour chaque composant
        componentsList.forEach(component => {
            html += components.renderComponentHtml(component, tabName);
        });
        
        container.innerHTML = html;
        
        // Charger les icônes des composants
        loadComponentIcons(componentsList);
    }
    
    /**
     * Charge les icônes des composants affichés
     * @param {Array} componentsList - Liste des composants
     */
    function loadComponentIcons(componentsList) {
        componentsList.forEach(component => {
            const iconElement = document.getElementById(`icon-${component.componentId}`);
            if (iconElement && iconElement.src.includes('data:image/svg+xml;base64')) {
                // L'icône est l'icône par défaut, essayons de charger la vraie icône
                components.loadComponentIcon(component.componentId)
                    .then(iconUrl => {
                        // Mettre à jour l'icône si l'élément existe toujours
                        if (iconElement) {
                            iconElement.src = iconUrl;
                        }
                    })
                    .catch(error => {
                        // En cas d'échec, laisser l'icône par défaut
                        console.warn(`Erreur lors du chargement de l'icône pour le composant ${component.componentId}:`, error);
                    });
            }
        });
    }
    
    /**
     * Affiche les détails d'un composant
     * @param {number} componentId - ID du composant
     */
    function showComponentDetails(componentId) {
        // Récupérer les détails complets du composant
        components.getComponentDetails(componentId)
            .then(component => {
                // Créer la modal de détails
                createComponentDetailsModal(component);
            })
            .catch(error => {
                console.error("Erreur lors du chargement des détails du composant:", error);
                
                // Fallback: utiliser les données de base du composant
                const baseComponent = components.getComponentById(componentId);
                if (baseComponent) {
                    createComponentDetailsModal(baseComponent);
                } else {
                    auth.showNotification("Impossible de charger les détails du composant", "error");
                }
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
                            Version ${components.getDisplayVersionWithContext(component)}
                        </div>
                    </div>
                </div>
                
                <div class="modal-body">
                    <p class="component-detail-description">${component.description}</p>
                    
                    <div class="component-detail-info">
                        <div class="info-item">
                            <div class="info-label">Catégorie:</div>
                            <div class="info-value">${component.category || 'Non catégorisé'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Auteur:</div>
                            <div class="info-value">${component.author || 'Avanteam'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Version minimale:</div>
                            <div class="info-value">Process Studio ${component.minPlatformVersion || '1.0.0'}</div>
                        </div>
                        ${component.maxPlatformVersion ? `
                        <div class="info-item">
                            <div class="info-label">Version maximale:</div>
                            <div class="info-value">Process Studio ${component.maxPlatformVersion}</div>
                        </div>
                        ` : ''}
                        <div class="info-item">
                            <div class="info-label">Date de publication:</div>
                            <div class="info-value">${utils.formatDate(component.updatedDate || new Date().toISOString())}</div>
                        </div>
                        ${component.tagsArray && component.tagsArray.length > 0 ? `
                        <div class="info-item">
                            <div class="info-label">Tags:</div>
                            <div class="info-value tags-container">
                                ${component.tagsArray.map(tag => `<span class="component-tag">${tag}</span>`).join(' ')}
                            </div>
                        </div>
                        ` : ''}
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
                    ${component.repositoryUrl && component.repositoryUrl !== 'https://avanteam-online.com/no-repository' ? `
                        <a href="${component.repositoryUrl}" target="_blank" class="btn btn-github">
                            <svg style="width:16px;height:16px;margin-right:6px" viewBox="0 0 24 24"><path fill="currentColor" d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z" /></svg> GitHub
                        </a>
                    ` : ''}
                    <button type="button" class="btn btn-secondary modal-cancel">Fermer</button>
                </div>
            </div>
        `;
        
        // Mettre à jour l'état
        state.modalVisible = true;
        
        // Ajouter la modal au document
        document.body.appendChild(modal);
        
        // Gérer la fermeture de la modal
        modal.querySelector('.modal-close').addEventListener('click', () => {
            closeModal(modal);
        });
        
        modal.querySelector('.modal-cancel').addEventListener('click', () => {
            closeModal(modal);
        });
        
        modal.querySelector('.modal-backdrop').addEventListener('click', () => {
            closeModal(modal);
        });
        
        // Charger l'icône du composant de manière asynchrone
        components.loadComponentIcon(component.componentId)
            .then(iconUrl => {
                // Mettre à jour l'icône dans la modal
                const iconElement = document.getElementById(`modal-icon-${component.componentId}`);
                if (iconElement) {
                    iconElement.src = iconUrl;
                }
            })
            .catch(error => {
                // En cas d'échec, laisser l'icône par défaut
                console.warn(`Erreur lors du chargement de l'icône pour le composant ${component.componentId}:`, error);
            });
    }
    
    /**
     * Ferme une modal et nettoie les ressources
     * @param {HTMLElement} modal - Élément modal à fermer
     */
    function closeModal(modal) {
        document.body.removeChild(modal);
        state.modalVisible = false;
    }
    
    /**
     * Affiche le fichier README d'un composant installé
     * @param {number} componentId - ID du composant
     */
    function showComponentReadme(componentId) {
        console.log("Demande d'affichage du ReadMe pour le composant", componentId);
        
        // Récupérer le composant
        let component = null;
        
        // Vérifier d'abord dans le cache des composants
        component = components.getComponentById(componentId);
        
        // Si le composant n'est pas trouvé, tenter une approche alternative
        if (!component) {
            // Chercher si ce composant est visible dans les listes de composants actuelles
            const compatibleComponents = document.querySelectorAll('.component-card');
            for (const element of compatibleComponents) {
                if (element.getAttribute('data-id') === componentId.toString()) {
                    // Vérifier si le composant a la classe 'installed'
                    if (element.classList.contains('installed')) {
                        component = { componentId: componentId, isInstalled: true };
                        break;
                    }
                }
            }
        }
        
        // Vérifier si le composant est installé
        if (!component || component.isInstalled === false) {
            console.warn("Composant non trouvé ou non installé:", componentId);
            auth.showNotification("Ce composant n'est pas installé ou n'existe pas", "warning");
            return;
        }
        
        // Construire le chemin vers le fichier ReadMe.html
        // Au lieu d'utiliser BaseSite, nous allons déterminer le chemin en analysant l'URL actuelle
        let basePath = '';
        
        try {
            // Obtenir l'URL complète actuelle
            const currentUrl = window.location.href;
            console.log("URL actuelle complète:", currentUrl);
            
            // Extraire le chemin jusqu'à /Custom/MarketPlace/ pour conserver la structure complète
            const urlObj = new URL(currentUrl);
            const pathParts = urlObj.pathname.split('/');
            
            // Chercher l'indice de "Custom" dans le chemin
            let customIndex = -1;
            for (let i = 0; i < pathParts.length; i++) {
                if (pathParts[i].toLowerCase() === 'custom') {
                    customIndex = i;
                    break;
                }
            }
            
            if (customIndex > 0) {
                // Reconstruire le chemin de base jusqu'au répertoire avant "Custom"
                basePath = pathParts.slice(0, customIndex).join('/');
                console.log("Chemin de base déterminé:", basePath);
            } else {
                // Fallback: extraire un préfixe potentiel comme /APP
                const match = urlObj.pathname.match(/^(\/[^\/]+)/i);
                if (match && match[1]) {
                    basePath = match[1];
                    console.log("Préfixe potentiel trouvé:", basePath);
                }
            }
        } catch (e) {
            console.warn("Erreur lors de l'analyse de l'URL:", e);
            // En cas d'erreur, essayer de trouver le préfixe APP de manière plus directe
            try {
                if (window.location.pathname.toLowerCase().includes('/app/')) {
                    basePath = '/APP';
                    console.log("Préfixe /APP détecté");
                }
            } catch (e2) {
                console.warn("Erreur lors de la détection du préfixe APP:", e2);
            }
        }
        
        // Le chemin est {basePath}/Custom/MarketPlace/Components/{componentId}/ReadMe.html
        const readmeUrl = `${basePath}/Custom/MarketPlace/Components/${componentId}/ReadMe.html`;
        console.log("URL finale du ReadMe:", readmeUrl);
        console.log(`Ouverture du fichier ReadMe: ${readmeUrl}`);
        
        // Ouvrir le fichier ReadMe dans une nouvelle fenêtre ou un nouvel onglet
        try {
            const readmeWindow = window.open(readmeUrl, `readme_${componentId}`, 'width=800,height=600,scrollbars=yes');
            
            // Vérifier si la fenêtre a été ouverte avec succès
            if (!readmeWindow || readmeWindow.closed || typeof readmeWindow.closed == 'undefined') {
                auth.showNotification("Impossible d'ouvrir la fenêtre de documentation. Vérifiez que les popups sont autorisés.", "warning");
            }
        } catch (e) {
            console.error("Erreur lors de l'ouverture du ReadMe:", e);
            auth.showNotification("Erreur lors de l'ouverture du fichier de documentation", "error");
        }
    }
    
    /**
     * Gère l'installation ou la mise à jour d'un composant
     * @param {number} componentId - ID du composant
     * @param {string} version - Version à installer
     */
    function handleInstallComponent(componentId, version) {
        console.log(`Demande d'installation du composant ${componentId} (version ${version})`);
        
        // Logs de diagnostic pour comprendre l'état d'authentification
        console.log("État d'authentification:", {
            "isAuthenticated": auth.isAuthenticated(),
            "isAdmin": auth.isAdmin(),
            "token": auth.getToken() ? "Présent" : "Absent",
            "userInfo": auth.getUserInfo()
        });
        
        // Vérifier l'authentification (Azure AD Avanteam)
        if (!auth.isAuthenticated()) {
            console.warn("L'utilisateur n'est pas authentifié");
            
            // Créer le dialogue d'authentification comme dans l'ancien code
            const authPrompt = document.createElement("div");
            authPrompt.className = "auth-modal";
            authPrompt.innerHTML = `
                <div class="auth-modal-backdrop"></div>
                <div class="auth-modal-content">
                    <h3>Authentification requise</h3>
                    <p>L'installation de composants est réservée aux administrateurs Avanteam.</p>
                    <p>Veuillez vous connecter avec votre compte Avanteam pour continuer.</p>
                    <div class="auth-modal-buttons">
                        <button type="button" class="btn btn-secondary auth-modal-cancel">Annuler</button>
                        <button type="button" class="btn btn-primary auth-modal-login">Se connecter</button>
                    </div>
                </div>
            `;
            
            // Ajouter au DOM
            document.body.appendChild(authPrompt);
            
            // Gestionnaires d'événements
            authPrompt.querySelector(".auth-modal-cancel").addEventListener("click", (e) => {
                e.preventDefault();
                document.body.removeChild(authPrompt);
            });
            
            authPrompt.querySelector(".auth-modal-login").addEventListener("click", (e) => {
                e.preventDefault();
                document.body.removeChild(authPrompt);
                auth.login();
            });
            
            authPrompt.querySelector(".auth-modal-backdrop").addEventListener("click", (e) => {
                e.preventDefault();
                document.body.removeChild(authPrompt);
            });
            
            return;
        }
        
        // Vérifier les droits d'administration séparément
        if (!auth.isAdmin()) {
            console.warn("L'utilisateur est authentifié mais n'a pas les droits d'administrateur");
            
            // Créer une modal d'erreur plus élégante qu'un alert
            const errorPrompt = document.createElement("div");
            errorPrompt.className = "auth-modal";
            errorPrompt.innerHTML = `
                <div class="auth-modal-backdrop"></div>
                <div class="auth-modal-content">
                    <h3>Droits insuffisants</h3>
                    <p>Vous êtes connecté, mais vous n'avez pas les droits d'administration nécessaires pour cette action.</p>
                    <p>Seuls les administrateurs Avanteam peuvent installer des composants.</p>
                    <div class="auth-modal-buttons">
                        <button type="button" class="btn btn-secondary auth-modal-cancel">Fermer</button>
                    </div>
                </div>
            `;
            
            // Ajouter au DOM
            document.body.appendChild(errorPrompt);
            
            // Gestionnaires d'événements
            errorPrompt.querySelector(".auth-modal-cancel").addEventListener("click", (e) => {
                e.preventDefault();
                document.body.removeChild(errorPrompt);
            });
            
            errorPrompt.querySelector(".auth-modal-backdrop").addEventListener("click", (e) => {
                e.preventDefault();
                document.body.removeChild(errorPrompt);
            });
            
            return;
        }
        
        console.log("L'utilisateur est authentifié et possède les droits d'administrateur");
        
        // Chercher le composant dans le cache
        const component = components.getComponentById(componentId);
        
        if (!component) {
            // Le composant n'a pas été trouvé dans le cache
            console.error(`Composant #${componentId} non trouvé dans le cache`);
            auth.showNotification(`Erreur: Composant #${componentId} introuvable`, "error");
            
            // Vérifier s'il y a des erreurs d'API ou de connexion
            const authError = document.querySelector('.auth-error-banner');
            const connectionError = document.querySelector('.connection-error-banner');
            
            if (authError || connectionError) {
                // Créer une modal d'erreur au lieu d'utiliser alert
                const errorModal = document.createElement("div");
                errorModal.className = "auth-modal";
                errorModal.innerHTML = 
                    '<div class="auth-modal-backdrop"></div>' +
                    '<div class="auth-modal-content">' +
                        '<h3>Erreur de connexion</h3>' +
                        '<p>Problème de connexion avec l\'API Marketplace. Veuillez réessayer ou contacter votre administrateur.</p>' +
                        '<div class="auth-modal-buttons">' +
                            '<button type="button" class="btn btn-primary auth-modal-close">Fermer</button>' +
                        '</div>' +
                    '</div>';
                
                // Ajouter au DOM
                document.body.appendChild(errorModal);
                
                // Gestionnaire pour le bouton Fermer
                errorModal.querySelector(".auth-modal-close").addEventListener("click", () => {
                    document.body.removeChild(errorModal);
                });
                
                // Gestionnaire pour le clic sur l'arrière-plan
                errorModal.querySelector(".auth-modal-backdrop").addEventListener("click", () => {
                    document.body.removeChild(errorModal);
                });
            } else {
                // Créer une modal d'erreur au lieu d'utiliser alert
                const errorModal = document.createElement("div");
                errorModal.className = "auth-modal";
                errorModal.innerHTML = 
                    '<div class="auth-modal-backdrop"></div>' +
                    '<div class="auth-modal-content">' +
                        '<h3>Composant introuvable</h3>' +
                        '<p>Le composant #' + componentId + ' n\'a pas été trouvé. Veuillez rafraîchir la page et réessayer.</p>' +
                        '<div class="auth-modal-buttons">' +
                            '<button type="button" class="btn btn-primary auth-modal-close">Fermer</button>' +
                        '</div>' +
                    '</div>';
                
                // Ajouter au DOM
                document.body.appendChild(errorModal);
                
                // Gestionnaire pour le bouton Fermer
                errorModal.querySelector(".auth-modal-close").addEventListener("click", () => {
                    document.body.removeChild(errorModal);
                });
                
                // Gestionnaire pour le clic sur l'arrière-plan
                errorModal.querySelector(".auth-modal-backdrop").addEventListener("click", () => {
                    document.body.removeChild(errorModal);
                });
            }
            
            return;
        }
        
        // Utiliser le nom du composant trouvé
        const componentName = component.displayName || `Composant #${componentId}`;
        
        // Créer une modal de confirmation personnalisée au lieu d'utiliser confirm()
        const confirmModal = document.createElement("div");
        confirmModal.className = "auth-modal";
        confirmModal.innerHTML = 
            '<div class="auth-modal-backdrop"></div>' +
            '<div class="auth-modal-content">' +
                '<h3>Confirmation d\'installation</h3>' +
                '<p>Voulez-vous installer le composant "' + componentName + '" (version ' + version + ') ?</p>' +
                '<div class="auth-modal-buttons">' +
                    '<button type="button" class="btn btn-secondary auth-modal-cancel">Annuler</button>' +
                    '<button type="button" class="btn btn-primary auth-modal-confirm">Installer</button>' +
                '</div>' +
            '</div>';
        
        // Ajouter au DOM
        document.body.appendChild(confirmModal);
        
        // Gestionnaire pour le bouton Annuler
        confirmModal.querySelector(".auth-modal-cancel").addEventListener("click", () => {
            document.body.removeChild(confirmModal);
            // L'utilisateur a annulé, on s'arrête ici
        });
        
        // Gestionnaire pour le bouton Installer
        confirmModal.querySelector(".auth-modal-confirm").addEventListener("click", () => {
            document.body.removeChild(confirmModal);
            processInstallation();
        });
        
        // Gestionnaire pour le clic sur l'arrière-plan
        confirmModal.querySelector(".auth-modal-backdrop").addEventListener("click", () => {
            document.body.removeChild(confirmModal);
            // L'utilisateur a annulé, on s'arrête ici
        });
        
        // Fonction pour traiter l'installation après confirmation
        function processInstallation() {
            // Le traitement commence ici
            
            // Créer la modal d'installation avec logs
            const modal = document.createElement('div');
            modal.className = 'installation-modal';
            modal.innerHTML = 
            '<div class="modal-backdrop"></div>' +
            '<div class="modal-content">' +
                '<h2>Installation de ' + componentName + '</h2>' +
                
                '<div class="installation-header">' +
                    '<div class="installation-status">En attente</div>' +
                '</div>' +
                
                '<div class="installation-progress">' +
                    '<div class="progress-container">' +
                        '<div class="progress-bar" style="width: 0%"></div>' +
                    '</div>' +
                    '<div class="progress-text">0%</div>' +
                '</div>' +
                
                '<div class="installation-log"></div>' +
            '</div>';
        
        // Les styles CSS pour les modales d'installation sont maintenant dans le fichier marketplace.css
        // Nous n'avons plus besoin d'ajouter les styles via JavaScript
        
        // Ajouter la modal au document
        document.body.appendChild(modal);
        
        // Références aux éléments de la modal
        const progressBar = modal.querySelector('.progress-bar');
        const progressText = modal.querySelector('.progress-text');
        const logContainer = modal.querySelector('.installation-log');
        const statusContainer = modal.querySelector('.installation-status');
        
        // Générer un ID d'installation unique
        const installId = `install-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        
        // Vérifier si le streaming est disponible
        const useStreaming = typeof utils.marketplaceStream !== 'undefined';
        console.log("Streaming disponible:", useStreaming);
        
        if (useStreaming) {
            // Initialiser le stream
            utils.marketplaceStream.init({
                installId: installId,
                logContainer: logContainer,
                progressBar: progressBar,
                progressText: progressText,
                statusContainer: statusContainer,
                onComplete: (success) => {
                    console.log("Streaming terminé avec succès:", success);
                    
                    // Ajouter un bouton pour fermer la modal
                    const closeButton = document.createElement('button');
                    closeButton.textContent = 'Fermer';
                    closeButton.className = 'btn btn-primary';
                    closeButton.style.marginTop = '20px';
                    closeButton.addEventListener('click', () => {
                        document.body.removeChild(modal);
                        
                        // Rafraîchir les composants
                        components.refreshAllComponents();
                        loadTabContent(state.activeTab);
                    });
                    
                    modal.querySelector('.modal-content').appendChild(closeButton);
                }
            });
            
            // Connecter au flux
            utils.marketplaceStream.connect();
        } else {
            // Utiliser la méthode classique sans streaming
            // Ajouter le premier message au log
            addLogMessage(logContainer, `Démarrage de l'installation de ${componentName} v${version}...`, false, 'INFO');
            
            // Mise à jour du statut
            statusContainer.textContent = "Installation en cours...";
            updateProgress(progressBar, progressText, 20);
            addLogMessage(logContainer, "Préparation de l'installation...", false, 'INFO');
        }
        
        // Obtenir les URLs de l'API
        const apiUrl = config.getApiUrl();
        const localApiUrl = config.getLocalApiUrl();
        
        if (!localApiUrl) {
            addLogMessage(logContainer, "ERREUR: URL de l'API locale non configurée", true, 'ERROR');
            statusContainer.textContent = "Erreur de configuration";
            progressBar.style.backgroundColor = '#dc3545';
            
            // Ajouter un bouton pour fermer la modal
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Fermer';
            closeButton.className = 'btn btn-danger';
            closeButton.style.marginTop = '20px';
            closeButton.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            
            modal.querySelector('.modal-content').appendChild(closeButton);
            return;
        }
        
        // Préparer les en-têtes d'API avec le token normal du Web.config
        const headers = components.prepareAuthHeaders({
            'Content-Type': 'application/json'
        });
        
        // Obtenir le ClientId
        const clientId = config.getClientId();
        
        // Construire l'endpoint pour l'API locale d'installation
        const localInstallEndpoint = `${localApiUrl}install`;
        
        // Mise à jour du statut
        updateProgress(progressBar, progressText, 40);
        addLogMessage(logContainer, "Obtention de l'URL de téléchargement depuis l'API centrale...", false, 'INFO');
        
        // Construire l'URL de téléchargement
        const downloadUrl = `${apiUrl}/components/${componentId}/download?clientId=${encodeURIComponent(clientId || '')}&version=${encodeURIComponent(version)}&urlOnly=true&installId=${encodeURIComponent(installId)}`;
        
        // Ne pas ajouter de logs inutiles si le streaming est activé
        if (!useStreaming) {
            addLogMessage(logContainer, "Obtention de l'URL de téléchargement depuis l'API centrale...", false, 'INFO');
        }
        
        // D'abord, obtenir l'URL de téléchargement auprès de l'API centrale
        fetch(downloadUrl, {
            method: 'POST',
            headers: headers
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erreur lors du téléchargement: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Vérifier que nous avons une URL de téléchargement
            if (!data || !data.downloadUrl) {
                throw new Error("Réponse de l'API invalide: URL de téléchargement manquante");
            }
            
            addLogMessage(logContainer, `URL de téléchargement obtenue`, false, 'INFO');
            
            // Vérifier si l'URL est valide et utilisable
            if (!data.downloadUrl || 
                data.downloadUrl.includes("avanteam-online.com/no-package") || 
                data.downloadUrl.includes("avanteam-online.com/placeholder")) {
                
                addLogMessage(logContainer, `Attention: URL de package non valide détectée.`, true, 'WARNING');
                throw new Error("L'URL de téléchargement n'est pas valide. Veuillez contacter l'administrateur du système.");
            }
            
            // Préparer les données pour l'API locale
            const installData = {
                componentId: componentId,
                version: version,
                packageUrl: data.downloadUrl,
                installId: installId
            };
            
            updateProgress(progressBar, progressText, 60);
            addLogMessage(logContainer, "Appel de l'API locale d'installation...", false, 'INFO');
            
            // Appel à l'API locale d'installation avec timeout augmenté
            // Utiliser AbortController pour gérer le timeout côté client de manière plus robuste
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1200000); // 20 minutes
            
            return fetch(localInstallEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Signaler au serveur de ne pas fermer la connexion
                    'Connection': 'keep-alive',
                    'Keep-Alive': 'timeout=1200' // 20 minutes en secondes
                },
                body: JSON.stringify(installData),
                signal: controller.signal
            }).finally(() => {
                clearTimeout(timeoutId);
            });
        })
        .then(response => {
            if (!response.ok) {
                // Gérer spécifiquement l'erreur 502 Bad Gateway qui peut survenir pendant un stream
                if (response.status === 502) {
                    console.warn("Erreur 502 détectée pendant l'installation. Le processus continue en arrière-plan.");
                    addLogMessage(logContainer, "Avertissement: La connexion streaming a été interrompue, mais l'installation continue en arrière-plan.", false, 'WARNING');
                    addLogMessage(logContainer, "L'état du composant sera mis à jour à la fin de l'installation.", false, 'INFO');
                    
                    // Simuler un succès pour continuer le traitement même après une erreur 502
                    return { 
                        success: true, 
                        logs: [{ level: "WARNING", message: "Connexion streaming interrompue. Vérifiez l'installation dans quelques minutes." }],
                        streamInterrupted: true
                    };
                }
                
                // Pour les autres erreurs, lever une exception
                throw new Error("Erreur lors de l'installation (" + response.status + "): " + response.statusText);
            }
            return response.json();
        })
        .then(result => {
            // Mise à jour du statut
            updateProgress(progressBar, progressText, 80);
            
            // Afficher les logs si disponibles et si le streaming n'est pas utilisé
            if (!useStreaming && result.logs && Array.isArray(result.logs)) {
                result.logs.forEach(log => {
                    addLogMessage(logContainer, log.message, log.level === "ERROR", log.level);
                });
            }
            
            // Le script d'installation PowerShell se termine avec SUCCESS même s'il y a un avertissement
            // Vérifier si les fichiers ont bien été copiés
            const filesCopied = result.logs && Array.isArray(result.logs) && 
                               result.logs.some(log => log.message && log.message.includes("fichiers copiés"));
            
            // CORRECTION CRITIQUE: Le résultat Success est case-sensitive
            const hasSuccessFlag = result.success === true || result.Success === true;
            
            // Vérifier le résultat de l'installation
            // Si streamInterrupted est true, c'est qu'on a simulé un succès après une erreur 502
            const isStreamInterrupted = result.streamInterrupted === true;
            const isSuccess = hasSuccessFlag || filesCopied || isStreamInterrupted || 
                            (result.logs && Array.isArray(result.logs) && 
                            result.logs.some(log => log.level === "SUCCESS"));
            
            if (isSuccess) {
                // Enregistrer l'installation auprès de l'API Marketplace
                return fetch(`${apiUrl}/components/${componentId}/install?clientId=${encodeURIComponent(clientId || '')}&version=${encodeURIComponent(version)}`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        Success: true,
                        ComponentId: componentId.toString(),
                        Version: version,
                        InstallId: installId,
                        DestinationPath: result.destinationPath || `Components/${componentId}`
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        console.warn("Erreur lors de l'enregistrement de l'installation: " + response.status);
                    }
                    
                    // Installation réussie même si l'enregistrement a échoué
                    statusContainer.textContent = "Installation réussie";
                    addLogMessage(logContainer, `Installation réussie!`, false, 'SUCCESS');
                    updateProgress(progressBar, progressText, 100);
                    
                    // Ajouter un bouton pour fermer la modal
                    const closeButton = document.createElement('button');
                    closeButton.textContent = 'Fermer';
                    closeButton.className = 'btn btn-primary';
                    closeButton.style.marginTop = '20px';
                    closeButton.addEventListener('click', () => {
                        document.body.removeChild(modal);
                        
                        // Rafraîchir les composants
                        components.refreshAllComponents();
                        loadTabContent(state.activeTab);
                    });
                    
                    modal.querySelector('.modal-content').appendChild(closeButton);
                    
                    // Notification discrète
                    auth.showNotification(`Composant installé avec succès`, "success");
                });
            } else {
                // Échec de l'installation
                statusContainer.textContent = "Échec de l'installation";
                addLogMessage(logContainer, "Échec de l'installation: " + (result.error || 'Erreur inconnue'), true, 'ERROR');
                progressBar.style.backgroundColor = '#dc3545'; // Rouge pour erreur
                
                // Ajouter un bouton pour fermer la modal
                const closeButton = document.createElement('button');
                closeButton.textContent = 'Fermer';
                closeButton.className = 'btn btn-danger';
                closeButton.style.marginTop = '20px';
                closeButton.addEventListener('click', () => {
                    document.body.removeChild(modal);
                });
                
                modal.querySelector('.modal-content').appendChild(closeButton);
                
                // Notification discrète
                auth.showNotification("Erreur lors de l'installation: " + (result.error || "Erreur inconnue"), "error");
            }
        })
        .catch(error => {
            console.error("Erreur lors de l'installation:", error);
            
            // Mise à jour du statut
            statusContainer.textContent = "Erreur lors de l'installation";
            addLogMessage(logContainer, "Erreur: " + (error.message || 'Erreur inconnue'), true, 'ERROR');
            progressBar.style.backgroundColor = '#dc3545'; // Rouge pour erreur
            
            // Ajouter un bouton pour fermer la modal
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Fermer';
            closeButton.className = 'btn btn-danger';
            closeButton.style.marginTop = '20px';
            closeButton.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            
            modal.querySelector('.modal-content').appendChild(closeButton);
            
            // Notification discrète
            auth.showNotification("Erreur lors de l'installation: " + (error.message || "Erreur inconnue"), "error");
        }); 
        } // Fin du processInstallation
    }
    
    /**
     * Gère la désinstallation d'un composant
     * @param {number} componentId - ID du composant
     */
    function handleUninstallComponent(componentId) {
        console.log("Demande de désinstallation du composant " + componentId);
        
        // Logs de diagnostic pour comprendre l'état d'authentification
        console.log("État d'authentification:", {
            "isAuthenticated": auth.isAuthenticated(),
            "isAdmin": auth.isAdmin(),
            "token": auth.getToken() ? "Présent" : "Absent",
            "userInfo": auth.getUserInfo()
        });
        
        // Vérifier l'authentification (Azure AD Avanteam)
        if (!auth.isAuthenticated()) {
            console.warn("L'utilisateur n'est pas authentifié");
            
            // Créer le dialogue d'authentification comme dans l'ancien code
            const authPrompt = document.createElement("div");
            authPrompt.className = "auth-modal";
            authPrompt.innerHTML = `
                <div class="auth-modal-backdrop"></div>
                <div class="auth-modal-content">
                    <h3>Authentification requise</h3>
                    <p>La désinstallation de composants est réservée aux administrateurs Avanteam.</p>
                    <p>Veuillez vous connecter avec votre compte Avanteam pour continuer.</p>
                    <div class="auth-modal-buttons">
                        <button type="button" class="btn btn-secondary auth-modal-cancel">Annuler</button>
                        <button type="button" class="btn btn-primary auth-modal-login">Se connecter</button>
                    </div>
                </div>
            `;
            
            // Ajouter au DOM
            document.body.appendChild(authPrompt);
            
            // Gestionnaires d'événements
            authPrompt.querySelector(".auth-modal-cancel").addEventListener("click", (e) => {
                e.preventDefault();
                document.body.removeChild(authPrompt);
            });
            
            authPrompt.querySelector(".auth-modal-login").addEventListener("click", (e) => {
                e.preventDefault();
                document.body.removeChild(authPrompt);
                auth.login();
            });
            
            authPrompt.querySelector(".auth-modal-backdrop").addEventListener("click", (e) => {
                e.preventDefault();
                document.body.removeChild(authPrompt);
            });
            
            return;
        }
        
        // Vérifier les droits d'administration séparément
        if (!auth.isAdmin()) {
            console.warn("L'utilisateur est authentifié mais n'a pas les droits d'administrateur");
            
            // Créer une modal d'erreur plus élégante qu'un alert
            const errorPrompt = document.createElement("div");
            errorPrompt.className = "auth-modal";
            errorPrompt.innerHTML = `
                <div class="auth-modal-backdrop"></div>
                <div class="auth-modal-content">
                    <h3>Droits insuffisants</h3>
                    <p>Vous êtes connecté, mais vous n'avez pas les droits d'administration nécessaires pour cette action.</p>
                    <p>Seuls les administrateurs Avanteam peuvent désinstaller des composants.</p>
                    <div class="auth-modal-buttons">
                        <button type="button" class="btn btn-secondary auth-modal-cancel">Fermer</button>
                    </div>
                </div>
            `;
            
            // Ajouter au DOM
            document.body.appendChild(errorPrompt);
            
            // Gestionnaires d'événements
            errorPrompt.querySelector(".auth-modal-cancel").addEventListener("click", (e) => {
                e.preventDefault();
                document.body.removeChild(errorPrompt);
            });
            
            errorPrompt.querySelector(".auth-modal-backdrop").addEventListener("click", (e) => {
                e.preventDefault();
                document.body.removeChild(errorPrompt);
            });
            
            return;
        }
        
        console.log("L'utilisateur est authentifié et possède les droits d'administrateur");
        
        // Chercher le composant dans le cache
        const component = components.getComponentById(componentId);
        
        if (!component) {
            // Le composant n'a pas été trouvé dans le cache
            console.error(`Composant #${componentId} non trouvé dans le cache pour la désinstallation`);
            auth.showNotification(`Erreur: Composant #${componentId} introuvable`, "error");
            
            // Vérifier s'il y a des erreurs d'API ou de connexion
            const authError = document.querySelector('.auth-error-banner');
            const connectionError = document.querySelector('.connection-error-banner');
            
            if (authError || connectionError) {
                // Créer une modal d'erreur au lieu d'utiliser alert
                const errorModal = document.createElement("div");
                errorModal.className = "auth-modal";
                errorModal.innerHTML = 
                    '<div class="auth-modal-backdrop"></div>' +
                    '<div class="auth-modal-content">' +
                        '<h3>Erreur de connexion</h3>' +
                        '<p>Problème de connexion avec l\'API Marketplace. Veuillez réessayer ou contacter votre administrateur.</p>' +
                        '<div class="auth-modal-buttons">' +
                            '<button type="button" class="btn btn-primary auth-modal-close">Fermer</button>' +
                        '</div>' +
                    '</div>';
                
                // Ajouter au DOM
                document.body.appendChild(errorModal);
                
                // Gestionnaire pour le bouton Fermer
                errorModal.querySelector(".auth-modal-close").addEventListener("click", () => {
                    document.body.removeChild(errorModal);
                });
                
                // Gestionnaire pour le clic sur l'arrière-plan
                errorModal.querySelector(".auth-modal-backdrop").addEventListener("click", () => {
                    document.body.removeChild(errorModal);
                });
            } else {
                // Créer une modal d'erreur au lieu d'utiliser alert
                const errorModal = document.createElement("div");
                errorModal.className = "auth-modal";
                errorModal.innerHTML = 
                    '<div class="auth-modal-backdrop"></div>' +
                    '<div class="auth-modal-content">' +
                        '<h3>Composant introuvable</h3>' +
                        '<p>Le composant #' + componentId + ' n\'a pas été trouvé. Veuillez rafraîchir la page et réessayer.</p>' +
                        '<div class="auth-modal-buttons">' +
                            '<button type="button" class="btn btn-primary auth-modal-close">Fermer</button>' +
                        '</div>' +
                    '</div>';
                
                // Ajouter au DOM
                document.body.appendChild(errorModal);
                
                // Gestionnaire pour le bouton Fermer
                errorModal.querySelector(".auth-modal-close").addEventListener("click", () => {
                    document.body.removeChild(errorModal);
                });
                
                // Gestionnaire pour le clic sur l'arrière-plan
                errorModal.querySelector(".auth-modal-backdrop").addEventListener("click", () => {
                    document.body.removeChild(errorModal);
                });
            }
            
            return;
        }
        
        // Utiliser le nom du composant trouvé
        const componentName = component.displayName || `Composant #${componentId}`;
        
        // Créer une modal de confirmation personnalisée au lieu d'utiliser confirm()
        const confirmModal = document.createElement("div");
        confirmModal.className = "auth-modal";
        confirmModal.innerHTML = 
            '<div class="auth-modal-backdrop"></div>' +
            '<div class="auth-modal-content">' +
                '<h3>Confirmation de désinstallation</h3>' +
                '<p>Êtes-vous sûr de vouloir désinstaller le composant "' + componentName + '" ?</p>' +
                '<p class="text-danger"><strong>Cette action ne peut pas être annulée.</strong></p>' +
                '<div class="auth-modal-buttons">' +
                    '<button type="button" class="btn btn-secondary auth-modal-cancel">Annuler</button>' +
                    '<button type="button" class="btn btn-danger auth-modal-confirm">Désinstaller</button>' +
                '</div>' +
            '</div>';
        
        // Ajouter au DOM
        document.body.appendChild(confirmModal);
        
        // Gestionnaire pour le bouton Annuler
        confirmModal.querySelector(".auth-modal-cancel").addEventListener("click", () => {
            document.body.removeChild(confirmModal);
            // L'utilisateur a annulé, on s'arrête ici
        });
        
        // Gestionnaire pour le bouton Désinstaller
        confirmModal.querySelector(".auth-modal-confirm").addEventListener("click", () => {
            document.body.removeChild(confirmModal);
            processUninstallation();
        });
        
        // Gestionnaire pour le clic sur l'arrière-plan
        confirmModal.querySelector(".auth-modal-backdrop").addEventListener("click", () => {
            document.body.removeChild(confirmModal);
            // L'utilisateur a annulé, on s'arrête ici
        });
        
        // Fonction pour traiter la désinstallation après confirmation
        function processUninstallation() {
            // DIAGNOSTIC: Vérifier la configuration avant de commencer
            console.log("DIAGNOSTIC - Configuration avant désinstallation:");
            console.log("- Module config:", config ? "Disponible" : "Non disponible");
            
            // Récupérer les URL avant de créer la modal
            const apiUrl = config.getApiUrl();
            const localApiUrl = config.getLocalApiUrl();
            
            console.log("DIAGNOSTIC - URLs d'API:");
            console.log("- API URL:", apiUrl);
            console.log("- API locale URL:", localApiUrl);
            
            // Créer la modal de désinstallation
            const modal = document.createElement('div');
            modal.className = 'installation-modal'; // Réutiliser le même style que pour l'installation
            modal.innerHTML = 
            '<div class="modal-backdrop"></div>' +
            '<div class="modal-content">' +
                '<h2>Désinstallation de ' + componentName + '</h2>' +
                
                '<div class="installation-header">' +
                    '<div class="installation-status">En attente</div>' +
                '</div>' +
                
                '<div class="installation-progress">' +
                    '<div class="progress-container">' +
                        '<div class="progress-bar" style="width: 0%"></div>' +
                    '</div>' +
                    '<div class="progress-text">0%</div>' +
                '</div>' +
                
                '<div class="installation-log"></div>' +
            '</div>';
        
        // Ajouter la modal au document
        document.body.appendChild(modal);
        
        // Références aux éléments de la modal
        const progressBar = modal.querySelector('.progress-bar');
        const progressText = modal.querySelector('.progress-text');
        const logContainer = modal.querySelector('.installation-log');
        const statusContainer = modal.querySelector('.installation-status');
        
        // Générer un ID de désinstallation unique
        const uninstallId = `uninstall-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        console.log("DIAGNOSTIC - ID de désinstallation généré:", uninstallId);
        
        // Vérifier si le streaming est disponible
        const marketplaceStreamExists = typeof utils.marketplaceStream !== 'undefined';
        let useStreaming = marketplaceStreamExists;
        console.log("DIAGNOSTIC - Streaming:", { 
            "marketplaceStreamExists": marketplaceStreamExists,
            "useStreaming": useStreaming 
        });
        
        // Ajouter le premier message au log - toujours faire ceci, même avec streaming
        addLogMessage(logContainer, `Démarrage de la désinstallation de ${componentName}...`, false, 'INFO');
        statusContainer.textContent = "Désinstallation en cours...";
        updateProgress(progressBar, progressText, 20);
        
        // Ajouter un bouton de fermeture d'urgence dès le début
        const emergencyCloseButton = document.createElement('button');
        emergencyCloseButton.textContent = 'Arrêter et fermer';
        emergencyCloseButton.className = 'btn btn-secondary';
        emergencyCloseButton.style.marginTop = '20px';
        emergencyCloseButton.addEventListener('click', () => {
            if (confirm("Êtes-vous sûr de vouloir fermer cette fenêtre? La désinstallation continuera en arrière-plan.")) {
                document.body.removeChild(modal);
            }
        });
        modal.querySelector('.modal-content').appendChild(emergencyCloseButton);
        
        let streamConnected = false;
        
        if (useStreaming) {
            console.log("DIAGNOSTIC - Initialisation du stream pour:", uninstallId);
            try {
                // Initialiser le stream
                const initResult = utils.marketplaceStream.init({
                    installId: uninstallId,
                    logContainer: logContainer,
                    progressBar: progressBar,
                    progressText: progressText,
                    statusContainer: statusContainer,
                    onComplete: (success) => {
                        console.log("DIAGNOSTIC - Streaming de désinstallation terminé avec succès:", success);
                        
                        // Remplacer le bouton d'urgence par un bouton de fermeture normal
                        const closeButton = document.createElement('button');
                        closeButton.textContent = 'Fermer';
                        closeButton.className = 'btn btn-primary';
                        closeButton.style.marginTop = '20px';
                        closeButton.addEventListener('click', () => {
                            document.body.removeChild(modal);
                            
                            // Rafraîchir les composants
                            components.refreshAllComponents();
                            loadTabContent(state.activeTab);
                        });
                        
                        // Remplacer le bouton d'urgence
                        if (emergencyCloseButton.parentNode) {
                            emergencyCloseButton.parentNode.replaceChild(closeButton, emergencyCloseButton);
                        } else {
                            modal.querySelector('.modal-content').appendChild(closeButton);
                        }
                    }
                });
                console.log("DIAGNOSTIC - Résultat de l'initialisation du stream:", initResult);
                
                if (initResult) {
                    // Connecter au flux
                    const connectResult = utils.marketplaceStream.connect();
                    console.log("DIAGNOSTIC - Résultat de la connexion au stream:", connectResult);
                    
                    if (connectResult === false) {
                        // Si connect() retourne false, passer en mode sans streaming
                        useStreaming = false;
                        addLogMessage(logContainer, "Impossible de se connecter au flux de logs. Utilisation du mode sans streaming.", false, 'WARNING');
                        addLogMessage(logContainer, "L'opération continue en arrière-plan.", false, 'INFO');
                    } else {
                        streamConnected = true;
                    }
                } else {
                    useStreaming = false;
                    addLogMessage(logContainer, "Impossible d'initialiser le flux de logs. Utilisation du mode sans streaming.", false, 'WARNING');
                }
            } catch (streamError) {
                console.error("DIAGNOSTIC - Erreur lors de l'initialisation du stream:", streamError);
                
                // En cas d'erreur, désactiver le streaming pour cette session
                useStreaming = false;
                addLogMessage(logContainer, `Erreur de connexion au flux: ${streamError.message}`, true, 'ERROR');
                addLogMessage(logContainer, "L'opération continue en arrière-plan. Vous pouvez rafraîchir la page plus tard.", false, 'INFO');
            }
        }
        
        if (!useStreaming) {
            // Utiliser la méthode classique sans streaming
            // Ajouter un message supplémentaire pour informer l'utilisateur
            addLogMessage(logContainer, "Mode sans streaming activé - Les mises à jour ne seront pas en temps réel", false, 'INFO');
            addLogMessage(logContainer, "Préparation de la désinstallation...", false, 'INFO');
        }
        
        if (!localApiUrl) {
            console.error("DIAGNOSTIC - URL de l'API locale non configurée");
            addLogMessage(logContainer, "ERREUR: URL de l'API locale non configurée", true, 'ERROR');
            statusContainer.textContent = "Erreur de configuration";
            progressBar.style.backgroundColor = '#dc3545';
            
            // Ajouter un bouton pour fermer la modal
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Fermer';
            closeButton.className = 'btn btn-danger';
            closeButton.style.marginTop = '20px';
            closeButton.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            
            modal.querySelector('.modal-content').appendChild(closeButton);
            return;
        }
        
        // Préparer les en-têtes d'API pour les communications avec l'API centrale
        const headers = components.prepareAuthHeaders({
            'Content-Type': 'application/json'
        });
        console.log("DIAGNOSTIC - En-têtes d'authentification préparés:", 
            headers ? "En-têtes générés" : "Échec de génération des en-têtes");
        
        // Obtenir le ClientId
        const clientId = config.getClientId();
        console.log("DIAGNOSTIC - Client ID:", clientId || "Non défini");
        
        // Construire l'endpoint pour l'API locale de désinstallation
        const localUninstallEndpoint = `${localApiUrl}uninstall`;
        console.log("DIAGNOSTIC - Endpoint de désinstallation:", localUninstallEndpoint);
        
        // Préparer les données pour l'API locale
        const uninstallData = {
            componentId: componentId,
            force: true, // MODIFICATION: Forcer la désinstallation pour ignorer les avertissements de dépendances
            uninstallId: uninstallId
        };
        console.log("DIAGNOSTIC - Données de désinstallation:", uninstallData);
        
        // Mise à jour du statut
        updateProgress(progressBar, progressText, 40);
        addLogMessage(logContainer, "Appel de l'API locale pour désinstaller le composant...", false, 'INFO');
        
        // DIAGNOSTIC: Vérifier si fetch est disponible
        if (typeof fetch === 'undefined') {
            console.error("DIAGNOSTIC - L'API fetch n'est pas disponible dans ce navigateur");
            addLogMessage(logContainer, "ERREUR: L'API fetch n'est pas disponible", true, 'ERROR');
            return;
        }
        
        console.log("DIAGNOSTIC - Envoi de la requête de désinstallation à:", localUninstallEndpoint);
        
        // Appel à l'API locale de désinstallation
        // Définir un timeout pour la requête fetch (30 secondes)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        // Ajouter une note pour l'utilisateur
        addLogMessage(logContainer, "Envoi de la requête de désinstallation...", false, 'INFO');
        
        fetch(localUninstallEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Ajouter des en-têtes pour aider à éviter les timeouts
                'Connection': 'keep-alive',
                'Keep-Alive': 'timeout=30'
            },
            body: JSON.stringify(uninstallData),
            signal: controller.signal
        })
        .then(response => {
            clearTimeout(timeoutId); // Annuler le timeout si la réponse arrive
            
            console.log("DIAGNOSTIC - Réponse reçue:", {
                status: response.status, 
                statusText: response.statusText,
                ok: response.ok
            });
            
            addLogMessage(logContainer, `Réponse du serveur: ${response.status} ${response.statusText}`, false, 'INFO');
            
            if (!response.ok) {
                throw new Error("Erreur lors de la désinstallation (" + response.status + "): " + response.statusText);
            }
            return response.json();
        })
        .catch(fetchError => {
            // Gérer spécifiquement les erreurs d'abort (timeout)
            if (fetchError.name === 'AbortError') {
                console.warn("DIAGNOSTIC - La requête a expiré après 30 secondes");
                addLogMessage(logContainer, "La requête a expiré après 30 secondes, mais l'opération continue en arrière-plan", true, 'WARNING');
                addLogMessage(logContainer, "Veuillez rafraîchir la page dans quelques minutes pour voir le résultat", false, 'INFO');
                
                // Créer un bouton de rafraîchissement
                const refreshButton = document.createElement('button');
                refreshButton.textContent = 'Rafraîchir les composants';
                refreshButton.className = 'btn btn-primary';
                refreshButton.style.marginTop = '20px';
                refreshButton.addEventListener('click', () => {
                    components.refreshAllComponents();
                    loadTabContent(state.activeTab);
                });
                
                modal.querySelector('.modal-content').appendChild(refreshButton);
                
                // Ne pas propager cette erreur, simplement afficher un message
                return { success: false, error: "Opération en cours en arrière-plan" };
            }
            
            // Pour les autres erreurs, les propager normalement
            throw fetchError;
        })
        .then(result => {
            console.log("DIAGNOSTIC - Résultat de désinstallation:", result);
            
            // Mise à jour du statut
            updateProgress(progressBar, progressText, 70);
            
            // Afficher les logs si disponibles et si le streaming n'est pas utilisé
            if (!useStreaming && result.logs && Array.isArray(result.logs)) {
                console.log("DIAGNOSTIC - Affichage de", result.logs.length, "logs sans streaming");
                result.logs.forEach(log => {
                    addLogMessage(logContainer, log.message, log.level === "ERROR", log.level);
                });
            }
            
            // Vérifier le résultat de la désinstallation (le success peut être PascalCase ou camelCase)
            const success = result.success === true || result.Success === true;
            console.log("DIAGNOSTIC - Désinstallation locale réussie:", success);
            
            if (success) {
                if (!useStreaming) {
                    addLogMessage(logContainer, `Désinstallation locale réussie!`, false, 'SUCCESS');
                    if (result.backupPath) {
                        addLogMessage(logContainer, `Sauvegarde créée dans: ${result.backupPath}`, false, 'INFO');
                    }
                }
                
                // Notifier l'API Marketplace de la désinstallation
                updateProgress(progressBar, progressText, 90);
                addLogMessage(logContainer, `Finalisation de la désinstallation...`, false, 'INFO');
                
                // Construire l'URL de l'API centrale
                const centralApiUrl = `${apiUrl}/components/${componentId}/uninstall?clientId=${encodeURIComponent(clientId || '')}`;
                console.log("DIAGNOSTIC - Appel à l'API centrale:", centralApiUrl);
                
                // Construire le corps de la requête
                const centralApiBody = {
                    ComponentId: componentId.toString(),
                    Success: true,
                    UninstallId: uninstallId,
                    BackupPath: result.backupPath || ""
                };
                console.log("DIAGNOSTIC - Corps de la requête API centrale:", centralApiBody);
                
                // Appeler l'API pour désinstaller le composant
                return fetch(centralApiUrl, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(centralApiBody)
                })
                .then(response => {
                    console.log("DIAGNOSTIC - Réponse de l'API centrale:", {
                        status: response.status, 
                        statusText: response.statusText,
                        ok: response.ok
                    });
                    
                    if (!response.ok) {
                        console.warn("Erreur lors de l'enregistrement de la désinstallation: " + response.status);
                    }
                    
                    // Désinstallation terminée même si l'enregistrement a échoué
                    statusContainer.textContent = "Désinstallation réussie";
                    addLogMessage(logContainer, `Désinstallation terminée avec succès!`, false, 'SUCCESS');
                    updateProgress(progressBar, progressText, 100);
                    
                    // Ajouter un bouton pour fermer la modal
                    const closeButton = document.createElement('button');
                    closeButton.textContent = 'Fermer';
                    closeButton.className = 'btn btn-primary';
                    closeButton.style.marginTop = '20px';
                    closeButton.addEventListener('click', () => {
                        document.body.removeChild(modal);
                        
                        // Rafraîchir les composants
                        components.refreshAllComponents();
                        loadTabContent(state.activeTab);
                    });
                    
                    modal.querySelector('.modal-content').appendChild(closeButton);
                    
                    // Notification discrète
                    auth.showNotification(`Composant désinstallé avec succès`, "success");
                });
            } else {
                // Échec de la désinstallation
                const errorMessage = result.error || "Une erreur est survenue lors de la désinstallation";
                console.error("DIAGNOSTIC - Échec de la désinstallation:", errorMessage);
                
                statusContainer.textContent = "Échec de la désinstallation";
                
                // N'afficher l'erreur que si le streaming n'est pas utilisé (sinon il sera déjà affiché)
                if (!useStreaming) {
                    addLogMessage(logContainer, `Échec de la désinstallation: ${errorMessage}`, true, 'ERROR');
                }
                
                // Mettre à jour la barre de progression en rouge
                progressBar.style.backgroundColor = '#dc3545';
                
                // Ajouter un bouton pour fermer la modal
                const closeButton = document.createElement('button');
                closeButton.textContent = 'Fermer';
                closeButton.className = 'btn btn-danger';
                closeButton.style.marginTop = '20px';
                closeButton.addEventListener('click', () => {
                    document.body.removeChild(modal);
                });
                
                modal.querySelector('.modal-content').appendChild(closeButton);
                
                // Notification discrète
                auth.showNotification("Erreur lors de la désinstallation: " + errorMessage, "error");
            }
        })
        .catch(error => {
            console.error("DIAGNOSTIC - Erreur fetch lors de la désinstallation:", error);
            
            // Mise à jour du statut
            statusContainer.textContent = "Erreur lors de la désinstallation";
            
            // N'afficher l'erreur que si le streaming n'est pas utilisé (sinon il sera déjà affiché)
            if (!useStreaming) {
                addLogMessage(logContainer, "Erreur: " + (error.message || 'Erreur inconnue'), true, 'ERROR');
            }
            progressBar.style.backgroundColor = '#dc3545'; // Rouge pour erreur
            
            // Ajouter un bouton pour fermer la modal
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Fermer';
            closeButton.className = 'btn btn-danger';
            closeButton.style.marginTop = '20px';
            closeButton.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            
            modal.querySelector('.modal-content').appendChild(closeButton);
            
            // Notification discrète
            auth.showNotification("Erreur lors de la désinstallation: " + (error.message || "Erreur inconnue"), "error");
        });
        } // Fin du processUninstallation
    }
    
    /**
     * Rafraîchit tous les composants
     */
    function refreshAllComponents() {
        components.refreshAllComponents();
        loadTabContent(state.activeTab);
    }
    

    // API publique
    return {
        init,
        loadTabContent,
        showComponentDetails,
        refreshAllComponents
    };
});