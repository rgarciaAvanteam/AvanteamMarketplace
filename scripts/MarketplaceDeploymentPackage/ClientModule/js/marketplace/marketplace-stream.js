/**
 * marketplace-stream.js - Gestion du streaming en temps réel des logs d'installation
 * Module responsable de la connexion SSE et de l'affichage des logs en temps réel
 * 
 * Ce module permet de:
 * - Se connecter à un flux SSE (Server-Sent Events) pour recevoir les logs d'installation en temps réel
 * - Afficher les logs dans l'interface utilisateur avec formatage selon le niveau (INFO, ERROR, etc.)
 * - Mettre à jour une barre de progression basée sur les étapes d'installation détectées
 * - Gérer les états de connexion et les erreurs
 * 
 * Dernière modification: Mai 2025
 * Modifications:
 * - Correction du comportement de la barre de progression pour garder une couleur bleue constante
 * - Amélioration de la détection des erreurs et du traitement des caractères spéciaux
 * - Ajout d'un mécanisme de diagnostic pour faciliter le débogage
 */

/**
 * MarketplaceStream - Classe pour gérer le streaming des logs d'installation
 * 
 * Cette classe centralise toute la logique de connexion au flux SSE, de traitement
 * et d'affichage des logs, ainsi que la mise à jour de l'interface utilisateur
 * pendant le processus d'installation des composants.
 */
class MarketplaceStream {
    /**
     * Constructeur - Initialise les propriétés de base de l'objet MarketplaceStream
     * 
     * Propriétés:
     * - eventSource: Référence à la connexion SSE (EventSource)
     * - installId: Identifiant unique de l'installation en cours
     * - logContainer: Élément DOM où afficher les logs
     * - progressBar: Élément DOM de la barre de progression
     * - progressText: Élément DOM du texte de progression (pourcentage)
     * - statusContainer: Élément DOM pour afficher l'état de connexion
     * - onCompleteCallback: Fonction à appeler lorsque l'installation est terminée
     * - logMessages: Tableau stockant tous les messages de log reçus
     * - progressIndicators: Définition des étapes d'installation et des niveaux de progression associés
     */
    constructor() {
        // Connexion et identifiants
        this.eventSource = null;       // Référence à la connexion SSE
        this.installId = null;         // ID unique de l'installation en cours
        
        // Éléments DOM pour l'interface utilisateur
        this.logContainer = null;      // Conteneur pour les logs
        this.progressBar = null;       // Barre de progression visuelle
        this.progressText = null;      // Texte du pourcentage
        this.statusContainer = null;   // Indicateur d'état
        this.onCompleteCallback = null; // Fonction à appeler quand terminé
        
        // Stockage des données
        this.logMessages = [];         // Historique complet des logs
        
        // Indicateurs de progression basés sur des mots-clés dans les logs
        this.progressIndicators = {
            downloading: { key: "Téléchargement", progress: 20 },          // 20% - Début du téléchargement
            extracting: { key: "Extraction réussie", progress: 30 },       // 30% - Extraction terminée
            installing: { key: "Installation des fichiers", progress: 50 }, // 50% - Installation des fichiers
            postInstall: { key: "DÉBUT DU SCRIPT POST-INSTALLATION", progress: 70 }, // 70% - Script post-installation
            complete: { key: "terminée avec succès", progress: 100 }        // 100% - Installation complète
        };
    }

    /**
     * Initialiser le stream pour une installation
     * 
     * Cette méthode configure le système de streaming pour une installation spécifique
     * en associant les éléments DOM nécessaires et l'identifiant d'installation.
     * 
     * @param {Object} options - Options de configuration
     * @param {string} options.installId - ID unique d'installation pour identifier le flux
     * @param {HTMLElement} options.logContainer - Conteneur DOM où afficher les logs
     * @param {HTMLElement} options.progressBar - Élément DOM de la barre de progression
     * @param {HTMLElement} options.progressText - Élément DOM pour afficher le pourcentage
     * @param {HTMLElement} options.statusContainer - Élément DOM pour afficher l'état de connexion
     * @param {Function} options.onComplete - Fonction de callback à exécuter lorsque l'installation est terminée
     * @returns {boolean} - true si l'initialisation a réussi, false sinon
     */
    init(options) {
        // Extraire les options
        const { installId, logContainer, progressBar, progressText, statusContainer, onComplete } = options;

        // Configurer les propriétés de l'objet
        this.installId = installId;
        this.logContainer = logContainer;
        this.progressBar = progressBar;
        this.progressText = progressText;
        this.statusContainer = statusContainer;
        this.onCompleteCallback = onComplete;

        // Réinitialiser les messages de log
        this.logMessages = [];
        
        // Vérification de sécurité: le conteneur de logs est obligatoire
        if (!this.logContainer) {
            console.error("MarketplaceStream: Conteneur de logs non spécifié");
            return false;
        }

        // Initialisation réussie
        return true;
    }

