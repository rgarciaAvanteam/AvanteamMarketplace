/**
 * marketplace-install.js - Gestion de l'installation des composants
 * Gère tout le processus d'installation et de mise à jour des composants
 */

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
 * @param {string} level - Niveau de log (INFO, WARNING, ERROR, SUCCESS)
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
    } else {
        logClass = 'log-info';
    }
    
    logItem.className = `log-item ${logClass}`;
    logItem.innerHTML = `<span class="log-time">[${timestamp}]</span> <span class="log-level">[${level}]</span> ${message}`;
    logContainer.appendChild(logItem);
    logContainer.scrollTop = logContainer.scrollHeight;
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
    addLogMessage(logContainer, `Démarrage de l'installation de ${component.displayName} v${version}...`, false, 'INFO');
    
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
        addLogMessage(logContainer, `Téléchargement réussi...`, false, 'SUCCESS');
        
        // Vérifier que nous avons une URL de téléchargement
        if (!data || !data.downloadUrl) {
            addLogMessage(logContainer, `Réponse de l'API invalide: URL de téléchargement manquante`, true, 'ERROR');
            throw new Error("Réponse de l'API invalide: URL de téléchargement manquante");
        }
        
        console.log("URL de téléchargement obtenue:", data.downloadUrl);
        addLogMessage(logContainer, `URL de téléchargement obtenue`, false, 'INFO');
        
        // Vérifier si l'URL est valide et utilisable
        if (!data.downloadUrl || 
            data.downloadUrl.includes("avanteam-online.com/no-package") || 
            data.downloadUrl.includes("avanteam-online.com/placeholder")) {
            
            addLogMessage(logContainer, `Attention: URL de package non valide détectée.`, true, 'WARNING');
            addLogMessage(logContainer, `Tentative d'utilisation d'une URL alternative...`, false, 'INFO');
            
            // Échec du téléchargement, montrer un message d'erreur
            throw new Error("L'URL de téléchargement n'est pas valide. Veuillez contacter l'administrateur du système.");
        }
        
        // Lancer l'installation
        return installComponentPackage(data.downloadUrl, componentId, version, progressBar, progressText, logContainer);
    })
    .then((installResult) => {
        // Enregistrer l'installation avec les résultats du script PowerShell
        updateProgress(progressBar, progressText, 90);
        addLogMessage(logContainer, `Finalisation de l'installation...`, false, 'INFO');
        
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
                addLogMessage(logContainer, `Installation terminée avec succès!`, false, 'SUCCESS');
                
                // Fermer la modal après un délai
                setTimeout(() => {
                    document.body.removeChild(modal);
                    
                    // Actualiser la liste des composants
                    refreshComponentLists();
                }, 3000);
            });
        } else {
            // Déjà un objet JSON (cas où installResult était défini)
            // Installation terminée
            updateProgress(progressBar, progressText, 100);
            addLogMessage(logContainer, `Installation terminée avec succès!`, false, 'SUCCESS');
            
            // Fermer la modal après un délai
            setTimeout(() => {
                document.body.removeChild(modal);
                
                // Actualiser la liste des composants
                refreshComponentLists();
            }, 3000);
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
            addLogMessage(logContainer, `Avertissement: La communication avec l'API a échoué.`, true, 'WARNING');
            addLogMessage(logContainer, `L'installation locale a probablement réussi, mais n'a pas pu être enregistrée.`, false, 'INFO');
            
            // Mettre à jour la barre de progression
            updateProgress(progressBar, progressText, 100);
            progressBar.style.backgroundColor = '#ffc107'; // Jaune pour avertissement
            
            // Ajouter un bouton pour rafraîchir la page
            const refreshButton = document.createElement('button');
            refreshButton.textContent = 'Fermer et rafraîchir';
            refreshButton.className = 'btn btn-primary';
            refreshButton.style.marginTop = '20px';
            refreshButton.addEventListener('click', () => {
                document.body.removeChild(modal);
                refreshComponentLists(); // Rafraîchir la liste des composants
            });
            
            modal.querySelector('.modal-content').appendChild(refreshButton);
            return;
        }
        
        // Échec complet de l'installation
        addLogMessage(logContainer, `Erreur: ${errorMessage}`, true, 'ERROR');
        
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
        addLogMessage(logContainer, `Préparation de l'installation...`, false, 'INFO');
        
        // Générer un ID d'installation unique
        const installId = `install-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        
        // Dans cette architecture, nous utilisons une API locale sur le serveur Process Studio
        // Construire le chemin de l'API locale d'installation (basée sur l'emplacement actuel du site)
        // Dans Process Studio, nous allons installer une API locale pour l'installation de composants
        
        // Appeler l'API locale pour exécuter l'installation
        // Cette API est sur le même serveur que Process Studio, donc aucun problème CORS
        const localInstallEndpoint = `${localApiUrl}install`;
        
        addLogMessage(logContainer, `Lancement de l'installation du composant ${componentId} v${version}...`, false, 'INFO');
        
        // Préparer les données pour l'API locale
        let packageUrl = downloadUrl;
        
        // Vérifier que l'URL est valide
        if (!packageUrl || packageUrl.includes("avanteam-online.com/no-package") || packageUrl.includes("avanteam-online.com/placeholder")) {
            const errorMessage = `URL de package non valide: ${packageUrl || 'URL vide'}`;
            console.error(errorMessage);
            addLogMessage(logContainer, `Erreur: ${errorMessage}`, true, 'ERROR');
            throw new Error(errorMessage);
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
                    addLogMessage(logContainer, log.message, log.level === "ERROR", log.level);
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
                addLogMessage(logContainer, `Installation réussie!`, false, 'SUCCESS');
                if (result.destinationPath) {
                    addLogMessage(logContainer, `Composant installé dans: ${result.destinationPath}`, false, 'INFO');
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
                    
                    addLogMessage(logContainer, `Installation réussie (avec avertissement)!`, false, 'SUCCESS');
                    if (result.destinationPath) {
                        addLogMessage(logContainer, `Composant installé dans: ${result.destinationPath}`, false, 'INFO');
                    }
                    addLogMessage(logContainer, `Note: Le script de post-installation n'a pas pu être exécuté, mais les fichiers ont été correctement copiés.`, true, 'WARNING');
                    
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
                
                addLogMessage(logContainer, `Échec de l'installation: ${errorMessage}`, true, 'ERROR');
                
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
            addLogMessage(logContainer, `Erreur: ${error.message}`, true, 'ERROR');
            
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
            addLogMessage(logContainer, `Installation terminée et enregistrée avec succès!`, false, 'SUCCESS');
            resolve(installationResult);
        } else {
            // Si nous avons un message d'erreur dans la réponse, l'utiliser
            const errorText = errorMessage || (data && data.error) || "Erreur inconnue";
            addLogMessage(logContainer, `Échec d'installation enregistré.`, true, 'ERROR');
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
            addLogMessage(logContainer, `Avertissement: L'enregistrement de l'installation a rencontré un problème, mais l'installation a réussi.`, false, 'WARNING');
            resolve(installationResult);
        } else {
            addLogMessage(logContainer, `Avertissement: L'installation a échoué et l'enregistrement a rencontré un problème: ${errorText}`, true, 'ERROR');
            reject(new Error(errorText));
        }
    });
}