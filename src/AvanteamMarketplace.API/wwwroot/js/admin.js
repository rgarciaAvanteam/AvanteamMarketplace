// JavaScript pour l'interface d'administration du Marketplace
// Fonctions pour la gestion des versions

// Variables globales - déclarées en dehors des fonctions pour être accessibles partout
var currentComponentId = null;
var currentApiKeyId = null;
var currentVersionId = null;
var deleteTarget = null;
var deleteType = null;

// Déclaration des fonctions de suppression en début de fichier pour éviter les problèmes de référence
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
    // Réinitialiser tout état antérieur
    // Très important pour éviter les problèmes de chargement de fichier
    if (window.fileResetTimeout) {
        clearTimeout(window.fileResetTimeout);
    }
    
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
    
    // Attendre un court instant pour que le DOM soit mis à jour
    setTimeout(() => {
        // Réattacher les gestionnaires d'événements
        initFileHandlers();
    }, 100);
    
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
// Fonction pour initialiser les gestionnaires d'événements liés aux fichiers
function initFileHandlers() {
    // Remettre à zéro tous les gestionnaires d'événements existants
    $(".file-select-button").off('click');
    
    // Assigner des nouveaux gestionnaires uniques pour chaque type d'input file
    initFileHandlerFor('fileVersionPackage', 'selectedVersionFileName');
    initFileHandlerFor('filePackage', 'selectedFileName');
    initFileHandlerFor('fileIcon', 'selectedIconName');
}

function initFileHandlerFor(inputId, labelId) {
    const fileInput = document.getElementById(inputId);
    if (!fileInput) {
        console.error(`Élément d'entrée de fichier avec ID ${inputId} non trouvé`);
        return;
    }
    
    // Définir une fonction locale de gestionnaire pour ce fichier spécifique
    const handleFileChange = function(e) {
        if (e.target.files && e.target.files.length > 0) {
            const fileName = e.target.files[0].name;
            // Mettre à jour le texte avec le nom du fichier sélectionné
            const label = document.getElementById(labelId);
            if (label) {
                label.innerHTML = '<i class="fas fa-check-circle" style="color: green; margin-right: 5px;"></i>' + fileName;
            }
        }
    };
    
    // Supprimer les anciens gestionnaires puis ajouter le nouveau
    fileInput.removeEventListener('change', handleFileChange);
    fileInput.addEventListener('change', handleFileChange);
    
    // Sélectionner tous les boutons qui pourraient déclencher ce champ de fichier
    // À la fois les boutons dans le même conteneur et ceux avec une classe spécifique
    const allButtons = $(`#${inputId}`).closest('.custom-file-upload').find('.file-select-button');
    
    if (allButtons.length) {
        allButtons.each(function() {
            $(this).off('click').on('click', function(e) {
                e.preventDefault();
                // Déboguer l'événement de clic
                console.log(`Clic sur bouton pour ${inputId}`);
                // Approche directe plus fiable avec un délai pour s'assurer que tout est prêt
                setTimeout(() => {
                    const inputElement = document.getElementById(inputId);
                    if (inputElement) {
                        inputElement.click();
                    } else {
                        console.error(`Élément ${inputId} non trouvé lors du clic`);
                    }
                }, 10);
            });
        });
    } else {
        console.warn(`Aucun bouton trouvé pour ${inputId}`);
    }
}

