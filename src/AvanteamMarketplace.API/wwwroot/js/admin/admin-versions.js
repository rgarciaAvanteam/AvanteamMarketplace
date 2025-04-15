// admin-versions.js
// Gestion des versions de composants

// Déclaration des fonctions de suppression pour éviter les problèmes de référence
function confirmDeleteVersion(componentId, versionId) {
    deleteTarget = versionId;
    deleteType = "version";
    currentComponentId = componentId;
    
    $("#confirmDeleteMessage").html(`Êtes-vous sûr de vouloir supprimer la version <strong>${versionId}</strong> ? <br>Cette action est irréversible et supprimera également le package associé.<br>Note: Vous ne pouvez pas supprimer la version actuelle d'un composant.`);
    $("#confirmDeleteModal").css("display", "block");
}

function deleteVersion(componentId, versionId) {
    console.log(`Suppression de la version ${versionId} du composant ${componentId}`);
    
    // Désactiver le bouton de confirmation pour éviter les clics multiples
    $("#btnConfirmDelete").prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Suppression...');
    
    // Récupérer d'abord les détails de la version pour les préserver
    fetch(`${apiBaseUrl}/management/components/${componentId}/versions/${versionId}`, {
        headers: {
            'Authorization': `Bearer ${adminToken}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur lors de la récupération des détails de la version: ${response.status}`);
        }
        return response.json();
    })
    .then(versionDetails => {
        console.log("Détails de la version récupérés:", versionDetails);
        
        // Créer un nouvel objet avec les mêmes propriétés mais en marquant la version comme désactivée
        const updatedVersion = {
            Version: `Désactivé_${Math.floor(Date.now() / 1000)}`, // Marquer comme désactivé
            ChangeLog: versionDetails.changeLog || versionDetails.ChangeLog || "",
            MinPlatformVersion: versionDetails.minPlatformVersion || versionDetails.MinPlatformVersion || "",
            IsLatest: false // S'assurer que ce n'est pas marqué comme version actuelle
        };
        
        // Mettre à jour la version pour la "désactiver" logiquement
        return fetch(`${apiBaseUrl}/management/components/${componentId}/versions/${versionId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedVersion)
        });
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur lors de la suppression de la version: ${response.status}`);
        }
        
        $("#confirmDeleteModal").css("display", "none");
        $("#btnConfirmDelete").prop('disabled', false).html('Confirmer');
        
        // Afficher une notification de succès
        const successNotif = $(`<div class="alert alert-success">
            <i class="fas fa-check-circle"></i> Version supprimée avec succès
        </div>`);
        $(".admin-header").after(successNotif);
        setTimeout(() => successNotif.fadeOut(500, function() { $(this).remove(); }), 5000);
        
        // Recharger la liste des versions
        loadComponentVersions(componentId);
    })
    .catch(error => {
        console.error("Erreur:", error);
        
        // Réinitialiser le bouton
        $("#btnConfirmDelete").prop('disabled', false).html('Confirmer');
        
        // Fermer la modal de confirmation
        $("#confirmDeleteModal").css("display", "none");
        
        // Tenter d'extraire un message d'erreur plus utile
        let errorMessage = error.message;
        
        // Afficher une notification d'erreur
        const errorNotif = $(`<div class="alert alert-danger">
            <i class="fas fa-exclamation-circle"></i> Erreur lors de la suppression de la version: ${errorMessage}
        </div>`);
        $(".admin-header").after(errorNotif);
        setTimeout(() => errorNotif.fadeOut(2000, function() { $(this).remove(); }), 8000);
    });
}

function showVersionPanel(componentId, componentName) {
    currentComponentId = componentId;
    $("#versionComponentName").text(componentName);
    loadComponentVersions(componentId);
    loadComponentUsage(componentId);
    $("#versionManagementPanel").addClass("active");
}

function hideVersionPanel() {
    $("#versionManagementPanel").removeClass("active");
    currentComponentId = null;
}

