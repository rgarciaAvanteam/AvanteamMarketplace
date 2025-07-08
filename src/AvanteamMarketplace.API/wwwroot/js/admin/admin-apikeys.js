// admin-apikeys.js
// Gestion des clés API du Marketplace

// ========== Gestion des clés API ==========

// Charger la liste des clés API
function loadApiKeys() {
    $("#apiKeysTable tbody").html('<tr><td colspan="10" class="loading">Chargement des clés API...</td></tr>');
    
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
            $("#apiKeysTable tbody").html(`<tr><td colspan="10" class="error">Erreur lors du chargement des clés API: ${xhr.status} ${xhr.statusText}</td></tr>`);
        }
    });
}

// Variable pour stocker toutes les clés API
let allApiKeys = [];

// Fonction pour filtrer les clés API
function filterApiKeys() {
    const searchTerm = $("#searchApiKeys").val().toLowerCase();
    
    if (!allApiKeys || allApiKeys.length === 0) {
        return;
    }
    
    const filteredKeys = allApiKeys.filter(apiKey => {
        const id = apiKey.apiKeyId || apiKey.id || '';
        const clientId = apiKey.clientId || '';
        const baseUrl = apiKey.baseUrl || '';
        const platformVersion = apiKey.platformVersion || '';
        
        return id.toString().toLowerCase().includes(searchTerm) || 
               clientId.toString().toLowerCase().includes(searchTerm) || 
               baseUrl.toLowerCase().includes(searchTerm) || 
               platformVersion.toLowerCase().includes(searchTerm);
    });
    
    renderApiKeysTable(filteredKeys);
}

// Écouteur d'événement pour le champ de recherche
$(document).on('input', '#searchApiKeys', filterApiKeys);

// Afficher les clés API dans le tableau
function displayApiKeys(apiKeys) {
    if (!apiKeys) {
        $("#apiKeysTable tbody").html('<tr><td colspan="10">Aucune clé API trouvée</td></tr>');
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
            $("#apiKeysTable tbody").html('<tr><td colspan="10">Erreur: format de données non reconnu</td></tr>');
            return;
        }
    }
    
    // Stocker les clés API dans la variable globale
    allApiKeys = keysArray;
    
    if (keysArray.length === 0) {
        $("#apiKeysTable tbody").html('<tr><td colspan="10">Aucune clé API trouvée</td></tr>');
        return;
    }
    
    // Afficher les clés API
    renderApiKeysTable(keysArray);
}

