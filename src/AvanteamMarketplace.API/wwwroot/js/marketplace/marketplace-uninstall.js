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