/**
 * utils.js - Fonctions utilitaires pour le Marketplace
 * 
 * Fournit des utilitaires communs utilisés par plusieurs modules
 */

MarketplaceMediator.defineModule('utils', [], function() {
    /**
     * Compare deux versions sémantiques (semver)
     * @param {string} a - Première version
     * @param {string} b - Deuxième version
     * @returns {number} - Négatif si a < b, positif si a > b, 0 si égales
     */
    function compareVersions(a, b) {
        const partsA = a.split('.').map(Number);
        const partsB = b.split('.').map(Number);
        
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const numA = partsA[i] || 0;
            const numB = partsB[i] || 0;
            
            if (numA !== numB) {
                return numA - numB;
            }
        }
        
        return 0;
    }
    
    /**
     * Formate une date au format local
     * @param {string} dateStr - Date au format ISO
     * @returns {string} - Date formatée
     */
    function formatDate(dateStr) {
        if (!dateStr) return '';
        
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString();
        } catch (error) {
            console.error('Erreur de formatage de date:', error);
            return dateStr;
        }
    }
    
    /**
     * Crée un identifiant unique
     * @returns {string} - Identifiant unique
     */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
    
    /**
     * Nettoie et normalise un tableau de tags
     * @param {Array|Object} tags - Tags à normaliser
     * @returns {Array} - Tableau de tags normalisé
     */
    function normalizeTags(tags) {
        if (!tags) return [];
        
        // Si c'est déjà un tableau
        if (Array.isArray(tags)) {
            return tags;
        }
        
        // Format spécifique de .NET avec $values
        if (tags.$values && Array.isArray(tags.$values)) {
            return tags.$values;
        }
        
        return [];
    }
    
    /**
     * Détecte le type de données et extrait un tableau
     * @param {any} data - Données à normaliser
     * @returns {Array} - Tableau extrait
     */
    function extractArray(data) {
        if (!data) return [];
        
        // Si c'est déjà un tableau
        if (Array.isArray(data)) {
            return data;
        }
        
        // Format spécifique de .NET avec $values
        if (data.$values && Array.isArray(data.$values)) {
            return data.$values;
        }
        
        // Format avec propriétés courantes
        if (data.items && Array.isArray(data.items)) {
            return data.items;
        }
        
        if (data.components && Array.isArray(data.components)) {
            return data.components;
        }
        
        if (data.components && data.components.$values && Array.isArray(data.components.$values)) {
            return data.components.$values;
        }
        
        if (data.data && Array.isArray(data.data)) {
            return data.data;
        }
        
        console.warn('Format inconnu, impossible d\'extraire un tableau:', data);
        return [];
    }
    
    /**
     * Sauvegarde des données dans localStorage
     * @param {string} key - Clé
     * @param {any} value - Valeur à sauvegarder
     */
    function saveToStorage(key, value) {
        try {
            const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
            localStorage.setItem(key, serialized);
        } catch (error) {
            console.error('Erreur lors de la sauvegarde dans localStorage:', error);
        }
    }
    
    /**
     * Récupère des données depuis localStorage
     * @param {string} key - Clé
     * @param {any} defaultValue - Valeur par défaut
     * @returns {any} - Valeur ou valeur par défaut
     */
    function getFromStorage(key, defaultValue) {
        try {
            const value = localStorage.getItem(key);
            
            if (value === null) {
                return defaultValue;
            }
            
            // Essayer de parser comme JSON
            try {
                return JSON.parse(value);
            } catch {
                // Si échec, retourner la chaîne
                return value;
            }
        } catch (error) {
            console.error('Erreur lors de la récupération depuis localStorage:', error);
            return defaultValue;
        }
    }
    
    /**
     * Débounce une fonction
     * @param {Function} func - Fonction à debouncer
     * @param {number} wait - Délai d'attente en ms
     * @returns {Function} - Fonction debouncée
     */
    function debounce(func, wait) {
        let timeout;
        
        return function(...args) {
            const context = this;
            
            clearTimeout(timeout);
            
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
    
    /**
     * Classe MarketplaceStream pour la gestion des flux SSE
     */
    class MarketplaceStream {
        constructor() {
            this.eventSource = null;
            this.installId = null;
            this.logContainer = null;
            this.progressBar = null;
            this.progressText = null;
            this.statusContainer = null;
            this.onCompleteCallback = null;
            this.logMessages = [];
            
            // Indicateurs de progression basés sur des mots-clés dans les logs
            this.progressIndicators = {
                downloading: { key: "Téléchargement", progress: 20 },
                extracting: { key: "Extraction réussie", progress: 30 },
                installing: { key: "Installation des fichiers", progress: 50 },
                postInstall: { key: "DÉBUT DU SCRIPT POST-INSTALLATION", progress: 70 },
                complete: { key: "terminée avec succès", progress: 100 }
            };
        }
        
        /**
         * Initialise le stream pour une installation
         * @param {Object} options - Options de configuration
         */
        init(options) {
            const { installId, logContainer, progressBar, progressText, statusContainer, onComplete } = options;
            
            this.installId = installId;
            this.logContainer = logContainer;
            this.progressBar = progressBar;
            this.progressText = progressText;
            this.statusContainer = statusContainer;
            this.onCompleteCallback = onComplete;
            
            this.logMessages = [];
            
            if (!this.logContainer) {
                console.error("MarketplaceStream: Conteneur de logs non spécifié");
                return false;
            }
            
            return true;
        }
        
        /**
         * Connecte au flux SSE
         */
        connect() {
            if (!this.installId) {
                console.error("MarketplaceStream: ID d'installation non spécifié");
                return false;
            }
            
            this.disconnect();
            
            try {
                // Utiliser le module de configuration s'il est disponible via window
                let localApiUrl = window.localApiUrl || '';
                
                // Si window.localApiUrl n'est pas défini, chercher dans la configuration de MarketplaceMediator
                if (!localApiUrl && MarketplaceMediator) {
                    try {
                        // Accéder au module config via le médiateur
                        const configModule = MarketplaceMediator.getModule('config');
                        if (configModule && configModule.getLocalApiUrl) {
                            localApiUrl = configModule.getLocalApiUrl();
                            // Définir window.localApiUrl pour les prochains appels
                            window.localApiUrl = localApiUrl;
                        }
                    } catch (configError) {
                        console.warn("MarketplaceStream: Erreur lors de l'accès au module config", configError);
                    }
                }
                
                if (!localApiUrl) {
                    console.error("MarketplaceStream: URL de l'API locale non configurée");
                    return false;
                }
                
                const streamUrl = `${localApiUrl}stream/${this.installId}`;
                
                this.addLogMessage("Connexion au flux de logs...", "INFO");
                
                // Ajouter un gestionnaire d'exceptions et un timeout pour la création EventSource
                try {
                    // Créer un timeout de secours pour éviter de bloquer en cas d'erreur silencieuse
                    const streamConnectTimeout = setTimeout(() => {
                        console.warn("MarketplaceStream: Timeout de connexion après 15 secondes");
                        this.addLogMessage("Erreur de connexion au flux: timeout après 15 secondes.", "WARNING");
                        this.addLogMessage("Continuez à surveiller l'opération, elle se poursuit en arrière-plan.", "INFO");
                        this.updateStatus("warning");
                    }, 15000);
                    
                    this.eventSource = new EventSource(streamUrl);
                    
                    // Écouter les événements de log principaux
                    this.eventSource.addEventListener('log', (event) => {
                        try {
                            // Effacer le timeout quand un événement est reçu (connexion réussie)
                            clearTimeout(streamConnectTimeout);
                            
                            const logData = JSON.parse(event.data);
                            this.processLogMessage(logData);
                        } catch (error) {
                            console.error("MarketplaceStream: Erreur de traitement du message", error);
                        }
                    });
                    
                    // Écouter les événements ping (keep-alive)
                    this.eventSource.addEventListener('ping', (event) => {
                        console.log("MarketplaceStream: Ping reçu:", event.data);
                        // Aucune action nécessaire, cet événement sert juste à maintenir la connexion
                    });
                    
                    // Écouter les événements de fermeture explicites
                    this.eventSource.addEventListener('close', (event) => {
                        console.log("MarketplaceStream: Fermeture demandée par le serveur:", event.data);
                        this.addLogMessage(`Connexion fermée par le serveur: ${event.data}`, "INFO");
                        this.disconnect();
                    });
                    
                    // Gérer les événements d'erreur spécifiques pour le streaming
                    this.eventSource.addEventListener('error', (event) => {
                        console.error("MarketplaceStream: Erreur spécifique SSE", event);
                        
                        // Si l'erreur contient des informations, les afficher
                        if (event.data) {
                            try {
                                const errorData = JSON.parse(event.data);
                                this.addLogMessage(`Erreur de streaming: ${errorData.message || "Erreur inconnue"}`, "ERROR");
                            } catch {
                                this.addLogMessage("Erreur de communication avec le serveur de logs", "ERROR");
                            }
                        }
                    });
                    
                    this.eventSource.onopen = () => {
                        // Effacer le timeout sur connexion réussie
                        clearTimeout(streamConnectTimeout);
                        
                        console.log(`MarketplaceStream: Connexion établie pour l'installation ${this.installId}`);
                        this.addLogMessage("Connexion au flux de logs établie", "SUCCESS");
                        this.updateStatus("connected");
                    };
                    
                    this.eventSource.onerror = (error) => {
                        console.log('MarketplaceStream: Erreur SSE détectée', 
                            this.eventSource ? `readyState: ${this.eventSource.readyState}` : "EventSource invalide");
                        
                        // Vérifier si l'erreur est due à une déconnexion normale ou à un problème réel
                        if (this.eventSource && this.eventSource.readyState === EventSource.CLOSED) {
                            console.log('MarketplaceStream: Connexion SSE fermée normalement');
                            // Aucune action n'est nécessaire car c'est une fermeture normale
                            return;
                        }
                        
                        // Pour les erreurs de connexion, essayer automatiquement de se reconnecter
                        if (this.eventSource && this.eventSource.readyState === EventSource.CONNECTING) {
                            console.warn('MarketplaceStream: Tentative de reconnexion SSE en cours...');
                            // Ne pas afficher d'erreur pour les tentatives de reconnexion automatiques
                            return;
                        }
                        
                        console.error('MarketplaceStream: Erreur SSE', error);
                        
                        // Vérifier si l'opération est déjà terminée pour éviter les messages d'erreur confus
                        const isAlreadyComplete = this.statusContainer && 
                            (this.statusContainer.textContent === 'Terminé' || 
                             this.statusContainer.textContent === 'Erreur' ||
                             this.statusContainer.textContent === 'Terminé avec avertissements');
                        
                        if (!isAlreadyComplete) {
                            this.addLogMessage("Erreur de connexion au flux de logs", "WARNING");
                            this.addLogMessage("L'opération continue en arrière-plan. Rafraîchissez la page une fois terminée.", "INFO");
                            this.updateStatus("warning");
                        }
                    };
                } catch (ex) {
                    console.error("MarketplaceStream: Exception lors de la création d'EventSource", ex);
                    this.addLogMessage("Impossible de se connecter au flux de logs: " + ex.message, "ERROR");
                    this.addLogMessage("L'opération continue en arrière-plan. Rafraîchissez la page une fois terminée.", "INFO");
                    this.updateStatus("error");
                    
                    // Erreur fatale - Impossible de créer EventSource
                    return false;
                }
                
                return true;
            } catch (error) {
                console.error("MarketplaceStream: Erreur lors de la connexion au flux SSE", error);
                this.addLogMessage(`Erreur de connexion: ${error.message}`, "ERROR");
                this.updateStatus("error");
                return false;
            }
        }
        
        /**
         * Déconnecte du flux SSE
         */
        disconnect() {
            if (this.eventSource) {
                this.eventSource.close();
                this.eventSource = null;
                console.log("MarketplaceStream: Déconnexion du flux");
                this.updateStatus("disconnected");
            }
        }
        
        /**
         * Traite un message de log
         * @param {Object} logData - Données du log
         */
        processLogMessage(logData) {
            if (!logData || typeof logData !== 'object') {
                console.error("MarketplaceStream: Message de log invalide", logData);
                return;
            }
            
            console.log("MarketplaceStream: Message reçu", JSON.stringify(logData));
            
            const text = logData.Text || logData.text || logData.Message || logData.message || "";
            const level = logData.Level || logData.level || "INFO";
            
            const normalizedLogData = {
                text: text,
                level: level,
                timestamp: logData.Timestamp || logData.timestamp || new Date()
            };
            
            this.logMessages.push(normalizedLogData);
            
            this.addLogMessage(normalizedLogData.text, normalizedLogData.level);
            
            this.updateProgressFromLog(normalizedLogData);
            
            if (this.isInstallationComplete(normalizedLogData)) {
                this.finalizeInstallation(normalizedLogData);
            }
        }
        
        /**
         * Ajoute un message au conteneur de logs
         * @param {string} message - Message à ajouter
         * @param {string} level - Niveau de log
         */
        addLogMessage(message, level) {
            if (!this.logContainer) return;
            
            if (!message || message.trim() === "") {
                console.log("MarketplaceStream: Message vide ignoré");
                return;
            }
            
            console.log(`MarketplaceStream: Ajout de message [${level}] ${message}`);
            
            const timestamp = new Date().toLocaleTimeString();
            const logItem = document.createElement('div');
            
            let logClass = '';
            if (level === 'ERROR') {
                logClass = 'log-error';
            } else if (level === 'WARNING') {
                logClass = 'log-warning';
            } else if (level === 'SUCCESS') {
                logClass = 'log-success';
            } else if (level === 'SCRIPT') {
                logClass = 'log-script';
            } else if (level === 'SCRIPT_SECTION') {
                logClass = 'log-script-section';
            } else {
                logClass = 'log-info';
            }
            
            if (level === 'SCRIPT_SECTION' && message.includes('======')) {
                const separator = document.createElement('hr');
                separator.className = 'script-separator';
                this.logContainer.appendChild(separator);
                
                if (message.includes('DÉBUT DU SCRIPT')) {
                    logItem.className = `log-item ${logClass} script-header`;
                    logItem.innerHTML = `<b>${message.replace('[INFO]', '').trim()}</b>`;
                } else if (message.includes('FIN DU SCRIPT')) {
                    logItem.className = `log-item ${logClass} script-footer`;
                    logItem.innerHTML = `<b>${message.replace('[INFO]', '').trim()}</b>`;
                } else {
                    return;
                }
            } else {
                logItem.className = `log-item ${logClass}`;
                
                if (level === 'SCRIPT') {
                    logItem.innerHTML = `<span class="log-script-marker">></span> ${message.replace('[SCRIPT]', '').trim()}`;
                } else {
                    logItem.innerHTML = `<span class="log-time">[${timestamp}]</span> <span class="log-level">[${level}]</span> ${message}`;
                }
            }
            
            this.logContainer.appendChild(logItem);
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
        }
        
        /**
         * Met à jour la progression en fonction du message de log
         * @param {Object} logData - Données du log
         */
        updateProgressFromLog(logData) {
            if (!this.progressBar || !this.progressText) return;
            
            let newProgress = null;
            let hasError = logData.level === 'ERROR';
            
            for (const [key, indicator] of Object.entries(this.progressIndicators)) {
                if (logData.text.includes(indicator.key)) {
                    newProgress = indicator.progress;
                    break;
                }
            }
            
            if (newProgress !== null) {
                this.updateProgress(newProgress, hasError);
            } else if (hasError) {
                this.signalError();
            }
        }
        
        /**
         * Met à jour la barre de progression
         * @param {number} percent - Pourcentage
         * @param {boolean} isError - Si c'est une erreur
         */
        updateProgress(percent, isError = false) {
            if (!this.progressBar || !this.progressText) return;
            
            const currentWidth = parseInt(this.progressBar.style.width) || 0;
            if (percent < currentWidth && currentWidth < 100) {
                return;
            }
            
            this.progressBar.style.width = `${percent}%`;
            this.progressText.textContent = `${percent}%`;
            
            if (isError) {
                this.progressBar.style.backgroundColor = '#dc3545';
            } else {
                this.progressBar.style.backgroundColor = '#007bff';
            }
        }
        
        /**
         * Signale une erreur dans la progression
         */
        signalError() {
            if (!this.progressBar) return;
            
            this.progressBar.style.backgroundColor = '#dc3545';
            
            this.updateStatus("error");
        }
        
        /**
         * Met à jour le statut de l'installation
         * @param {string} status - Statut
         */
        updateStatus(status) {
            if (!this.statusContainer) return;
            
            const statusMap = {
                connected: { class: 'status-connected', text: 'Connecté' },
                disconnected: { class: 'status-disconnected', text: 'Déconnecté' },
                error: { class: 'status-error', text: 'Erreur' },
                complete: { class: 'status-complete', text: 'Terminé' },
                warning: { class: 'status-warning', text: 'Avertissement' }
            };
            
            const statusInfo = statusMap[status] || statusMap.disconnected;
            
            // Conserver le statut "complete" même après déconnexion
            if (status === 'disconnected' && this.statusContainer.textContent === 'Terminé') {
                return; // Ne pas changer le statut si on est déjà "Terminé"
            }
            
            this.statusContainer.className = `installation-status ${statusInfo.class}`;
            this.statusContainer.textContent = statusInfo.text;
        }
        
        /**
         * Vérifie si l'installation est terminée
         * @param {Object} logData - Données du log
         * @returns {boolean} Si l'installation est terminée
         */
        isInstallationComplete(logData) {
            if (logData.text.includes('terminée avec succès') || 
                logData.text.includes('Installation réussie')) {
                return true;
            }
            
            if (logData.level === 'ERROR' && (
                logData.text.includes("L'installation ne peut pas continuer") ||
                logData.text.includes("Échec de l'installation") ||
                logData.text.includes("Le fichier téléchargé est vide ou n'existe pas")
            )) {
                return true;
            }
            
            return false;
        }
        
        /**
         * Finalise l'installation
         * @param {Object} finalLogData - Dernières données de log
         */
        finalizeInstallation(finalLogData) {
            const hasTerminalError = this.hasTerminalError();
            const hasCriticalError = this.hasCriticalError();
            const hasSuccessfulInstallation = this.hasSuccessfulInstallation();
            
            const isSuccess = hasSuccessfulInstallation && !hasTerminalError;
            const isPartialSuccess = isSuccess && hasCriticalError;
            
            this.updateProgress(100, hasTerminalError);
            
            if (isSuccess) {
                // Mettre à jour l'interface avant la déconnexion du stream
                if (isPartialSuccess) {
                    this.updateStatus("warning");
                    this.addLogMessage("Installation terminée avec avertissements", "WARNING");
                    
                    // Mettre à jour les couleurs pour avertissement
                    if (this.statusContainer) {
                        this.statusContainer.className = "installation-status status-warning";
                        this.statusContainer.textContent = "Terminé avec avertissements";
                    }
                } else {
                    this.updateStatus("complete");
                    this.addLogMessage("Installation terminée avec succès", "SUCCESS");
                    
                    // Mettre à jour les couleurs pour succès
                    if (this.statusContainer) {
                        this.statusContainer.className = "installation-status status-complete";
                        this.statusContainer.textContent = "Terminé";
                    }
                }
            } else {
                this.updateStatus("error");
                this.addLogMessage("Installation terminée avec des erreurs", "ERROR");
                
                // Mettre à jour les couleurs pour erreur
                if (this.statusContainer) {
                    this.statusContainer.className = "installation-status status-error";
                    this.statusContainer.textContent = "Erreur";
                }
            }
            
            // Sauvegarder le statut final pour éviter qu'il ne soit remplacé par "Déconnecté"
            const finalStatus = this.statusContainer ? this.statusContainer.textContent : "";
            const finalClass = this.statusContainer ? this.statusContainer.className : "";
            
            // Déconnecter avec un délai
            setTimeout(() => {
                this.disconnect();
                
                // Restaurer le statut final après la déconnexion
                if (this.statusContainer && finalStatus) {
                    this.statusContainer.textContent = finalStatus;
                    this.statusContainer.className = finalClass;
                }
            }, 2000);
            
            if (typeof this.onCompleteCallback === 'function') {
                this.onCompleteCallback(isSuccess, this.logMessages);
            }
        }
        
        /**
         * Vérifie s'il y a une erreur fatale
         * @returns {boolean} S'il y a une erreur fatale
         */
        hasTerminalError() {
            return this.logMessages.some(log => 
                log.level === 'ERROR' && (
                    log.text.includes("L'installation ne peut pas continuer") ||
                    log.text.includes("Échec complet de l'installation") ||
                    log.text.includes("Le fichier téléchargé est vide ou n'existe pas")
                )
            );
        }
        
        /**
         * Vérifie s'il y a une erreur critique
         * @returns {boolean} S'il y a une erreur critique
         */
        hasCriticalError() {
            return this.logMessages.some(log => 
                log.level === 'ERROR' && !this.hasTerminalError()
            );
        }
        
        /**
         * Vérifie si l'installation est réussie
         * @returns {boolean} Si l'installation est réussie
         */
        hasSuccessfulInstallation() {
            return this.logMessages.some(log => 
                (log.level === 'SUCCESS' && (
                    log.text.includes('terminée avec succès') || 
                    log.text.includes('Installation réussie') ||
                    log.text.includes('Installation du composant') && log.text.includes('terminée avec succès')
                ))
            );
        }
        
        /**
         * Vide le conteneur de logs
         */
        clearLogs() {
            if (this.logContainer) {
                this.logContainer.innerHTML = '';
            }
            this.logMessages = [];
        }
        
        /**
         * Réinitialise l'état
         */
        reset() {
            this.disconnect();
            this.clearLogs();
            
            if (this.progressBar && this.progressText) {
                this.progressBar.style.width = '0%';
                this.progressText.textContent = '0%';
                this.progressBar.style.backgroundColor = '#007bff';
            }
            
            this.updateStatus("disconnected");
        }
    }

    // Créer une instance unique
    const marketplaceStream = new MarketplaceStream();

    // Exposer l'instance globalement pour être compatible avec l'ancien code
    window.marketplaceStream = marketplaceStream;

    // Expose l'API publique
    return {
        compareVersions,
        formatDate,
        generateId,
        normalizeTags,
        extractArray,
        saveToStorage,
        getFromStorage,
        debounce,
        marketplaceStream // Exposer l'instance pour les autres modules
    };
});