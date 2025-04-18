/**
 * marketplace-uninstall.js - Gestion de la désinstallation des composants
 */

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

// Variable globale pour suivre si les écouteurs d'événements ont été attachés
let uninstallButtonsInitialized = false;

/**
 * Initialise les écouteurs d'événements sur les boutons de désinstallation
 * Cette fonction est appelée au chargement de la page et après les rafraîchissements
 */
function initUninstallButtons() {
    console.log("Initialisation des boutons de désinstallation");
    
    // Sélectionner tous les boutons de désinstallation
    const uninstallButtons = document.querySelectorAll(".btn-uninstall");
    
    uninstallButtons.forEach(button => {
        // S'assurer que nous n'attachons pas l'écouteur deux fois au même bouton
        if (button.getAttribute("uninstall-listener-initialized") === "true") {
            return;
        }
        
        // Récupérer le gestionnaire onclick original
        const originalOnClick = button.getAttribute("onclick");
        
        // Supprimer l'attribut onclick original
        button.removeAttribute("onclick");
        
        // Stocker l'action originale dans un attribut data
        button.setAttribute("data-original-onclick", originalOnClick);
        
        // Ajouter notre propre gestionnaire d'événements
        button.addEventListener("click", function(event) {
            event.preventDefault();
            event.stopPropagation();
            
            // Vérifier si l'utilisateur est authentifié et administrateur
            if (typeof MarketplaceAuth !== 'undefined' && !MarketplaceAuth.isAvanteamAdmin()) {
                // L'utilisateur n'est pas authentifié ou n'a pas les droits d'administrateur
                MarketplaceAuth.showNotification("Vous devez être connecté en tant qu'administrateur pour désinstaller un composant", "error");
                
                // Afficher le dialogue d'authentification
                const authPrompt = document.createElement("div");
                authPrompt.className = "auth-modal";
                authPrompt.innerHTML = `
                    <div class="auth-modal-backdrop"></div>
                    <div class="auth-modal-content">
                        <h3>Authentification requise</h3>
                        <p>La désinstallation de composants est réservée aux administrateurs Avanteam.</p>
                        <p>Veuillez vous connecter avec votre compte Avanteam pour continuer.</p>
                        <div class="auth-modal-buttons">
                            <button class="btn btn-secondary auth-modal-cancel">Annuler</button>
                            <button class="btn btn-primary auth-modal-login">Se connecter</button>
                        </div>
                    </div>
                `;
                
                // Ajouter au DOM
                document.body.appendChild(authPrompt);
                
                // Gestionnaires d'événements
                authPrompt.querySelector(".auth-modal-cancel").addEventListener("click", () => {
                    document.body.removeChild(authPrompt);
                });
                
                authPrompt.querySelector(".auth-modal-login").addEventListener("click", () => {
                    document.body.removeChild(authPrompt);
                    MarketplaceAuth.login();
                });
                
                authPrompt.querySelector(".auth-modal-backdrop").addEventListener("click", () => {
                    document.body.removeChild(authPrompt);
                });
            } else {
                // L'utilisateur est authentifié, exécuter l'action originale
                // Extraire l'ID du composant à partir de l'action originale
                const originalAction = button.getAttribute("data-original-onclick");
                const componentIdMatch = originalAction.match(/uninstallComponent\((\d+)\)/);
                
                if (componentIdMatch && componentIdMatch[1]) {
                    const componentId = parseInt(componentIdMatch[1]);
                    // Appeler la fonction de désinstallation avec l'ID extrait
                    internalUninstallComponent(componentId);
                }
            }
        });
        
        // Marquer ce bouton comme initialisé
        button.setAttribute("uninstall-listener-initialized", "true");
    });
    
    uninstallButtonsInitialized = true;
}

/**
 * Désinstalle un composant
 * @param {number} componentId - ID du composant à désinstaller
 */
function uninstallComponent(componentId) {
    console.log("=== uninstallComponent ===");
    console.log("uninstallComponent appelé pour componentId:", componentId);
    console.trace("Trace d'appel de uninstallComponent");
    
    // ATTENTION: Cette fonction est maintenant appelée directement par checkAuthAndUninstall
    // après vérification de l'authentification
    
    // En cas d'appel direct sans passer par checkAuthAndUninstall (c'est notre problème actuel),
    // nous devons vérifier l'authentification ici aussi
    
    if (typeof window !== 'undefined' && 
        typeof window.checkAuthAndUninstallCalled === 'undefined' &&
        typeof MarketplaceAuth !== 'undefined') {
        
        console.log("uninstallComponent appelé directement, vérification d'authentification de secours");
        
        // Si l'utilisateur n'est pas authentifié, rediriger vers checkAuthAndUninstall
        if (!MarketplaceAuth.isAvanteamAdmin()) {
            console.log("Utilisateur non authentifié, redirection vers checkAuthAndUninstall");
            checkAuthAndUninstall(componentId);
            return;
        }
    }
    
    // Si l'authentification est vérifiée, procéder à la désinstallation
    console.log("Poursuite de la désinstallation, appel de internalUninstallComponent");
    internalUninstallComponent(componentId);
}