// Fonction pour afficher les clés API dans le tableau
function renderApiKeysTable(keysArray) {
    if (!keysArray || keysArray.length === 0) {
        $("#apiKeysTable tbody").html('<tr><td colspan="10">Aucune clé API trouvée</td></tr>');
        return;
    }
    
    let html = '';
    keysArray.forEach(function(apiKey) {
        // Normaliser les noms de propriétés
        const id = apiKey.apiKeyId || apiKey.id || 'N/A';
        const clientId = apiKey.clientId || 'N/A';
        const keyValue = apiKey.key || 'N/A';
        const isAdmin = apiKey.isAdmin === true;
        const canAccessAdmin = apiKey.canAccessAdminInterface === true;
        const canReadAdmin = apiKey.canReadAdminInterface === true;
        const createdDate = apiKey.createdDate ? new Date(apiKey.createdDate).toLocaleDateString() : 'N/A';
        
        const baseUrl = apiKey.baseUrl || 'N/A';
        const platformVersion = apiKey.platformVersion || 'N/A';
        
        html += `<tr data-client-id="${clientId}" class="selectable-row">
            <td>${id}</td>
            <td>${clientId}</td>
            <td>${baseUrl}</td>
            <td>${platformVersion}</td>
            <td>${keyValue !== 'N/A' ? keyValue.substring(0, 10) + '...' : 'N/A'}</td>
            <td>${isAdmin ? 'Oui' : 'Non'}</td>
            <td>${canAccessAdmin ? 'Oui' : 'Non'}</td>
            <td>${canReadAdmin ? 'Oui' : 'Non'}</td>
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
    
    // Ajouter un gestionnaire d'événements pour la sélection des lignes
    $("#apiKeysTable tbody tr").click(function(e) {
        // Ne pas déclencher sur clic des boutons d'action
        if ($(e.target).hasClass('action-btn') || $(e.target).closest('.action-btn').length) {
            return;
        }
        
        // Désélectionner toutes les lignes
        $("#apiKeysTable tbody tr").removeClass('selected');
        
        // Sélectionner cette ligne
        $(this).addClass('selected');
        
        // Récupérer le client ID
        const clientId = $(this).data('client-id');
        if (clientId && clientId !== 'N/A') {
            loadInstalledComponentsForClient(clientId);
        }
    });
}

// Ouvrir le modal d'ajout de clé API
$("#btnAddApiKey").click(function(e) {
    e.preventDefault();
    $("#txtClientId").val("");
    $("#txtBaseUrl").val("");
    $("#txtPlatformVersion").val("");
    $("#chkIsAdmin").prop("checked", false);
    $("#chkCanAccessAdminInterface").prop("checked", false);
    $("#chkCanReadAdminInterface").prop("checked", false);
    $("#apiKeyModal").css("display", "block");
});

// Fermer le modal de clé API
$(".close, #btnCancelApiKey").click(function() {
    $("#apiKeyModal").css("display", "none");
});

// Réinitialiser le filtre des clés API
function resetApiKeyFilter() {
    $("#searchApiKeys").val("");
    if (allApiKeys && allApiKeys.length > 0) {
        renderApiKeysTable(allApiKeys);
    }
}

// Créer une nouvelle clé API
$("#btnSaveApiKey").click(function() {
    const apiKey = {
        clientId: $("#txtClientId").val(),
        baseUrl: $("#txtBaseUrl").val(),
        platformVersion: $("#txtPlatformVersion").val(),
        isAdmin: $("#chkIsAdmin").is(":checked"),
        canAccessAdminInterface: $("#chkCanAccessAdminInterface").is(":checked"),
        canReadAdminInterface: $("#chkCanReadAdminInterface").is(":checked")
    };
    
    // Validation basique
    if (!apiKey.clientId) {
        alert("Veuillez saisir un identifiant client.");
        return;
    }
    
    if (!apiKey.baseUrl) {
        alert("Veuillez saisir une URL de base.");
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
            
            // Recharger la liste des clés API et réinitialiser le filtre
            loadApiKeys();
            resetApiKeyFilter();
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
            resetApiKeyFilter();
        },
        error: function(xhr, status, error) {
            console.error("Erreur lors de la suppression de la clé API:", error);
            alert(`Erreur lors de la suppression de la clé API: ${xhr.status} ${xhr.statusText}`);
            $("#confirmDeleteModal").css("display", "none");
        }
    });
}

// Fonction pour charger les composants installés pour un client spécifique
function loadInstalledComponentsForClient(clientId) {
    console.log(`Chargement des composants installés pour le client ${clientId}`);
    
    // Vérifier si la section existe déjà
    if (!$("#installed-components-section").length) {
        // Créer la section si elle n'existe pas
        $("#apikeys-tab").append(`
            <div id="installed-components-section" class="installed-components-section">
                <h3>Composants installés pour ${clientId}</h3>
                <div class="loading">Chargement des composants installés...</div>
            </div>
        `);
    } else {
        // Mettre à jour le contenu avec un indicateur de chargement
        $("#installed-components-section").html(`
            <h3>Composants installés pour ${clientId}</h3>
            <div class="loading">Chargement des composants installés...</div>
        `);
    }
    
    // Appeler l'API pour récupérer les composants installés
    $.ajax({
        url: `${apiBaseUrl}/management/clients/${encodeURIComponent(clientId)}/components`,
        type: "GET",
        headers: {
            "Authorization": `Bearer ${adminToken}`
        },
        success: function(response) {
            displayInstalledComponents(clientId, response);
        },
        error: function(xhr, status, error) {
            console.error(`Erreur lors du chargement des composants installés pour ${clientId}:`, error);
            $("#installed-components-section").html(`
                <h3>Composants installés pour ${clientId}</h3>
                <div class="error-message">Erreur lors du chargement des composants: ${xhr.status} ${xhr.statusText}</div>
            `);
        }
    });
}

// Fonction pour afficher les composants installés
function displayInstalledComponents(clientId, components) {
    console.log(`Affichage des composants installés pour ${clientId}:`, components);
    
    if (!components || components.length === 0) {
        $("#installed-components-section").html(`
            <h3>Composants installés pour ${clientId}</h3>
            <div class="info-message">Aucun composant installé pour ce client</div>
        `);
        return;
    }
    
    // Trier les composants par statut puis par nom
    components.sort(function(a, b) {
        // Ordre de priorité des statuts
        const statusOrder = {
            'not-supported': 1,
            'update-available': 2,
            'up-to-date': 3,
            'unknown': 4
        };
        
        // Récupérer les statuts
        const statusA = a.status || 'unknown';
        const statusB = b.status || 'unknown';
        
        // Trier d'abord par statut
        if (statusOrder[statusA] !== statusOrder[statusB]) {
            return statusOrder[statusA] - statusOrder[statusB];
        }
        
        // Puis par nom
        return (a.displayName || a.name).localeCompare(b.displayName || b.name);
    });
    
    let html = `
        <h3>Composants installés pour ${clientId}</h3>
        <div class="installed-components-table-container">
            <table class="installed-components-table admin-table">
                <thead>
                    <tr>
                        <th>Composant</th>
                        <th>Catégorie</th>
                        <th>Version installée</th>
                        <th>Dernière version</th>
                        <th>Date d'installation</th>
                        <th>État</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    components.forEach(function(component) {
        // Déterminer la classe et le texte pour l'état
        let statusClass = '';
        let statusText = '';
        
        switch (component.status) {
            case 'up-to-date':
                statusClass = 'status-ok';
                statusText = 'À jour';
                break;
            case 'update-available':
                statusClass = 'status-warning';
                statusText = 'Mise à jour disponible';
                break;
            case 'not-supported':
                statusClass = 'status-error';
                statusText = 'Plus supporté';
                break;
            default:
                statusClass = 'status-unknown';
                statusText = 'État inconnu';
        }
        
        // Formatter les dates
        const installDate = component.installDate 
            ? new Date(component.installDate).toLocaleDateString() 
            : 'N/A';
        
        const lastUpdateDate = component.lastUpdateDate 
            ? new Date(component.lastUpdateDate).toLocaleDateString() 
            : 'N/A';
        
        html += `
            <tr>
                <td>${component.displayName || component.name}</td>
                <td>${component.category || 'Non catégorisé'}</td>
                <td>${component.version || 'N/A'}</td>
                <td>${component.latestVersion || 'N/A'}</td>
                <td title="Dernière mise à jour: ${lastUpdateDate}">${installDate}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    $("#installed-components-section").html(html);
}