function loadComponentVersions(componentId) {
    // Ajouter un indicateur de chargement
    const versionsTable = document.querySelector('#versionsTable tbody');
    versionsTable.innerHTML = '<tr><td colspan="6" class="text-center">Chargement des versions...</td></tr>';
    
    fetch(`${apiBaseUrl}/management/components/${componentId}/versions`, {
        headers: {
            'Authorization': `Bearer ${adminToken}`
        },
        // Ajouter un paramètre pour éviter la mise en cache
        cache: 'no-store'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur lors du chargement des versions: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Debug: Afficher la réponse complète de l'API
        console.log("Réponse API versions (brute):", data);
        
        // Nettoyer le tableau
        versionsTable.innerHTML = '';
        
        // Extraire les versions en gérant tous les formats possibles
        let versions = [];
        
        if (Array.isArray(data)) {
            versions = data;
        } else if (data && data.$values) {
            versions = data.$values;
        } else if (data && data.versions) {
            if (Array.isArray(data.versions)) {
                versions = data.versions;
            } else if (data.versions.$values) {
                versions = data.versions.$values;
            }
        } else {
            console.warn("Format de données inconnu:", data);
        }
        
        // Debug: Afficher les versions extraites
        console.log("Versions extraites:", versions);
        
        if (versions.length === 0) {
            versionsTable.innerHTML = '<tr><td colspan="6" class="text-center">Aucune version trouvée</td></tr>';
            return;
        }
        
        // Filtrer les versions logiquement supprimées (préfixées par "Désactivé_")
        versions = versions.filter(version => {
            const versionString = version.versionNumber || version.version || version.Version || "";
            return !String(versionString).startsWith("Désactivé_");
        });
        
        if (versions.length === 0) {
            versionsTable.innerHTML = '<tr><td colspan="6" class="text-center">Aucune version active trouvée</td></tr>';
            return;
        }
        
        versions.forEach(version => {
            // Normaliser la version pour extraire le numéro de version de l'URL si nécessaire
            if ((!version.version && !version.versionNumber && !version.Version) && 
                version.packageUrl && typeof version.packageUrl === 'string') {
                
                // Tenter d'extraire le numéro de version de l'URL du package
                const urlVersionMatch = version.packageUrl.match(/[^a-zA-Z0-9](\d+\.\d+(\.\d+)?)\.zip$/);
                if (urlVersionMatch && urlVersionMatch[1]) {
                    version.version = urlVersionMatch[1];
                    version.versionNumber = urlVersionMatch[1];
                    version.Version = urlVersionMatch[1];
                }
            }
            
            // Vérifier tous les noms de propriétés possibles pour les valeurs clés
            // Version number - différentes possibilités de nommage
            let versionNumber = "N/A";
            if (version.versionNumber !== undefined && version.versionNumber !== null) {
                versionNumber = version.versionNumber;
            } else if (version.version !== undefined && version.version !== null) {
                versionNumber = version.version;
            } else if (version.Version !== undefined && version.Version !== null) {
                versionNumber = version.Version;
            }
            
            // Date de publication
            let releaseDate = "N/A";
            if (version.releaseDate) {
                releaseDate = new Date(version.releaseDate).toLocaleDateString();
            } else if (version.ReleaseDate) {
                releaseDate = new Date(version.ReleaseDate).toLocaleDateString();
            } else if (version.createdDate) {
                releaseDate = new Date(version.createdDate).toLocaleDateString();
            } else if (version.CreatedDate) {
                releaseDate = new Date(version.CreatedDate).toLocaleDateString();
            }
            
            // Version minimale de la plateforme - Analyse complète de toutes les propriétés possibles
            let minPlatformVersion = "N/A";
            
            // Fonction pour extraire la propriété de façon plus robuste
            const extractProperty = (obj, propNames) => {
                // Créer une liste de toutes les variantes de casse possibles
                const allKeys = Object.keys(obj);
                
                // Debug: Afficher toutes les clés disponibles dans l'objet version
                console.log(`Version ${versionNumber} - Toutes les clés disponibles:`, allKeys);
                
                // Chercher parmi les clés connues d'abord
                for (const prop of propNames) {
                    if (obj[prop] !== undefined && obj[prop] !== null && obj[prop] !== "") {
                        return obj[prop];
                    }
                }
                
                // Recherche insensible à la casse en dernier recours
                const normalizedPropName = "minplatformversion"; // Version minuscule sans espaces
                for (const key of allKeys) {
                    if (key.toLowerCase().replace(/[-_\s]/g, "") === normalizedPropName) {
                        if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
                            return obj[key];
                        }
                    }
                }
                
                return null;
            };
            
            // Liste des noms de propriétés possibles pour MinPlatformVersion
            const possiblePropNames = [
                "minPlatformVersion", 
                "MinPlatformVersion", 
                "minplatformversion",
                "min-platform-version",
                "min_platform_version",
                "MINPLATFORMVERSION"
            ];
            
            // Extraire la valeur
            const extractedValue = extractProperty(version, possiblePropNames);
            if (extractedValue !== null) {
                minPlatformVersion = extractedValue;
                console.log(`Version ${versionNumber} - MinPlatformVersion trouvé:`, minPlatformVersion);
            } else {
                console.warn(`Version ${versionNumber} - MinPlatformVersion non trouvé`);
            }
            
            // Nombre de téléchargements
            const downloadCount = version.downloadCount || version.DownloadCount || 0;
            
            // Version actuelle
            const isLatest = version.isLatest === true || version.IsLatest === true;
            
            // ID de la version
            const versionId = version.versionId || version.id || version.Id || version.VersionId;
            
            // Création de la ligne
            // Debug: Afficher les valeurs pour chaque ligne avant de créer le HTML
            console.log(`Création de ligne pour version ${versionNumber}:`, {
                versionNumber,
                releaseDate,
                minPlatformVersion,
                downloadCount,
                isLatest,
                versionId
            });
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${versionNumber}</td>
                <td>${releaseDate}</td>
                <td>${minPlatformVersion}</td>
                <td>${downloadCount}</td>
                <td>${isLatest ? '<span class="is-latest-badge">Actuelle</span>' : ''}</td>
                <td class="action-buttons">
                    <a href="#" class="action-btn action-btn-edit-version" data-id="${versionId}">Modifier</a>
                    <a href="#" class="action-btn action-btn-set-latest" data-id="${versionId}" ${isLatest ? 'style="display:none"' : ''}>Définir comme actuelle</a>
                    <a href="#" class="action-btn action-btn-delete-version" data-id="${versionId}" ${isLatest ? 'style="display:none"' : ''}>Supprimer</a>
                </td>
            `;
            versionsTable.appendChild(row);
        });
        
        // Ajouter les gestionnaires d'événements
        document.querySelectorAll('.action-btn-edit-version').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const versionId = this.getAttribute('data-id');
                editVersion(versionId);
            });
        });
        
        document.querySelectorAll('.action-btn-set-latest').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const versionId = this.getAttribute('data-id');
                setLatestVersion(componentId, versionId);
            });
        });
        
        document.querySelectorAll('.action-btn-delete-version').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const versionId = this.getAttribute('data-id');
                confirmDeleteVersion(componentId, versionId);
            });
        });
    })
    .catch(error => {
        console.error('Erreur lors du chargement des versions:', error);
        versionsTable.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Erreur: ${error.message}</td></tr>`;
    });
}

function loadComponentUsage(componentId) {
    // Placeholder for version usage data
    const usageList = document.querySelector('#clientsUsageList');
    usageList.innerHTML = '<div class="loading">Chargement des données d\'utilisation...</div>';
    
    // In a real implementation, you would fetch this data from the API
    // For now, we'll just display a message
    setTimeout(() => {
        usageList.innerHTML = '<p>Fonctionnalité en cours de développement. Cette section affichera quels clients utilisent chaque version du composant.</p>';
    }, 1000);
}

/**
 * Ouvre la modale d'édition de version avec les données de la version sélectionnée
 * @param {string|number} versionId - L'identifiant de la version à éditer
 */
function editVersion(versionId) {
    if (!versionId) {
        console.error("ID de version manquant pour l'édition");
        return;
    }
    
    console.log(`Édition de la version ID: ${versionId}`);
    
    // Utiliser showVersionModal avec l'ID de la version pour charger et éditer une version existante
    showVersionModal(versionId);
}

function showVersionModal(versionId = null) {
    console.log("Ouverture du modal version", versionId);
    
    // Réinitialiser tout état antérieur
    // Très important pour éviter les problèmes de chargement de fichier
    if (window.fileResetTimeout) {
        clearTimeout(window.fileResetTimeout);
    }
    
    // Nettoyer les affichages existants
    $("#selectedVersionFileName").text("");
    
    // Remplacer complètement l'élément input file pour éviter tout problème de sélection
    const fileInputContainer = $("#fileVersionPackage").parent();
    const oldFileInput = $("#fileVersionPackage");
    
    // Sauvegarder tous les attributs
    const attributes = {
        id: oldFileInput.attr('id'),
        accept: oldFileInput.attr('accept'),
        hidden: oldFileInput.prop('hidden')
    };
    
    // Remplacer l'élément
    oldFileInput.remove();
    const newFileInput = $('<input type="file">');
    Object.keys(attributes).forEach(key => {
        if (key === 'hidden') {
            newFileInput.prop(key, attributes[key]);
        } else {
            newFileInput.attr(key, attributes[key]);
        }
    });
    
    // Réinsérer le nouvel élément
    fileInputContainer.append(newFileInput);
    console.log("Input file remplacé pour éviter les problèmes de sélection");
    
    // Attendre un court instant pour que le DOM soit mis à jour avant de réinitialiser les gestionnaires
    setTimeout(() => {
        // Réattacher les gestionnaires d'événements
        initFileHandlers();
        console.log("Gestionnaires de fichiers réinitialisés pour le modal version");
    }, 200);
    
    // Mettre à jour la position de la modale pour être devant le panneau
    // Cela s'assure que la modale est affichée correctement même avec le panneau ouvert
    $("#versionModal").css("z-index", "2000");
    
    // Réinitialiser l'état du bouton de sauvegarde
    $("#btnSaveVersion").data('saving', false).prop('disabled', false);
    
    currentVersionId = versionId;
    
    if (versionId) {
        // Modification d'une version existante
        $('#versionModalTitle').text('Modifier la version');
        
        fetch(`${apiBaseUrl}/management/components/${currentComponentId}/versions/${versionId}`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        })
        .then(response => response.json())
        .then(data => {
            // Afficher les données reçues pour le débogage
            console.log("Données de version reçues pour édition:", data);
            
            $('#txtVersionNumber').val(data.versionNumber || data.Version || data.version || '');
            $('#txtVersionChangelog').val(data.changeLog || data.ChangeLog || data.changelog || '');
            
            // Gérer les différentes casses possibles pour minPlatformVersion
            const minPlatformVersion = data.minPlatformVersion || data.MinPlatformVersion || data.minplatformversion || '';
            $('#txtVersionMinPlatform').val(minPlatformVersion);
            
            $('#chkIsLatestVersion').prop('checked', data.isLatest || data.IsLatest || false);
            
            // Effacer toute sélection de fichier précédente
            $('#selectedVersionFileName').text('');
            
            // Afficher la modal au premier plan
            $('#versionModal').css("z-index", "2000").show();
        })
        .catch(error => {
            console.error('Erreur lors du chargement des détails de la version:', error);
            alert('Erreur lors du chargement des détails de la version.');
        });
    } else {
        // Ajout d'une nouvelle version
        $('#versionModalTitle').text('Ajouter une version');
        $('#txtVersionNumber').val('');
        $('#txtVersionChangelog').val('');
        $('#txtVersionMinPlatform').val('');
        $('#chkIsLatestVersion').prop('checked', true);
        $('#selectedVersionFileName').text('');
        
        // Afficher la modal au premier plan
        $('#versionModal').css("z-index", "2000").show();
    }
}