/**
 * Implémentation interne de la désinstallation d'un composant
 * @param {number} componentId - ID du composant à désinstaller
 */
function internalUninstallComponent(componentId) {
    console.log("=== internalUninstallComponent ===");
    console.log("internalUninstallComponent appelé pour componentId:", componentId);
    
    // Vérification finale d'authentification pour éviter d'éventuels appels non autorisés
    if (typeof MarketplaceAuth !== 'undefined' && !MarketplaceAuth.isAvanteamAdmin()) {
        console.error("ERREUR: Tentative de désinstallation par un utilisateur non authentifié");
        // Rediriger vers la méthode principale qui gère l'authentification
        checkAuthAndUninstall(componentId);
        return;
    }
    
    // Trouver le composant dans le cache
    let component = null;
    
    console.log("Recherche du composant dans le cache...");
    
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
        console.error("Composant non trouvé dans le cache pour l'ID:", componentId);
        alert('Composant non trouvé');
        return;
    }
    
    console.log("Composant trouvé:", component.displayName);
    
    // Demander confirmation à l'utilisateur avec une belle modal
    console.log("Affichage de la boîte de dialogue de confirmation");
    showConfirmModal(
        'Confirmation de désinstallation', 
        `Êtes-vous sûr de vouloir désinstaller le composant <strong>"${component.displayName}"</strong> ?<br><br>Cette action ne peut pas être annulée.`,
        () => { // Fonction exécutée si l'utilisateur confirme
            console.log("Utilisateur a confirmé la désinstallation");
            proceedWithUninstall();
        }
    );
    
// Inclure cette fonction pour initialiser les boutons lors du chargement de la page
document.addEventListener("DOMContentLoaded", function() {
    // Initialiser les boutons de désinstallation au chargement de la page
    setTimeout(initUninstallButtons, 1000); // Délai pour s'assurer que tous les boutons sont rendus
});

// Intercepter les ajouts au DOM pour gérer les nouveaux boutons de désinstallation
// Utiliser un MutationObserver pour détecter les changements dans le DOM
const observer = new MutationObserver(function(mutations) {
    for (let mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // Vérifier si de nouveaux boutons de désinstallation ont été ajoutés
            const needsInit = Array.from(mutation.addedNodes).some(node => {
                return node.nodeType === 1 && (
                    node.classList?.contains('btn-uninstall') || 
                    node.querySelector?.('.btn-uninstall')
                );
            });
            
            if (needsInit) {
                // Réinitialiser les boutons de désinstallation
                setTimeout(initUninstallButtons, 100);
            }
        }
    }
});