    /**
     * Connecter au flux SSE (Server-Sent Events)
     * 
     * Cette méthode établit une connexion au flux SSE pour recevoir les logs
     * d'installation en temps réel. Elle configure les gestionnaires d'événements
     * nécessaires pour traiter les messages entrants et gérer les erreurs.
     * 
     * @returns {boolean} - true si la connexion a été établie, false sinon
     */
    connect() {
        // Vérification de sécurité: l'ID d'installation est obligatoire
        if (!this.installId) {
            console.error("MarketplaceStream: ID d'installation non spécifié");
            return false;
        }

        // Fermer toute connexion existante pour éviter les doublons
        this.disconnect();

        try {
            // Déterminer l'URL du flux SSE en utilisant l'API locale
            const baseUrl = this.getLocalApiBaseUrl();
            const streamUrl = `${baseUrl}/stream/${this.installId}`;
            
            // Ajouter un message initial dans les logs pour indiquer la tentative de connexion
            this.addLogMessage("Connexion au flux de logs...", "INFO");
            
            // Établir la connexion SSE
            this.eventSource = new EventSource(streamUrl);
            
            // --- Configuration des gestionnaires d'événements ---
            
            // 1. Événement 'log': réception des messages de log
            this.eventSource.addEventListener('log', (event) => {
                try {
                    // Analyser les données JSON reçues
                    const logData = JSON.parse(event.data);
                    // Traiter le message et mettre à jour l'interface
                    this.processLogMessage(logData);
                } catch (error) {
                    console.error("MarketplaceStream: Erreur de traitement du message", error);
                }
            });
            
            // 2. Événement 'open': connexion établie avec succès
            this.eventSource.onopen = () => {
                console.log(`MarketplaceStream: Connexion établie pour l'installation ${this.installId}`);
                this.addLogMessage("Connexion au flux de logs établie", "SUCCESS");
                this.updateStatus("connected");
            };
            
            // 3. Événement 'error': problème avec la connexion SSE
            this.eventSource.onerror = (error) => {
                console.error('MarketplaceStream: Erreur SSE', error);
                this.addLogMessage("Erreur de connexion au flux de logs", "ERROR");
                this.updateStatus("error");
                
                // Note: On ne déconnecte pas automatiquement car l'erreur peut être temporaire
                // et la connexion peut se rétablir d'elle-même
            };
            
            return true;
        } catch (error) {
            // Gestion des erreurs lors de la tentative de connexion
            console.error("MarketplaceStream: Erreur lors de la connexion au flux SSE", error);
            this.addLogMessage(`Erreur de connexion: ${error.message}`, "ERROR");
            this.updateStatus("error");
            return false;
        }
    }

    /**
     * Déconnecter du flux SSE
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
     * Traiter un message de log
     * @param {Object} logData - Données du log
     */
    processLogMessage(logData) {
        // Vérifier que les propriétés nécessaires existent
        if (!logData || typeof logData !== 'object') {
            console.error("MarketplaceStream: Message de log invalide", logData);
            return;
        }
        
        // Journaliser l'objet complet pour débogage
        console.log("MarketplaceStream: Message reçu", JSON.stringify(logData));
        
        // S'assurer que text et level existent
        const text = logData.Text || logData.text || logData.Message || logData.message || "";
        const level = logData.Level || logData.level || "INFO";
        
        // Créer un objet normalisé
        const normalizedLogData = {
            text: text,
            level: level,
            timestamp: logData.Timestamp || logData.timestamp || new Date()
        };
        
        // Ajouter le message au tableau
        this.logMessages.push(normalizedLogData);
        
        // Ajouter le message à l'interface
        this.addLogMessage(normalizedLogData.text, normalizedLogData.level);
        
        // Mettre à jour la progression
        this.updateProgressFromLog(normalizedLogData);
        
        // Vérifier si l'installation est terminée
        if (this.isInstallationComplete(normalizedLogData)) {
            this.finalizeInstallation(normalizedLogData);
        }
    }