function hideVersionModal() {
    $('#versionModal').hide();
    currentVersionId = null;
}

function saveVersion() {
    // Bouton de sauvegarde
    const saveBtn = $("#btnSaveVersion");
    
    // Vérifier si le bouton est déjà en cours de sauvegarde
    if (saveBtn.data('saving')) {
        console.log("Sauvegarde déjà en cours, ignore l'événement");
        return;
    }
    
    console.log("Début de la fonction saveVersion");
    
    // Marquer le bouton comme en cours de sauvegarde
    saveBtn.data('saving', true);
    
    // Créer un objet avec les données du formulaire
    const versionData = {
        Version: $('#txtVersionNumber').val(),
        ChangeLog: $('#txtVersionChangelog').val(),
        MinPlatformVersion: $('#txtVersionMinPlatform').val(),
        IsLatest: $('#chkIsLatestVersion').is(':checked')
    };
    
    // Vérifier les données de base
    if (!versionData.Version || !versionData.Version.match(/^\d+\.\d+(\.\d+)?$/)) {
        alert('Veuillez saisir un numéro de version valide (format X.Y.Z)');
        saveBtn.data('saving', false);
        return;
    }
    
    // Afficher l'état de sauvegarde
    const originalText = saveBtn.text();
    saveBtn.html('<i class="fas fa-spinner fa-spin"></i> Enregistrement...');
    saveBtn.prop('disabled', true);
    
    const fileInput = document.getElementById('fileVersionPackage');
    const hasFile = fileInput.files && fileInput.files.length > 0;
    
    if (currentVersionId) {
        // Mise à jour d'une version existante
        fetch(`${apiBaseUrl}/management/components/${currentComponentId}/versions/${currentVersionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(versionData)
        })
        .then(response => {
            if (response.ok) {
                hideVersionModal();
                loadComponentVersions(currentComponentId);
                
                // Afficher une notification de succès
                const successNotif = $(`<div class="alert alert-success">
                    <i class="fas fa-check-circle"></i> Version mise à jour avec succès
                </div>`);
                $(".admin-header").after(successNotif);
                setTimeout(() => successNotif.fadeOut(500, function() { $(this).remove(); }), 5000);
            } else {
                return response.text().then(text => {
                    throw new Error('Erreur lors de la mise à jour de la version');
                });
            }
        })
        .catch(error => {
            alert('Erreur lors de la mise à jour de la version: ' + error.message);
        })
        .finally(() => {
            // Remettre le bouton à son état initial
            saveBtn.html(originalText);
            saveBtn.prop('disabled', false);
            saveBtn.data('saving', false);
        });
    } else {
        // Création d'une nouvelle version
        if (!hasFile) {
            alert('Veuillez sélectionner un fichier de package');
            saveBtn.html(originalText);
            saveBtn.prop('disabled', false);
            saveBtn.data('saving', false);
            return;
        }
        
        // Préparer les données du formulaire pour l'envoi
        const formData = new FormData();
        formData.append('packageFile', fileInput.files[0]);
        formData.append('version', versionData.Version);
        formData.append('changeLog', versionData.ChangeLog);
        formData.append('minPlatformVersion', versionData.MinPlatformVersion);
        formData.append('isLatest', versionData.IsLatest);
        
        // Téléversement avec timeout
        const xhr = new XMLHttpRequest();
        let uploadTimedOut = false;
        
        // Définir un timeout
        const timeoutDuration = 60000; // 60 secondes
        const timeoutId = setTimeout(() => {
            uploadTimedOut = true;
            xhr.abort();
            
            // Remettre le bouton à son état initial
            saveBtn.html(originalText);
            saveBtn.prop('disabled', false);
            saveBtn.data('saving', false);
            
            alert('Le téléversement a été interrompu car il prend trop de temps. Veuillez réessayer.');
        }, timeoutDuration);
        
        // Configurer la requête
        xhr.open('POST', `${apiBaseUrl}/management/components/${currentComponentId}/versions/with-package`, true);
        xhr.setRequestHeader('Authorization', `Bearer ${adminToken}`);
        
        // Gérer la fin de la requête
        xhr.onload = function() {
            clearTimeout(timeoutId);
            
            if (xhr.status >= 200 && xhr.status < 300) {
                // Succès
                hideVersionModal();
                loadComponentVersions(currentComponentId);
                
                // Afficher une notification de succès
                const successNotif = $(`<div class="alert alert-success">
                    <i class="fas fa-check-circle"></i> Version créée avec succès
                </div>`);
                $(".admin-header").after(successNotif);
                setTimeout(() => successNotif.fadeOut(500, function() { $(this).remove(); }), 5000);
            } else {
                // Erreur
                alert('Erreur lors de la création de la version: ' + xhr.statusText);
            }
            
            // Remettre le bouton à son état initial
            saveBtn.html(originalText);
            saveBtn.prop('disabled', false);
            saveBtn.data('saving', false);
        };
        
        // Gérer les erreurs de réseau
        xhr.onerror = function() {
            clearTimeout(timeoutId);
            if (!uploadTimedOut) {
                alert('Erreur de connexion lors du téléversement');
            }
            
            // Remettre le bouton à son état initial
            saveBtn.html(originalText);
            saveBtn.prop('disabled', false);
            saveBtn.data('saving', false);
        };
        
        // Envoyer la requête
        xhr.send(formData);
    }
}

function setLatestVersion(componentId, versionId) {
    fetch(`${apiBaseUrl}/management/components/${componentId}/versions/${versionId}/setLatest`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${adminToken}`
        }
    })
    .then(response => {
        if (response.ok) {
            loadComponentVersions(componentId);
            alert('Version définie comme actuelle avec succès');
        } else {
            throw new Error('Erreur lors de la définition de la version comme actuelle');
        }
    })
    .catch(error => {
        console.error('Erreur:', error);
        alert('Erreur lors de la définition de la version comme actuelle: ' + error.message);
    });
}

// Événements pour le panneau de gestion des versions
$(document).ready(function() {
    $("#closeVersionPanel").click(function(e) {
        e.preventDefault();
        hideVersionPanel();
    });
    
    $("#btnAddVersion").click(function() {
        showVersionModal();
    });
    
    $("#btnSaveVersion").click(function(e) {
        // Empêcher tout comportement de soumission qui pourrait causer un refresh
        e.preventDefault();
        e.stopPropagation();
        
        console.log("Bouton Enregistrer cliqué");
        
        // Appeler directement la fonction de sauvegarde
        saveVersion();
        
        return false; // Empêcher tout comportement par défaut
    });
    
    $("#btnCancelVersion").click(function() {
        hideVersionModal();
    });
});