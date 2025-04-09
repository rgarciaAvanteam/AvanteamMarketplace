// JavaScript pour l'interface d'administration du Marketplace
$(document).ready(function() {
    // Variables globales
    var currentComponentId = null;
    var currentApiKeyId = null;
    var deleteTarget = null;
    var deleteType = null;

    // Initialisation
    initTabs();
    loadComponents();
    loadApiKeys();

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
                console.log("Response format from components:", response);
                
                // Gérer les différents formats de réponse possibles
                let componentsArray = null;
                
                if (response && response.components) {
                    // Si components est un objet avec $values
                    if (response.components.$values) {
                        componentsArray = response.components.$values;
                    } 
                    // Si components est déjà un tableau
                    else if (Array.isArray(response.components)) {
                        componentsArray = response.components;
                    }
                    // Si components contient des propriétés autre que $id
                    else {
                        componentsArray = response.components;
                    }
                } else if (response && response.$values) {
                    componentsArray = response.$values;
                } else if (response && Array.isArray(response)) {
                    componentsArray = response;
                } else if (response && response.$id && response.$values) {
                    componentsArray = response.$values;
                }
                
                console.log("Components array extracted:", componentsArray);
                
                displayComponents(componentsArray);
            },
            error: function(xhr, status, error) {
                console.error("Erreur lors du chargement des composants:", error);
                $("#componentsTable tbody").html(`<tr><td colspan="6" class="error">Erreur lors du chargement des composants: ${xhr.status} ${xhr.statusText}</td></tr>`);
            }
        });
    }
    
    // Afficher les composants dans le tableau
    function displayComponents(components) {
        if (!components || !Array.isArray(components) || components.length === 0) {
            $("#componentsTable tbody").html('<tr><td colspan="6">Aucun composant trouvé</td></tr>');
            return;
        }
        
        let html = '';
        components.forEach(function(component) {
            const updatedDate = new Date(component.updatedDate).toLocaleDateString();
            
            html += `<tr>
                <td>${component.componentId}</td>
                <td>${component.displayName} <small>(${component.name})</small></td>
                <td>${component.category}</td>
                <td>${component.version}</td>
                <td>${updatedDate}</td>
                <td class="action-buttons">
                    <a href="#" class="action-btn action-btn-edit" data-id="${component.componentId}">Modifier</a>
                    <a href="#" class="action-btn action-btn-package" data-id="${component.componentId}">Package</a>
                    <a href="#" class="action-btn action-btn-delete" data-id="${component.componentId}">Supprimer</a>
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
        
        $("#componentsTable .action-btn-delete").click(function(e) {
            e.preventDefault();
            const componentId = $(this).data("id");
            confirmDeleteComponent(componentId);
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
                    $("#txtName").val(component.name);
                    $("#txtDisplayName").val(component.displayName);
                    $("#txtDescription").val(component.description);
                    $("#txtVersion").val(component.version);
                    $("#txtCategory").val(component.category);
                    $("#txtAuthor").val(component.author);
                    $("#txtMinPlatformVersion").val(component.minPlatformVersion);
                    $("#txtRepositoryUrl").val(component.repositoryUrl);
                    $("#txtTags").val(component.tags.join(", "));
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
    });
    
    // Enregistrer un composant (ajout ou modification)
    $("#btnSaveComponent").click(function() {
        const component = {
            name: $("#txtName").val(),
            displayName: $("#txtDisplayName").val(),
            description: $("#txtDescription").val(),
            version: $("#txtVersion").val(),
            category: $("#txtCategory").val(),
            author: $("#txtAuthor").val(),
            minPlatformVersion: $("#txtMinPlatformVersion").val(),
            repositoryUrl: $("#txtRepositoryUrl").val(),
            requiresRestart: $("#chkRequiresRestart").is(":checked"),
            tags: $("#txtTags").val().split(",").map(tag => tag.trim()).filter(tag => tag !== "")
        };
        
        // Validation basique
        if (!component.name || !component.displayName || !component.version || !component.category) {
            alert("Veuillez remplir tous les champs obligatoires.");
            return;
        }
        
        // Ajout ou modification
        if (currentComponentId) {
            // Modification
            $.ajax({
                url: `${apiBaseUrl}/management/components/${currentComponentId}`,
                type: "PUT",
                contentType: "application/json",
                data: JSON.stringify(component),
                headers: {
                    "Authorization": `Bearer ${adminToken}`
                },
                success: function() {
                    $("#componentModal").css("display", "none");
                    loadComponents();
                },
                error: function(xhr, status, error) {
                    console.error("Erreur lors de la modification du composant:", error);
                    alert(`Erreur lors de la modification du composant: ${xhr.status} ${xhr.statusText}`);
                }
            });
        } else {
            // Ajout
            $.ajax({
                url: `${apiBaseUrl}/management/components`,
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify(component),
                headers: {
                    "Authorization": `Bearer ${adminToken}`
                },
                success: function() {
                    $("#componentModal").css("display", "none");
                    loadComponents();
                },
                error: function(xhr, status, error) {
                    console.error("Erreur lors de l'ajout du composant:", error);
                    alert(`Erreur lors de l'ajout du composant: ${xhr.status} ${xhr.statusText}`);
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
    
    // Téléverser un package
    $("#btnUploadPackage").click(function() {
        const fileInput = $("#filePackage")[0];
        const version = $("#txtPackageVersion").val();
        
        if (!fileInput.files || fileInput.files.length === 0) {
            alert("Veuillez sélectionner un fichier.");
            return;
        }
        
        const formData = new FormData();
        formData.append("packageFile", fileInput.files[0]);
        
        let url = `${apiBaseUrl}/management/components/${currentComponentId}/package`;
        if (version) {
            url += `?version=${version}`;
        }
        
        $.ajax({
            url: url,
            type: "POST",
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                "Authorization": `Bearer ${adminToken}`
            },
            success: function(response) {
                $("#packageModal").css("display", "none");
                alert(`Package téléversé avec succès. Version: ${response.version}`);
                loadComponents();
            },
            error: function(xhr, status, error) {
                console.error("Erreur lors du téléversement du package:", error);
                alert(`Erreur lors du téléversement du package: ${xhr.status} ${xhr.statusText}`);
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
            const createdDate = apiKey.createdDate ? new Date(apiKey.createdDate).toLocaleDateString() : 'N/A';
            
            html += `<tr>
                <td>${apiKey.id || 'N/A'}</td>
                <td>${apiKey.clientId || 'N/A'}</td>
                <td>${apiKey.key ? apiKey.key.substring(0, 10) + '...' : 'N/A'}</td>
                <td>${apiKey.isAdmin ? 'Oui' : 'Non'}</td>
                <td>${createdDate}</td>
                <td class="action-buttons">
                    <a href="#" class="action-btn action-btn-delete" data-id="${apiKey.id}">Supprimer</a>
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
                
                // Afficher la clé générée
                alert(`Clé API générée: ${response.apiKey}\n\nCONSERVEZ CETTE CLÉ, elle ne sera plus jamais affichée.`);
                
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
});