    /**
     * Ajouter un message au conteneur de logs
     * @param {string} message - Message à ajouter
     * @param {string} level - Niveau de log (INFO, WARNING, ERROR, SUCCESS, SCRIPT)
     */
    addLogMessage(message, level) {
        if (!this.logContainer) return;
        
        // Ignorer les messages vides
        if (!message || message.trim() === "") {
            console.log("MarketplaceStream: Message vide ignoré");
            return;
        }
        
        console.log(`MarketplaceStream: Ajout de message [${level}] ${message}`);
        
        const timestamp = new Date().toLocaleTimeString();
        const logItem = document.createElement('div');
        
        // Déterminer la classe CSS basée sur le niveau
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
        
        // Gérer l'affichage spécial des sections de script
        if (level === 'SCRIPT_SECTION' && message.includes('======')) {
            // C'est un séparateur, afficher une ligne distincte
            const separator = document.createElement('hr');
            separator.className = 'script-separator';
            this.logContainer.appendChild(separator);
            
            // Si c'est un début de section script, ajuster l'affichage
            if (message.includes('DÉBUT DU SCRIPT')) {
                logItem.className = `log-item ${logClass} script-header`;
                logItem.innerHTML = `<b>${message.replace('[INFO]', '').trim()}</b>`;
            } else if (message.includes('FIN DU SCRIPT')) {
                logItem.className = `log-item ${logClass} script-footer`;
                logItem.innerHTML = `<b>${message.replace('[INFO]', '').trim()}</b>`;
            } else {
                // Ignorer les séparateurs simples
                return;
            }
        } else {
            // Affichage normal des logs
            logItem.className = `log-item ${logClass}`;
            
            // Si c'est un log de script, le mettre en évidence différemment
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
     * Mettre à jour la progression en fonction du message de log
     * @param {Object} logData - Données du log
     */
    updateProgressFromLog(logData) {
        if (!this.progressBar || !this.progressText) return;
        
        // Rechercher des indicateurs de progression dans le message
        let newProgress = null;
        let hasError = logData.level === 'ERROR';
        
        // Vérifier chaque indicateur de progression
        for (const [key, indicator] of Object.entries(this.progressIndicators)) {
            if (logData.text.includes(indicator.key)) {
                newProgress = indicator.progress;
                break;
            }
        }
        
        // Si nous avons une nouvelle progression, la mettre à jour
        if (newProgress !== null) {
            this.updateProgress(newProgress, hasError);
        } else if (hasError) {
            // Si c'est une erreur sans progression spécifique
            this.signalError();
        }
    }

    /**
     * Mettre à jour la barre de progression visuelle
     * 
     * Cette méthode met à jour l'affichage de la barre de progression avec
     * le pourcentage spécifié. La barre ne peut pas reculer (réduire sa valeur)
     * et sa couleur reste bleue tout au long du processus normal d'installation.
     * Elle devient rouge uniquement en cas d'erreur.
     * 
     * @param {number} percent - Pourcentage de progression (0-100)
     * @param {boolean} isError - Si true, la barre devient rouge pour indiquer une erreur
     */
    updateProgress(percent, isError = false) {
        // Vérifier que les éléments DOM existent
        if (!this.progressBar || !this.progressText) return;
        
        // Protection: ne jamais réduire la progression (toujours avancer)
        // Sauf si on est à 100% (permet de recommencer une nouvelle installation)
        const currentWidth = parseInt(this.progressBar.style.width) || 0;
        if (percent < currentWidth && currentWidth < 100) {
            return;
        }
        
        // Mettre à jour l'affichage visuel
        this.progressBar.style.width = `${percent}%`;  // Largeur de la barre
        this.progressText.textContent = `${percent}%`; // Texte du pourcentage
        
        // Gestion des couleurs - Bleu par défaut, Rouge en cas d'erreur
        // Important: La barre reste toujours bleue pendant le processus normal
        if (isError) {
            this.progressBar.style.backgroundColor = '#dc3545'; // Rouge pour erreur
        } else {
            this.progressBar.style.backgroundColor = '#007bff'; // Bleu pour toutes les étapes
        }
    }

    /**
     * Signaler une erreur dans la progression
     */
    signalError() {
        if (!this.progressBar) return;
        
        // Mettre en rouge sans changer la progression
        this.progressBar.style.backgroundColor = '#dc3545';
        
        // Mettre à jour le statut
        this.updateStatus("error");
    }

    /**
     * Mettre à jour le conteneur de statut
     * @param {string} status - Statut de l'installation (connected, disconnected, error, complete)
     */
    updateStatus(status) {
        if (!this.statusContainer) return;
        
        // Classes et textes en fonction du statut
        const statusMap = {
            connected: { class: 'status-connected', text: 'Connecté' },
            disconnected: { class: 'status-disconnected', text: 'Déconnecté' },
            error: { class: 'status-error', text: 'Erreur' },
            complete: { class: 'status-complete', text: 'Terminé' },
            warning: { class: 'status-warning', text: 'Avertissement' }
        };
        
        const statusInfo = statusMap[status] || statusMap.disconnected;
        
        // Mettre à jour la classe et le texte
        this.statusContainer.className = `installation-status ${statusInfo.class}`;
        this.statusContainer.textContent = statusInfo.text;
    }

    /**
     * Vérifier si l'installation est terminée
     * @param {Object} logData - Données du log
     * @returns {boolean} True si l'installation est terminée
     */
    isInstallationComplete(logData) {
        // Vérifier les messages indiquant une fin d'installation avec succès
        if (logData.text.includes('terminée avec succès') || 
            logData.text.includes('Installation réussie')) {
            return true;
        }
        
        // Vérifier les messages d'erreur fatale qui bloquent complètement l'installation
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
     * Finaliser l'installation
     * @param {Object} finalLogData - Dernières données de log
     */
    finalizeInstallation(finalLogData) {
        // Analyser tous les logs pour déterminer le succès global
        const hasTerminalError = this.hasTerminalError();
        const hasCriticalError = this.hasCriticalError();
        const hasSuccessfulInstallation = this.hasSuccessfulInstallation();
        
        // Déterminer le statut final
        // Traiter comme un succès avec avertissement si:
        // 1. Il y a une indication explicite de réussite finale ET
        // 2. Pas d'erreur qui bloque complètement l'installation
        const isSuccess = hasSuccessfulInstallation && !hasTerminalError;
        
        // Déterminer si c'est un succès partiel (avec des erreurs non critiques)
        const isPartialSuccess = isSuccess && hasCriticalError;
        
        // Mettre à jour la barre de progression à 100%
        this.updateProgress(100, hasTerminalError);
        
        // Mettre à jour le statut selon la situation
        if (isSuccess) {
            if (isPartialSuccess) {
                this.updateStatus("warning");
                this.addLogMessage("Installation terminée avec avertissements", "WARNING");
            } else {
                this.updateStatus("complete");
                this.addLogMessage("Installation terminée avec succès", "SUCCESS");
            }
        } else {
            this.updateStatus("error");
            this.addLogMessage("Installation terminée avec des erreurs", "ERROR");
        }
        
        // Se déconnecter après un court délai
        setTimeout(() => this.disconnect(), 2000);
        
        // Exécuter le callback de fin si défini
        if (typeof this.onCompleteCallback === 'function') {
            this.onCompleteCallback(isSuccess, this.logMessages);
        }
    }
    
    /**
     * Vérifie si les logs contiennent une erreur qui bloque complètement l'installation
     * @returns {boolean} true si une erreur terminale est présente
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
     * Vérifie si les logs contiennent des erreurs critiques mais non terminales
     * @returns {boolean} true si une erreur critique est présente
     */
    hasCriticalError() {
        return this.logMessages.some(log => 
            log.level === 'ERROR' && !this.hasTerminalError()
        );
    }
    
    /**
     * Vérifie si l'installation s'est terminée avec succès selon les logs
     * @returns {boolean} true si l'installation a réussi
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
     * Obtenir l'URL de base de l'API locale
     * @returns {string} URL de base
     */
    getLocalApiBaseUrl() {
        // Reprendre la logique de l'URL de l'API locale du marketplace.js
        // Par défaut, l'API locale est sur le même serveur que l'application web
        if (typeof localApiUrl !== 'undefined') {
            return localApiUrl;
        }
        
        // Construire une URL par défaut si localApiUrl n'est pas défini
        const origin = window.location.origin;
        const baseDir = window.location.pathname.split('/').slice(0, -1).join('/');
        
        // Stratégie 1: API d'installation dans un sous-répertoire
        return `${origin}${baseDir}/api-installer`;
    }

    /**
     * Vider le conteneur de logs
     */
    clearLogs() {
        if (this.logContainer) {
            this.logContainer.innerHTML = '';
        }
        this.logMessages = [];
    }

    /**
     * Réinitialiser l'état complet du composant
     * 
     * Cette méthode réinitialise complètement le système de streaming:
     * - Déconnecte du flux SSE s'il existe
     * - Vide tous les logs affichés et stockés
     * - Remet la barre de progression à zéro et en bleu
     * - Réinitialise l'indicateur d'état à "déconnecté"
     * 
     * Utilisée typiquement avant de commencer une nouvelle installation ou
     * lors du nettoyage de l'interface utilisateur.
     */
    reset() {
        // Déconnecter du flux SSE
        this.disconnect();
        
        // Supprimer tous les logs
        this.clearLogs();
        
        // Réinitialiser la barre de progression à 0% (toujours en bleu)
        if (this.progressBar && this.progressText) {
            this.progressBar.style.width = '0%';
            this.progressText.textContent = '0%';
            this.progressBar.style.backgroundColor = '#007bff'; // Bleu
        }
        
        // Réinitialiser l'indicateur d'état
        this.updateStatus("disconnected");
    }
}

// Créer une instance unique
const marketplaceStream = new MarketplaceStream();

// Exposer globalement
window.marketplaceStream = marketplaceStream;