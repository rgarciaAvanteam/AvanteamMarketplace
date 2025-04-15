// admin-components.js
// Gestion des composants du Marketplace

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
    
    // Réinitialiser la section de téléversement du package
    $("#fileManifestPackage").val("");
    $("#selectedManifestFileName").text("");
    $("#parseManifestResult").hide();
    
    // Si c'est une modification, cacher la section de téléversement du package
    if (componentId) {
        $(".form-group:has(#fileManifestPackage)").hide();
        
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
    } else {
        // Pour un nouveau composant, afficher la section de téléversement du package
        $(".form-group:has(#fileManifestPackage)").show();
    }
    
    // Afficher le modal
    $("#componentModal").css("display", "block");
    
    // Réinitialiser la clé de package
    window.currentPackageKey = null;
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
            success: function(response) {
                $("#componentModal").css("display", "none");
                // Nettoyer les détails du composant stockés en mémoire
                window.currentComponentDetails = null;
                
                // Extraire l'ID du composant créé
                let componentId = null;
                if (response && response.componentId) {
                    componentId = response.componentId;
                } else if (typeof response === 'number') {
                    componentId = response;
                }
                
                console.log("Composant créé avec l'ID:", componentId);
                
                // Si nous avons un ID de composant, créer automatiquement la première version
                if (componentId) {
                    // Créer la première version avec les mêmes valeurs que le composant
                    const versionData = {
                        Version: newComponent.version,
                        ChangeLog: "Version initiale",
                        MinPlatformVersion: newComponent.minPlatformVersion || "",
                        IsLatest: true
                    };
                    
                    console.log("Création automatique de la première version:", versionData);
                    
                    // Créer la version
                    $.ajax({
                        url: `${apiBaseUrl}/management/components/${componentId}/versions`,
                        type: "POST",
                        contentType: "application/json",
                        data: JSON.stringify(versionData),
                        headers: {
                            "Authorization": `Bearer ${adminToken}`
                        },
                        success: function(versionResponse) {
                            console.log("Première version créée avec succès:", versionResponse);
                            // Afficher une notification
                            const successNotif = $(`<div class="alert alert-success">
                                <i class="fas fa-check-circle"></i> Composant créé avec succès avec une version initiale
                            </div>`);
                            $(".admin-header").after(successNotif);
                            setTimeout(() => successNotif.fadeOut(500, function() { $(this).remove(); }), 5000);
                        },
                        error: function(xhr, status, error) {
                            console.error("Erreur lors de la création de la version initiale:", error);
                            // Afficher une notification d'erreur mais continuer
                            const errorNotif = $(`<div class="alert alert-warning">
                                <i class="fas fa-exclamation-circle"></i> Composant créé avec succès, mais erreur lors de la création de la version initiale
                            </div>`);
                            $(".admin-header").after(errorNotif);
                            setTimeout(() => errorNotif.fadeOut(500, function() { $(this).remove(); }), 5000);
                        },
                        complete: function() {
                            // Recharger la liste des composants dans tous les cas
                            loadComponents();
                        }
                    });
                } else {
                    // Si nous n'avons pas d'ID, simplement recharger les composants
                    loadComponents();
                    // Afficher une notification de succès standard
                    const successNotif = $(`<div class="alert alert-success">
                        <i class="fas fa-check-circle"></i> Composant créé avec succès
                    </div>`);
                    $(".admin-header").after(successNotif);
                    setTimeout(() => successNotif.fadeOut(500, function() { $(this).remove(); }), 5000);
                }
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
    $("#selectedFileName").text("");
    
    // Réinitialiser les gestionnaires de fichiers
    initFileHandlers();
    
    // Afficher le modal
    $("#packageModal").css("display", "block");
    console.log("Modal package affiché pour le composant", componentId);
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
    $("#selectedIconName").text("");
    
    // Réinitialiser les gestionnaires de fichiers
    initFileHandlers();
    
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