$(document).ready(function() {
    // Les variables globales sont maintenant déclarées en haut du fichier
    
    // Initialiser les gestionnaires de fichiers
    initFileHandlers();
    
    // Fonction utilitaire pour s'assurer qu'une URL est valide
    function ensureValidUrl(url) {
        // Si l'URL est vide ou non définie, utiliser une URL par défaut
        if (!url || url.trim() === "") {
            return "https://avanteam-online.com/placeholder";
        }
        
        // Si l'URL n'a pas de protocole, ajouter https://
        if (!/^https?:\/\//i.test(url)) {
            return "https://" + url;
        }
        
        return url;
    }

    // Initialisation
    initTabs();
    loadComponents();
    loadApiKeys();
    
    // Event handlers for version management
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
    
    // Les gestionnaires d'événements pour les sélecteurs de fichiers sont maintenant 
    // gérés par la fonction initFileHandlers() et réinitialisés à chaque affichage de modal

    // ========== Navigation entre onglets ==========
    function initTabs() {
        $(".tab-btn").click(function() {
            // Changer l'onglet actif
            $(".tab-btn").removeClass("active");
            $(this).addClass("active");
            
            // Afficher le contenu correspondant
            const tabId = $(this).data("tab");
            $(".tab-content").removeClass("active");
            $(`#${tabId}-tab`).addClass("active");
            
            // Charger les données si nécessaire
            if (tabId === "components" && $("#componentsTable tbody").is(":empty")) {
                loadComponents();
            } else if (tabId === "apikeys" && $("#apiKeysTable tbody").is(":empty")) {
                loadApiKeys();
            }
        });
    }

    // ========== Gestion des composants ==========
    
    // Charger la liste des composants
    function loadComponents() {
        $("#componentsTable tbody").html('<tr><td colspan="6" class="loading">Chargement des composants...</td></tr>');
        
        $.ajax({
            url: `${apiBaseUrl}/management/components`,
            type: "GET",
            headers: {
                "Authorization": `Bearer ${adminToken}`
            },
            success: function(response) {
                displayComponents(response.components);
            },
            error: function(xhr, status, error) {
                console.error("Erreur lors du chargement des composants:", error);
                $("#componentsTable tbody").html(`<tr><td colspan="6" class="error">Erreur lors du chargement des composants: ${xhr.status} ${xhr.statusText}</td></tr>`);
            }
        });
    }
    
    // Afficher les composants dans le tableau
    function displayComponents(components) {
        console.log("Components received:", components);
        
        // Vérifier et normaliser les données si nécessaire
        if (!components) {
            $("#componentsTable tbody").html('<tr><td colspan="6">Aucun composant trouvé</td></tr>');
            return;
        }
        
        // Vérifier si components est un tableau ou un objet avec une propriété contenant un tableau
        let componentsArray = components;
        if (!Array.isArray(components)) {
            console.log("Components is not an array, trying to extract array");
            
            // Format direct $values (observé dans les logs)
            if (components.$values && Array.isArray(components.$values)) {
                componentsArray = components.$values;
                console.log("Using components.$values array:", componentsArray);
            }
            // Format imbriqué
            else if (components.components && Array.isArray(components.components)) {
                componentsArray = components.components;
                console.log("Using components.components array:", componentsArray);
            } 
            // Format imbriqué avec $values
            else if (components.components && components.components.$values && Array.isArray(components.components.$values)) {
                componentsArray = components.components.$values;
                console.log("Using components.components.$values array:", componentsArray);
            } 
            // Autres formats courants
            else if (components.items && Array.isArray(components.items)) {
                componentsArray = components.items;
                console.log("Using components.items array:", componentsArray);
            } 
            else if (components.data && Array.isArray(components.data)) {
                componentsArray = components.data;
                console.log("Using components.data array:", componentsArray);
            } 
            else {
                console.error("Format de composants non pris en charge:", components);
                $("#componentsTable tbody").html('<tr><td colspan="6">Format de données non reconnu</td></tr>');
                return;
            }
        }
        
        if (componentsArray.length === 0) {
            $("#componentsTable tbody").html('<tr><td colspan="6">Aucun composant trouvé</td></tr>');
            return;
        }
        
        let html = '';
        componentsArray.forEach(function(component) {
            // Gérer différents noms de propriétés pour la date de mise à jour
            let updatedDate = "N/A";
            if (component.updatedDate) {
                updatedDate = new Date(component.updatedDate).toLocaleDateString();
            } else if (component.updatedAt) {
                updatedDate = new Date(component.updatedAt).toLocaleDateString();
            } else if (component.lastUpdate) {
                updatedDate = new Date(component.lastUpdate).toLocaleDateString();
            } else if (component.lastUpdated) {
                updatedDate = new Date(component.lastUpdated).toLocaleDateString();
            } else if (component.updateDate) {
                updatedDate = new Date(component.updateDate).toLocaleDateString();
            }
            
            html += `<tr>
                <td>${component.componentId}</td>
                <td>${component.displayName} <small>(${component.name})</small></td>
                <td>${component.category}</td>
                <td>${component.version}</td>
                <td>${updatedDate}</td>
                <td class="action-buttons">
                    <a href="#" class="action-btn action-btn-edit" data-id="${component.componentId}">Modifier</a>
                    <a href="#" class="action-btn action-btn-package" data-id="${component.componentId}">Package</a>
                    <a href="#" class="action-btn action-btn-icon" data-id="${component.componentId}">Icône</a>
                    <a href="#" class="action-btn action-btn-delete" data-id="${component.componentId}">Supprimer</a>
                    <a href="#" class="action-btn action-btn-versions" data-id="${component.componentId}" data-name="${component.displayName}">Versions</a>
                </td>
            </tr>`;
        });
        
        $("#componentsTable tbody").html(html);
        
        // Attacher les gestionnaires d'événements
        $("#componentsTable .action-btn-edit").click(function(e) {
            e.preventDefault();
            const componentId = $(this).data("id");
            editComponent(componentId);
        });
        
        $("#componentsTable .action-btn-package").click(function(e) {
            e.preventDefault();
            const componentId = $(this).data("id");
            showPackageModal(componentId);
        });
        
        $("#componentsTable .action-btn-icon").click(function(e) {
            e.preventDefault();
            const componentId = $(this).data("id");
            showIconModal(componentId);
        });
        
        $("#componentsTable .action-btn-delete").click(function(e) {
            e.preventDefault();
            const componentId = $(this).data("id");
            confirmDeleteComponent(componentId);
        });
        
        $("#componentsTable .action-btn-versions").click(function(e) {
            e.preventDefault();
            const componentId = $(this).data("id");
            const componentName = $(this).data("name");
            showVersionPanel(componentId, componentName);
        });
    }
    
    // Recherche de composants
    $("#searchComponents").on("keyup", function() {
        const searchTerm = $(this).val().toLowerCase();
        
        $("#componentsTable tbody tr").each(function() {
            const name = $(this).find("td:nth-child(2)").text().toLowerCase();
            const category = $(this).find("td:nth-child(3)").text().toLowerCase();
            
            if (name.includes(searchTerm) || category.includes(searchTerm)) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    });
    
    // Ouvrir le modal d'ajout de composant
    $("#btnAddComponent").click(function(e) {
        e.preventDefault();
        showComponentModal();
    });
    
    // Afficher le modal de composant (ajout ou modification)
    function showComponentModal(componentId = null) {
        currentComponentId = componentId;
        
        // Réinitialiser le formulaire
        $("#componentModalTitle").text(componentId ? "Modifier le composant" : "Ajouter un composant");
        $("#txtName").val("");
        $("#txtDisplayName").val("");
        $("#txtDescription").val("");
        $("#txtVersion").val("");
        $("#txtCategory").val("");
        $("#txtAuthor").val("Avanteam");
        $("#txtMinPlatformVersion").val("");
        $("#txtRepositoryUrl").val("");
        $("#txtTags").val("");
        $("#chkRequiresRestart").prop("checked", false);
        
        // Si c'est une modification, charger les données du composant
        if (componentId) {
            $.ajax({
                url: `${apiBaseUrl}/management/components/${componentId}`,
                type: "GET",
                headers: {
                    "Authorization": `Bearer ${adminToken}`
                },
                success: function(component) {
                    console.log("Détails du composant reçus pour modification:", component);
                    
                    // Stocker le composant complet en mémoire pour l'édition
                    // Cela nous permettra de préserver les champs non visibles dans le formulaire
                    window.currentComponentDetails = component;
                    
                    // Remplir les champs visibles du formulaire
                    $("#txtName").val(component.name);
                    $("#txtDisplayName").val(component.displayName);
                    $("#txtDescription").val(component.description);
                    $("#txtVersion").val(component.version);
                    $("#txtCategory").val(component.category);
                    $("#txtAuthor").val(component.author);
                    $("#txtMinPlatformVersion").val(component.minPlatformVersion);
                    $("#txtRepositoryUrl").val(component.repositoryUrl);
                    
                    // Gestion sécurisée des tags (peut être un tableau ou un objet avec $values)
                    if (component.tags) {
                        if (Array.isArray(component.tags)) {
                            $("#txtTags").val(component.tags.join(", "));
                        } else if (component.tags.$values && Array.isArray(component.tags.$values)) {
                            // Format .NET serialisé avec $values
                            $("#txtTags").val(component.tags.$values.join(", "));
                        } else {
                            // Format inconnu, utiliser une chaîne vide
                            console.warn("Format de tags non reconnu:", component.tags);
                            $("#txtTags").val("");
                        }
                    } else {
                        $("#txtTags").val("");
                    }
                    
                    $("#chkRequiresRestart").prop("checked", component.requiresRestart);
                },
                error: function(xhr, status, error) {
                    console.error("Erreur lors du chargement du composant:", error);
                    alert(`Erreur lors du chargement du composant: ${xhr.status} ${xhr.statusText}`);
                }
            });
        }
        
        // Afficher le modal
        $("#componentModal").css("display", "block");
    }
    
    // Modifier un composant (afficher le modal prérempli)
    function editComponent(componentId) {
        showComponentModal(componentId);
    }
    
    // Fermer le modal de composant
    $(".close, #btnCancelComponent").click(function() {
        $("#componentModal").css("display", "none");
        // Nettoyer les détails du composant stockés en mémoire
        window.currentComponentDetails = null;
    });
    
    // Enregistrer un composant (ajout ou modification)
    $("#btnSaveComponent").click(function(e) {
        // Empêcher tout comportement de soumission qui pourrait causer un refresh
        e.preventDefault();
        e.stopPropagation();
        
        console.log("Bouton Enregistrer composant cliqué");
        
        // Pour la création, on a besoin de tous les champs
        // Recueillir les valeurs saisies dans le formulaire
        const repoUrl = $("#txtRepositoryUrl").val();
        
        const newComponent = {
            name: $("#txtName").val(),
            displayName: $("#txtDisplayName").val(),
            description: $("#txtDescription").val(),
            version: $("#txtVersion").val(),
            category: $("#txtCategory").val(),
            author: $("#txtAuthor").val(),
            minPlatformVersion: $("#txtMinPlatformVersion").val(),
            // S'assurer que l'URL du dépôt est valide
            repositoryUrl: repoUrl && repoUrl.trim() !== "" ? repoUrl : "https://avanteam-online.com/no-repository", 
            requiresRestart: $("#chkRequiresRestart").is(":checked"),
            tags: $("#txtTags").val().split(",").map(tag => tag.trim()).filter(tag => tag !== "")
        };
        
        // Ajouter les logs pour déboguer
        console.log("Valeur saisie pour repositoryUrl:", repoUrl);
        console.log("Valeur utilisée pour repositoryUrl:", newComponent.repositoryUrl);
        
        // Validation basique
        if (!newComponent.name || !newComponent.displayName || !newComponent.version || !newComponent.category) {
            alert("Veuillez remplir tous les champs obligatoires.");
            return;
        }
        
        // Validation avancée selon les contraintes définies dans ComponentCreateViewModel
        if (!/^[a-z0-9-]+$/.test(newComponent.name)) {
            alert("Le nom technique doit contenir uniquement des lettres minuscules, des chiffres et des tirets.");
            return;
        }
        
        if (!/^\d+\.\d+(\.\d+)?$/.test(newComponent.version)) {
            alert("La version doit être au format X.Y.Z (ex: 1.0.0).");
            return;
        }
        
        if (newComponent.minPlatformVersion && !/^\d+\.\d+(\.\d+)?$/.test(newComponent.minPlatformVersion)) {
            alert("La version minimale de la plateforme doit être au format X.Y.Z (ex: 23.0.0).");
            return;
        }
        
        if (newComponent.repositoryUrl && !/^https?:\/\/.+/.test(newComponent.repositoryUrl)) {
            alert("L'URL du dépôt doit être une URL valide commençant par http:// ou https://.");
            return;
        }
        
        // Ajout ou modification
        if (currentComponentId) {
            // Pour la modification, on utilise ComponentUpdateViewModel qui n'inclut pas le champ "name"
            // Voir ComponentUpdateViewModel.cs qui n'a pas la propriété Name
            let updateComponent = {
                displayName: newComponent.displayName,
                description: newComponent.description,
                version: newComponent.version,
                category: newComponent.category,
                author: newComponent.author,
                minPlatformVersion: newComponent.minPlatformVersion,
                repositoryUrl: newComponent.repositoryUrl,
                requiresRestart: newComponent.requiresRestart,
                tags: newComponent.tags,
                // Utiliser une URL par défaut valide pour le packageUrl, elle sera remplacée lors du téléversement du package
                packageUrl: "https://avanteam-online.com/no-package",
                targetPath: "",
                readmeContent: "",
                recommendedPlatformVersion: newComponent.minPlatformVersion || "",
                dependencies: []
            };
            
            // Si nous avons les détails complets du composant en mémoire, utilisons-les pour les champs non visibles
            if (window.currentComponentDetails) {
                const comp = window.currentComponentDetails;
                
                // Préserver les valeurs existantes des champs non visibles dans le formulaire
                // IMPORTANT: Préserver le PackageUrl existant au lieu de le remplacer par un placeholder
                updateComponent.packageUrl = comp.packageUrl || "";
                updateComponent.targetPath = comp.targetPath || "";
                updateComponent.readmeContent = comp.readmeContent || "";
                updateComponent.recommendedPlatformVersion = comp.recommendedPlatformVersion || updateComponent.recommendedPlatformVersion;
                
                // Journaliser les valeurs pour le débogage
                console.log("PackageUrl récupéré:", comp.packageUrl);
                console.log("PackageUrl utilisé:", updateComponent.packageUrl);
                
                // Pour les dépendances, conserver celles qui existent déjà
                if (comp.dependencies) {
                    if (Array.isArray(comp.dependencies)) {
                        updateComponent.dependencies = comp.dependencies;
                    } else if (comp.dependencies.$values && Array.isArray(comp.dependencies.$values)) {
                        updateComponent.dependencies = comp.dependencies.$values;
                    }
                }
            }
            
            console.log("Données envoyées pour la mise à jour:", updateComponent);
            
            // Modification
            $.ajax({
                url: `${apiBaseUrl}/management/components/${currentComponentId}`,
                type: "PUT",
                contentType: "application/json",
                data: JSON.stringify(updateComponent),
                headers: {
                    "Authorization": `Bearer ${adminToken}`
                },
                success: function() {
                    $("#componentModal").css("display", "none");
                    // Nettoyer les détails du composant stockés en mémoire
                    window.currentComponentDetails = null;
                    loadComponents();
                },
                error: function(xhr, status, error) {
                    console.error("Erreur lors de la modification du composant:", error);
                    console.error("Détails de l'erreur:", xhr.responseText);
                    
                    // Tenter de parser le message d'erreur JSON si disponible
                    let errorMessage = `${xhr.status} ${xhr.statusText}`;
                    try {
                        if (xhr.responseText) {
                            const errorResponse = JSON.parse(xhr.responseText);
                            if (errorResponse.error) {
                                errorMessage = errorResponse.error;
                            } else if (errorResponse.errors) {
                                // Si le message contient des erreurs de validation
                                const errors = [];
                                for (const key in errorResponse.errors) {
                                    if (errorResponse.errors[key]) {
                                        errors.push(`${key}: ${errorResponse.errors[key].join(", ")}`);
                                    }
                                }
                                errorMessage = `Erreurs de validation:\n${errors.join("\n")}`;
                            }
                        }
                    } catch (e) {
                        console.warn("Impossible de parser le message d'erreur JSON:", e);
                    }
                    
                    alert(`Erreur lors de la modification du composant:\n${errorMessage}`);
                }
            });
        } else {
            // Ajout
            // Assurons-nous que tous les champs requis sont présents et bien formatés
            const createComponent = {
                name: newComponent.name,
                displayName: newComponent.displayName,
                description: newComponent.description,
                version: newComponent.version,
                category: newComponent.category,
                author: newComponent.author || "Avanteam",
                minPlatformVersion: newComponent.minPlatformVersion,
                repositoryUrl: newComponent.repositoryUrl,
                requiresRestart: newComponent.requiresRestart,
                tags: newComponent.tags,
                // Utiliser une URL par défaut valide pour le packageUrl, elle sera remplacée lors du téléversement du package
                packageUrl: "https://avanteam-online.com/no-package",
                targetPath: "",
                readmeContent: "",
                recommendedPlatformVersion: newComponent.minPlatformVersion || "",
                dependencies: []
            };
            
            // Ajouter plus de logs pour le débogage
            console.log("Objet complet pour la création:", JSON.stringify(createComponent));
            
            console.log("Données envoyées pour la création:", createComponent);
            
            $.ajax({
                url: `${apiBaseUrl}/management/components`,
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify(createComponent),
                headers: {
                    "Authorization": `Bearer ${adminToken}`
                },
                success: function() {
                    $("#componentModal").css("display", "none");
                    // Nettoyer les détails du composant stockés en mémoire
                    window.currentComponentDetails = null;
                    loadComponents();
                },
                error: function(xhr, status, error) {
                    console.error("Erreur lors de l'ajout du composant:", error);
                    console.error("Détails de l'erreur:", xhr.responseText);
                    
                    // Tenter de parser le message d'erreur JSON si disponible
                    let errorMessage = `${xhr.status} ${xhr.statusText}`;
                    try {
                        if (xhr.responseText) {
                            const errorResponse = JSON.parse(xhr.responseText);
                            if (errorResponse.error) {
                                errorMessage = errorResponse.error;
                            } else if (errorResponse.errors) {
                                // Si le message contient des erreurs de validation
                                const errors = [];
                                for (const key in errorResponse.errors) {
                                    if (errorResponse.errors[key]) {
                                        errors.push(`${key}: ${errorResponse.errors[key].join(", ")}`);
                                    }
                                }
                                errorMessage = `Erreurs de validation:\n${errors.join("\n")}`;
                            }
                        }
                    } catch (e) {
                        console.warn("Impossible de parser le message d'erreur JSON:", e);
                    }
                    
                    alert(`Erreur lors de l'ajout du composant:\n${errorMessage}`);
                }
            });
        }
    });
    
    // Afficher le modal d'upload de package
    function showPackageModal(componentId) {
        currentComponentId = componentId;
        
        // Réinitialiser le formulaire
        $("#filePackage").val("");
        $("#txtPackageVersion").val("");
        
        // Afficher le modal
        $("#packageModal").css("display", "block");
    }
    
    // Fermer le modal de package
    $(".close, #btnCancelPackage").click(function() {
        $("#packageModal").css("display", "none");
    });
    
    // Activer le sélecteur de fichier personnalisé pour le package
    $(".custom-file-upload .file-select-button").click(function() {
        const inputId = $(this).parent().find("input[type='file']").attr("id");
        $("#" + inputId).trigger("click");
    });
    
    // Gérer l'affichage du nom de fichier sélectionné pour le package
    // Gestion améliorée du sélecteur de fichier pour les packages
    $("#filePackage").change(function(e) {
        e.preventDefault(); // Empêcher la soumission automatique
        e.stopPropagation(); // Empêcher la propagation de l'événement
        
        const fileInput = $(this)[0];
        if (fileInput.files && fileInput.files.length > 0) {
            $("#selectedFileName").html('<i class="fas fa-check-circle" style="color: #2c7d32;"></i> ' + fileInput.files[0].name);
            
            // Automatiquement extraire la version du nom de fichier si possible
            const fileName = fileInput.files[0].name;
            const versionMatch = fileName.match(/[-_](\d+\.\d+\.\d+)[-_\.]|[^a-zA-Z0-9](\d+\.\d+\.\d+)$/);
            if (versionMatch && (versionMatch[1] || versionMatch[2])) {
                const version = versionMatch[1] || versionMatch[2];
                if ($("#txtPackageVersion").val() === "") {
                    $("#txtPackageVersion").val(version);
                }
            }
        } else {
            $("#selectedFileName").text("");
        }
        
        // Maintenir le focus sur le modal
        setTimeout(() => {
            $("#packageModal").focus();
        }, 100);
        
        return false; // Empêcher tout comportement par défaut
    });
    
    // Téléverser un package
    $("#btnUploadPackage").click(function(e) {
        // Empêcher tout comportement de soumission qui pourrait causer un refresh
        e.preventDefault();
        e.stopPropagation();
        
        console.log("Bouton Téléverser package cliqué");
        
        const fileInput = $("#filePackage")[0];
        const version = $("#txtPackageVersion").val();
        
        if (!fileInput.files || fileInput.files.length === 0) {
            alert("Veuillez sélectionner un fichier ZIP.");
            return;
        }
        
        if (!version || !/^\d+\.\d+(\.\d+)?$/.test(version)) {
            alert("Veuillez entrer une version valide au format X.Y.Z");
            return;
        }
        
        // Désactiver le bouton pour éviter les soumissions multiples
        if ($(this).data('uploading')) {
            console.log("Téléversement déjà en cours, ignore l'événement");
            return;
        }
        
        // Afficher un indicateur de chargement
        const uploadBtn = $("#btnUploadPackage");
        const originalButtonText = uploadBtn.text();
        uploadBtn.data('uploading', true);
        uploadBtn.html('<i class="fas fa-spinner fa-spin"></i> Téléversement...');
        uploadBtn.prop('disabled', true);
        
        const formData = new FormData();
        formData.append("packageFile", fileInput.files[0]);
        
        let url = `${apiBaseUrl}/management/components/${currentComponentId}/package`;
        if (version) {
            url += `?version=${version}`;
        }
        
        // Ajouter un timeout pour annuler les requêtes trop longues
        const ajaxRequest = $.ajax({
            url: url,
            type: "POST",
            data: formData,
            processData: false,
            contentType: false,
            timeout: 60000, // 60 secondes
            headers: {
                "Authorization": `Bearer ${adminToken}`
            },
            success: function(response) {
                // Nettoyer les états
                uploadBtn.data('uploading', false);
                uploadBtn.html(originalButtonText);
                uploadBtn.prop('disabled', false);
                
                // Fermer la modal de téléversement
                $("#packageModal").css("display", "none");
                
                // Créer une notification de succès au lieu d'une alerte
                const successNotif = $(`<div class="alert alert-success">
                    <i class="fas fa-check-circle"></i> Package téléversé avec succès. Version: ${response.version}
                </div>`);
                
                // Ajouter la notification en haut de la page et la faire disparaître après 5 secondes
                $(".admin-header").after(successNotif);
                setTimeout(function() {
                    successNotif.fadeOut(500, function() {
                        $(this).remove();
                    });
                }, 5000);
                
                // Recharger la liste des composants
                loadComponents();
                
                // Réinitialiser le formulaire
                fileInput.value = '';
                $("#selectedFileName").text('');
            },
            error: function(xhr, status, error) {
                // Nettoyer les états
                uploadBtn.data('uploading', false);
                uploadBtn.html(originalButtonText);
                uploadBtn.prop('disabled', false);
                
                console.error("Erreur lors du téléversement du package:", error);
                alert(`Erreur lors du téléversement du package: ${xhr.status} ${xhr.statusText}`);
            }
        });
    });
    
    // Afficher le modal de téléversement d'icône
    function showIconModal(componentId) {
        currentComponentId = componentId;
        
        // Réinitialiser le formulaire
        $("#fileIcon").val("");
        
        // Charger l'icône actuelle si elle existe
        let iconPreview = $("#iconPreview");
        iconPreview.html(`<p>Chargement de l'icône...</p>`);
        
        $.ajax({
            url: `${apiBaseUrl}/management/components/${componentId}`,
            type: "GET",
            headers: {
                "Authorization": `Bearer ${adminToken}`
            },
            success: function(component) {
                // Préparer le HTML avec une icône par défaut temporaire
                iconPreview.html(`
                    <div style="text-align: center; margin-bottom: 15px;">
                        <h4>Icône actuelle</h4>
                        <img id="admin-icon-preview-${componentId}" 
                             alt="Icône du composant" 
                             src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iODAiIGhlaWdodD0iODAiIHJ4PSIxMCIgZmlsbD0iI2Y4ZjlmYSIgc3Ryb2tlPSIjMGQ2ZWZkIiBzdHJva2Utd2lkdGg9IjMiLz48cGF0aCBkPSJNMjggMzUgTDcyIDM1IiBzdHJva2U9IiMwZDZlZmQiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTI4IDUwIEw3MiA1MCIgc3Ryb2tlPSIjMGQ2ZWZkIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0yOCA2NSBMNTIgNjUiIHN0cm9rZT0iIzBkNmVmZCIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48Y2lyY2xlIGN4PSI3NSIgY3k9IjY1IiByPSI1IiBmaWxsPSIjMGQ2ZWZkIi8+PC9zdmc+"
                             style="max-width: 100px; max-height: 100px; border: 1px solid #ddd; padding: 5px;">
                        <p style="margin-top: 10px;"><small>Nom: ${component.name}.svg</small></p>
                    </div>
                `);
                
                // Afficher le nom du composant
                $("#iconModalTitle").text(`Téléverser une icône pour: ${component.displayName}`);
                
                // Charger l'icône réelle de manière asynchrone avec fetch et authorization header
                const iconUrl = `${apiBaseUrl}/management/components/${componentId}/icon`;
                const timestamp = new Date().getTime(); // Paramètre anti-cache
                
                // Utiliser fetch avec en-tête d'autorisation
                fetch(`${iconUrl}?t=${timestamp}`, {
                    headers: {
                        'Authorization': `Bearer ${adminToken}`
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Icône non trouvée');
                    }
                    return response.blob();
                })
                .then(blob => {
                    // Convertir le blob en data URL
                    const reader = new FileReader();
                    reader.onloadend = function() {
                        // Mettre à jour l'image avec la data URL
                        $(`#admin-icon-preview-${componentId}`).attr('src', reader.result);
                        console.log("Icône admin chargée avec succès");
                    };
                    reader.readAsDataURL(blob);
                })
                .catch(error => {
                    console.error("Erreur de chargement de l'icône:", error);
                    // L'image par défaut reste affichée, pas besoin de faire quoi que ce soit
                });
            },
            error: function() {
                iconPreview.html(`<p class="error">Impossible de charger les détails du composant</p>`);
            }
        });
        
        // Afficher le modal
        $("#iconModal").css("display", "block");
    }
    
    // Fermer le modal d'icône
    $(".close, #btnCancelIcon").click(function() {
        $("#iconModal").css("display", "none");
    });
    
    // Gérer l'affichage du nom de fichier sélectionné pour l'icône
    // Gestion améliorée du sélecteur de fichier pour les icônes
    $("#fileIcon").change(function(e) {
        e.preventDefault(); // Empêcher la soumission automatique
        e.stopPropagation(); // Empêcher la propagation de l'événement
        
        const fileInput = $(this)[0];
        if (fileInput.files && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            
            // Vérification préalable du type de fichier
            if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
                $("#selectedIconName").html('<span style="color: #dc3545;"><i class="fas fa-exclamation-circle"></i> Format invalide. Utilisez un fichier SVG.</span>');
            } else {
                $("#selectedIconName").html('<i class="fas fa-check-circle" style="color: #2c7d32;"></i> ' + file.name);
            }
        } else {
            $("#selectedIconName").text("");
        }
        
        // Maintenir le focus sur le modal
        setTimeout(() => {
            $("#iconModal").focus();
        }, 100);
        
        return false; // Empêcher tout comportement par défaut
    });
    
    // Téléverser une icône
    $("#btnUploadIcon").click(function() {
        const fileInput = $("#fileIcon")[0];
        
        if (!fileInput.files || fileInput.files.length === 0) {
            alert("Veuillez sélectionner un fichier SVG.");
            return;
        }
        
        const file = fileInput.files[0];
        
        // Vérification basique du type de fichier
        if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
            alert("Le fichier doit être au format SVG.");
            return;
        }
        
        // Désactiver le bouton pour éviter les soumissions multiples
        if ($(this).data('uploading')) {
            return;
        }
        
        // Afficher un indicateur de chargement
        const uploadBtn = $("#btnUploadIcon");
        const originalButtonText = uploadBtn.text();
        uploadBtn.data('uploading', true);
        uploadBtn.html('<i class="fas fa-spinner fa-spin"></i> Téléversement...');
        uploadBtn.prop('disabled', true);
        
        const formData = new FormData();
        formData.append("iconFile", file);
        
        // Ajouter un timeout pour annuler les requêtes trop longues
        $.ajax({
            url: `${apiBaseUrl}/management/components/${currentComponentId}/icon`,
            type: "POST",
            data: formData,
            processData: false,
            contentType: false,
            timeout: 30000, // 30 secondes
            headers: {
                "Authorization": `Bearer ${adminToken}`
            },
            success: function(response) {
                // Nettoyer les états
                uploadBtn.data('uploading', false);
                uploadBtn.html(originalButtonText);
                uploadBtn.prop('disabled', false);
                
                // Fermer la modal
                $("#iconModal").css("display", "none");
                
                // Créer une notification de succès au lieu d'une alerte
                const successNotif = $(`<div class="alert alert-success">
                    <i class="fas fa-check-circle"></i> Icône téléversée avec succès.
                </div>`);
                
                // Ajouter la notification en haut de la page et la faire disparaître après 5 secondes
                $(".admin-header").after(successNotif);
                setTimeout(function() {
                    successNotif.fadeOut(500, function() {
                        $(this).remove();
                    });
                }, 5000);
                
                // Recharger la liste des composants
                loadComponents();
                
                // Réinitialiser le formulaire
                fileInput.value = '';
                $("#selectedIconName").text('');
            },
            error: function(xhr, status, error) {
                // Nettoyer les états
                uploadBtn.data('uploading', false);
                uploadBtn.html(originalButtonText);
                uploadBtn.prop('disabled', false);
                
                console.error("Erreur lors du téléversement de l'icône:", error);
                alert(`Erreur lors du téléversement de l'icône: ${xhr.status} ${xhr.statusText}`);
            }
        });
    });
    
    // Confirmer la suppression d'un composant
    function confirmDeleteComponent(componentId) {
        deleteTarget = componentId;
        deleteType = "component";
        
        $("#confirmDeleteMessage").text(`Êtes-vous sûr de vouloir supprimer le composant ID ${componentId} ? Cette action est irréversible.`);
        $("#confirmDeleteModal").css("display", "block");
    }
    
    // Fonction déplacée en haut du fichier pour éviter l'erreur "confirmDeleteVersion is not defined"

    // ========== Gestion des clés API ==========
    
    // Charger la liste des clés API
    function loadApiKeys() {
        $("#apiKeysTable tbody").html('<tr><td colspan="6" class="loading">Chargement des clés API...</td></tr>');
        
        $.ajax({
            url: `${apiBaseUrl}/management/apikeys`,
            type: "GET",
            headers: {
                "Authorization": `Bearer ${adminToken}`
            },
            success: function(response) {
                displayApiKeys(response);
            },
            error: function(xhr, status, error) {
                console.error("Erreur lors du chargement des clés API:", error);
                $("#apiKeysTable tbody").html(`<tr><td colspan="6" class="error">Erreur lors du chargement des clés API: ${xhr.status} ${xhr.statusText}</td></tr>`);
            }
        });
    }
    
    // Afficher les clés API dans le tableau
    function displayApiKeys(apiKeys) {
        if (!apiKeys) {
            $("#apiKeysTable tbody").html('<tr><td colspan="6">Aucune clé API trouvée</td></tr>');
            return;
        }
        
        // Vérifier si apiKeys est un tableau ou un objet avec une propriété contenant un tableau
        let keysArray = apiKeys;
        if (!Array.isArray(apiKeys)) {
            console.log("Response format:", apiKeys);
            if (apiKeys.$values && Array.isArray(apiKeys.$values)) {
                keysArray = apiKeys.$values;
            } else if (apiKeys.apiKeys && Array.isArray(apiKeys.apiKeys)) {
                keysArray = apiKeys.apiKeys;
            } else if (apiKeys.items && Array.isArray(apiKeys.items)) {
                keysArray = apiKeys.items;
            } else if (apiKeys.data && Array.isArray(apiKeys.data)) {
                keysArray = apiKeys.data;
            } else {
                console.error("Format de réponse inattendu pour les clés API:", apiKeys);
                $("#apiKeysTable tbody").html('<tr><td colspan="6">Erreur: format de données non reconnu</td></tr>');
                return;
            }
        }
        
        if (keysArray.length === 0) {
            $("#apiKeysTable tbody").html('<tr><td colspan="6">Aucune clé API trouvée</td></tr>');
            return;
        }
        
        let html = '';
        keysArray.forEach(function(apiKey) {
            // Debug pour voir la structure exacte de l'objet apiKey
            console.log("Structure de l'objet apiKey:", apiKey);
            
            // Normaliser les noms de propriétés
            const id = apiKey.apiKeyId || apiKey.id || 'N/A';
            const clientId = apiKey.clientId || 'N/A';
            const keyValue = apiKey.key || 'N/A';
            const isAdmin = apiKey.isAdmin === true;
            const createdDate = apiKey.createdDate ? new Date(apiKey.createdDate).toLocaleDateString() : 'N/A';
            
            html += `<tr>
                <td>${id}</td>
                <td>${clientId}</td>
                <td>${keyValue !== 'N/A' ? keyValue.substring(0, 10) + '...' : 'N/A'}</td>
                <td>${isAdmin ? 'Oui' : 'Non'}</td>
                <td>${createdDate}</td>
                <td class="action-buttons">
                    <a href="#" class="action-btn action-btn-delete" data-id="${id}">Supprimer</a>
                </td>
            </tr>`;
        });
        
        $("#apiKeysTable tbody").html(html);
        
        // Attacher les gestionnaires d'événements
        $("#apiKeysTable .action-btn-delete").click(function(e) {
            e.preventDefault();
            const apiKeyId = $(this).data("id");
            confirmDeleteApiKey(apiKeyId);
        });
    }
    
    // Ouvrir le modal d'ajout de clé API
    $("#btnAddApiKey").click(function(e) {
        e.preventDefault();
        $("#txtClientId").val("");
        $("#chkIsAdmin").prop("checked", false);
        $("#apiKeyModal").css("display", "block");
    });
    
    // Fermer le modal de clé API
    $(".close, #btnCancelApiKey").click(function() {
        $("#apiKeyModal").css("display", "none");
    });
    
    // Créer une nouvelle clé API
    $("#btnSaveApiKey").click(function() {
        const apiKey = {
            clientId: $("#txtClientId").val(),
            isAdmin: $("#chkIsAdmin").is(":checked")
        };
        
        // Validation basique
        if (!apiKey.clientId) {
            alert("Veuillez saisir un identifiant client.");
            return;
        }
        
        $.ajax({
            url: `${apiBaseUrl}/management/apikeys`,
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify(apiKey),
            headers: {
                "Authorization": `Bearer ${adminToken}`
            },
            success: function(response) {
                $("#apiKeyModal").css("display", "none");
                
                // Afficher la structure complète de la réponse pour le débogage
                console.log("Réponse de création de clé API (structure complète):", JSON.stringify(response, null, 2));
                
                // Extraire la clé de l'objet réponse en gérant tous les cas possibles
                let keyValue = "";
                
                // Cas 1: Réponse est une chaîne
                if (typeof response === 'string') {
                    keyValue = response;
                } 
                // Cas 2: Response.apiKey est un objet qui contient key
                else if (response && response.apiKey && typeof response.apiKey === 'object' && response.apiKey.key) {
                    keyValue = response.apiKey.key;
                    console.log("Clé extraite de response.apiKey.key:", keyValue);
                }
                // Cas 3: Response.apiKey est directement la valeur
                else if (response && response.apiKey && typeof response.apiKey === 'string') {
                    keyValue = response.apiKey;
                    console.log("Clé extraite de response.apiKey (string):", keyValue);
                }
                // Cas 4: Propriété key au premier niveau
                else if (response && response.key) {
                    keyValue = response.key;
                    console.log("Clé extraite de response.key:", keyValue);
                }
                // Cas 5: Propriété value
                else if (response && response.value) {
                    keyValue = response.value;
                    console.log("Clé extraite de response.value:", keyValue);
                }
                // Cas de dernier recours: sérialiser en JSON
                else {
                    console.error("Impossible d'extraire la clé API de la réponse");
                    keyValue = "Valeur non trouvée. Consultez la console pour plus de détails.";
                }
                
                // Créer une modal personnalisée pour afficher la clé API avec option de copie
                const modalHtml = `
                <div id="apiKeyResultModal" class="modal" style="display:block">
                    <div class="modal-content">
                        <h3>Clé API générée</h3>
                        <p>CONSERVEZ CETTE CLÉ, elle ne sera plus jamais affichée.</p>
                        
                        <div class="api-key-container" style="margin: 20px 0; padding: 10px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px;">
                            <div style="font-family: monospace; word-break: break-all; margin-bottom: 10px;">${keyValue}</div>
                            <button id="copyApiKeyBtn" class="btn btn-primary" style="width: auto; padding: 5px 10px;">Copier la clé</button>
                            <span id="copyMessage" style="margin-left: 10px; color: green; display: none;">Copié !</span>
                        </div>
                        
                        <div class="modal-footer" style="display: flex; justify-content: flex-end; margin-top: 20px;">
                            <button id="closeApiKeyModalBtn" class="btn">Fermer</button>
                        </div>
                    </div>
                </div>`;
                
                // Ajouter la modal au document
                $('body').append(modalHtml);
                
                // Gérer le bouton de copie
                $('#copyApiKeyBtn').click(function() {
                    navigator.clipboard.writeText(keyValue).then(function() {
                        $('#copyMessage').show().delay(1500).fadeOut();
                    }).catch(function(err) {
                        console.error('Erreur lors de la copie: ', err);
                        alert('Impossible de copier automatiquement. Veuillez sélectionner et copier manuellement.');
                    });
                });
                
                // Gérer la fermeture de la modal
                $('#closeApiKeyModalBtn').click(function() {
                    $('#apiKeyResultModal').remove();
                });
                
                // Recharger la liste des clés API
                loadApiKeys();
            },
            error: function(xhr, status, error) {
                console.error("Erreur lors de la création de la clé API:", error);
                alert(`Erreur lors de la création de la clé API: ${xhr.status} ${xhr.statusText}`);
            }
        });
    });
    
    // Confirmer la suppression d'une clé API
    function confirmDeleteApiKey(apiKeyId) {
        deleteTarget = apiKeyId;
        deleteType = "apikey";
        
        $("#confirmDeleteMessage").text(`Êtes-vous sûr de vouloir supprimer la clé API ID ${apiKeyId} ? Cette action est irréversible.`);
        $("#confirmDeleteModal").css("display", "block");
    }

    // ========== Synchronisation GitHub ==========
    
    // Synchronisation avec GitHub
    $("#btnSyncGitHub").click(function(e) {
        e.preventDefault();
        
        const repository = $("#txtGitHubRepo").val();
        
        if (!repository) {
            alert("Veuillez saisir l'URL du dépôt GitHub.");
            return;
        }
        
        // Afficher un message de chargement
        $("#syncResults").html("<p>Synchronisation en cours...</p>");
        
        $.ajax({
            url: `${apiBaseUrl}/management/github/sync?repository=${encodeURIComponent(repository)}`,
            type: "POST",
            headers: {
                "Authorization": `Bearer ${adminToken}`
            },
            success: function(response) {
                let html = "<h3>Synchronisation terminée</h3>";
                
                // Nouveaux composants
                if (response.newComponents && response.newComponents.length > 0) {
                    html += "<h4>Nouveaux composants</h4><ul>";
                    response.newComponents.forEach(function(component) {
                        html += `<li>${component}</li>`;
                    });
                    html += "</ul>";
                }
                
                // Composants mis à jour
                if (response.updatedComponents && response.updatedComponents.length > 0) {
                    html += "<h4>Composants mis à jour</h4><ul>";
                    response.updatedComponents.forEach(function(component) {
                        html += `<li>${component}</li>`;
                    });
                    html += "</ul>";
                }
                
                // Composants en échec
                if (response.failedComponents && response.failedComponents.length > 0) {
                    html += "<h4>Composants en échec</h4><ul>";
                    response.failedComponents.forEach(function(component) {
                        html += `<li>${component}</li>`;
                    });
                    html += "</ul>";
                }
                
                $("#syncResults").html(html);
                
                // Rafraîchir la liste des composants
                loadComponents();
            },
            error: function(xhr, status, error) {
                console.error("Erreur lors de la synchronisation avec GitHub:", error);
                $("#syncResults").html(`<p class="error">Erreur lors de la synchronisation: ${xhr.status} ${xhr.statusText}</p>`);
            }
        });
    });

    // ========== Gestion du modal de confirmation de suppression ==========
    
    // Fermer le modal de confirmation
    $(".close, #btnCancelDelete").click(function() {
        $("#confirmDeleteModal").css("display", "none");
    });
    
    // Confirmer la suppression
    $("#btnConfirmDelete").click(function() {
        if (deleteType === "component") {
            deleteComponent(deleteTarget);
        } else if (deleteType === "apikey") {
            deleteApiKey(deleteTarget);
        } else if (deleteType === "version") {
            deleteVersion(currentComponentId, deleteTarget);
        }
    });
    
    // Supprimer un composant
    function deleteComponent(componentId) {
        $.ajax({
            url: `${apiBaseUrl}/management/components/${componentId}`,
            type: "DELETE",
            headers: {
                "Authorization": `Bearer ${adminToken}`
            },
            success: function() {
                $("#confirmDeleteModal").css("display", "none");
                loadComponents();
            },
            error: function(xhr, status, error) {
                console.error("Erreur lors de la suppression du composant:", error);
                alert(`Erreur lors de la suppression du composant: ${xhr.status} ${xhr.statusText}`);
                $("#confirmDeleteModal").css("display", "none");
            }
        });
    }
    
    // Supprimer une clé API
    function deleteApiKey(apiKeyId) {
        $.ajax({
            url: `${apiBaseUrl}/management/apikeys/${apiKeyId}`,
            type: "DELETE",
            headers: {
                "Authorization": `Bearer ${adminToken}`
            },
            success: function() {
                $("#confirmDeleteModal").css("display", "none");
                loadApiKeys();
            },
            error: function(xhr, status, error) {
                console.error("Erreur lors de la suppression de la clé API:", error);
                alert(`Erreur lors de la suppression de la clé API: ${xhr.status} ${xhr.statusText}`);
                $("#confirmDeleteModal").css("display", "none");
            }
        });
    }
    
    // Fonction déplacée en haut du fichier pour éviter les erreurs de référence
});