// Démarrer l'observation du DOM pour les nouveaux boutons
observer.observe(document.body, { childList: true, subtree: true });

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
        
        // Générer un ID de désinstallation unique
        const uninstallId = `uninstall-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        
        // Mettre à jour la progression
        updateProgress(progressBar, progressText, 20);
        addLogMessage(logContainer, `Préparation de la désinstallation...`);
        
        // Appeler l'API locale pour exécuter la désinstallation
        const localUninstallEndpoint = `${localApiUrl}uninstall`;
        
        // Préparer les données pour l'API locale
        const uninstallData = {
            componentId: componentId,
            force: false,
            uninstallId: uninstallId
        };
        
        // Appel à l'API locale de désinstallation
        fetch(localUninstallEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(uninstallData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erreur lors de la désinstallation (${response.status}): ${response.statusText}`);
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
            
            console.log("Résultat complet de la désinstallation:", result);
            
            // Vérifier le résultat de la désinstallation
            const success = result.success === true || result.Success === true;
            
            if (success) {
                addLogMessage(logContainer, `Désinstallation réussie!`);
                if (result.backupPath) {
                    addLogMessage(logContainer, `Sauvegarde créée dans: ${result.backupPath}`);
                }
                
                // Notifier l'API Marketplace de la désinstallation
                updateProgress(progressBar, progressText, 90);
                addLogMessage(logContainer, `Finalisation de la désinstallation...`);
                
                // Appeler l'API pour désinstaller le composant
                fetch(`${apiUrl}/components/${componentId}/uninstall?clientId=${encodeURIComponent(clientId)}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ComponentId: componentId.toString(),
                        Success: true,
                        UninstallId: uninstallId,
                        BackupPath: result.backupPath || ""
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Erreur lors de l'enregistrement de la désinstallation: ${response.status}`);
                    }
                    return response.json();
                })
                .then(() => {
                    // Désinstallation terminée
                    updateProgress(progressBar, progressText, 100);
                    addLogMessage(logContainer, `Désinstallation terminée et enregistrée avec succès!`);
                    
                    // Ajouter un bouton pour fermer la modal
                    const closeButton = document.createElement('button');
                    closeButton.textContent = 'Fermer';
                    closeButton.className = 'btn btn-primary';
                    closeButton.style.marginTop = '20px';
                    closeButton.style.display = 'block';
                    closeButton.style.margin = '20px auto 0';
                    closeButton.addEventListener('click', () => {
                        document.body.removeChild(modal);
                        refreshComponentLists();
                    });
                    
                    modal.querySelector('.modal-content').appendChild(closeButton);
                })
                .catch(error => {
                    console.error('Erreur lors de l\'enregistrement de la désinstallation:', error);
                    
                    // La désinstallation locale a réussi mais l'enregistrement a échoué
                    updateProgress(progressBar, progressText, 100);
                    addLogMessage(logContainer, `Avertissement: La désinstallation a réussi localement, mais l'enregistrement a rencontré un problème: ${error.message}`, true);
                    
                    // Ajouter un bouton pour fermer la modal
                    const closeButton = document.createElement('button');
                    closeButton.textContent = 'Fermer';
                    closeButton.className = 'btn btn-primary';
                    closeButton.style.marginTop = '20px';
                    closeButton.style.display = 'block';
                    closeButton.style.margin = '20px auto 0';
                    closeButton.addEventListener('click', () => {
                        document.body.removeChild(modal);
                        refreshComponentLists();
                    });
                    
                    modal.querySelector('.modal-content').appendChild(closeButton);
                });
            } else {
                // Échec de la désinstallation
                const errorMessage = result.error || "Une erreur est survenue lors de la désinstallation";
                addLogMessage(logContainer, `Échec de la désinstallation: ${errorMessage}`, true);
                
                // Mettre à jour la barre de progression en rouge
                progressBar.style.backgroundColor = '#dc3545';
                
                // Ajouter un bouton pour fermer la modal
                const closeButton = document.createElement('button');
                closeButton.textContent = 'Fermer';
                closeButton.className = 'btn btn-secondary';
                closeButton.style.marginTop = '20px';
                closeButton.style.display = 'block';
                closeButton.style.margin = '20px auto 0';
                closeButton.addEventListener('click', () => {
                    document.body.removeChild(modal);
                });
                
                modal.querySelector('.modal-content').appendChild(closeButton);
            }
        })
        .catch(error => {
            console.error("Erreur de désinstallation:", error);
            
            // Gérer le cas où l'API locale n'est pas disponible ou a échoué
            updateProgress(progressBar, progressText, 100);
            addLogMessage(logContainer, `Erreur: ${error.message}`, true);
            
            // Mettre à jour la barre de progression en rouge
            progressBar.style.backgroundColor = '#dc3545';
            
            // Utiliser la méthode de désinstallation de secours via l'API Marketplace
            addLogMessage(logContainer, `Tentative de désinstallation via l'API Marketplace...`, false);
            
            // Appeler l'API pour désinstaller le composant (méthode de secours)
            fetch(`${apiUrl}/components/${componentId}/uninstall?clientId=${encodeURIComponent(clientId)}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erreur lors de la désinstallation de secours: ${response.status}`);
                }
                return response.json();
            })
            .then(() => {
                // Désinstallation de secours terminée
                addLogMessage(logContainer, `Désinstallation terminée via l'API Marketplace!`, false);
                
                // Ajouter un bouton pour fermer la modal
                const closeButton = document.createElement('button');
                closeButton.textContent = 'Fermer';
                closeButton.className = 'btn btn-primary';
                closeButton.style.marginTop = '20px';
                closeButton.style.display = 'block';
                closeButton.style.margin = '20px auto 0';
                closeButton.addEventListener('click', () => {
                    document.body.removeChild(modal);
                    refreshComponentLists();
                });
                
                modal.querySelector('.modal-content').appendChild(closeButton);
            })
            .catch(fallbackError => {
                console.error('Erreur lors de la désinstallation de secours:', fallbackError);
                
                // Échec de la désinstallation de secours
                addLogMessage(logContainer, `Échec de la désinstallation de secours: ${fallbackError.message}`, true);
                
                // Ajouter un bouton pour fermer la modal
                const closeButton = document.createElement('button');
                closeButton.textContent = 'Fermer';
                closeButton.className = 'btn btn-secondary';
                closeButton.style.marginTop = '20px';
                closeButton.style.display = 'block';
                closeButton.style.margin = '20px auto 0';
                closeButton.addEventListener('click', () => {
                    document.body.removeChild(modal);
                });
                
                modal.querySelector('.modal-content').appendChild(closeButton);
            });
        });
    }
}