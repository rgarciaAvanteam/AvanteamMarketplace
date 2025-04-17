// admin-apikeys.js
// Gestion des clés API du Marketplace

// ========== Gestion des clés API ==========

// Charger la liste des clés API
function loadApiKeys() {
    $("#apiKeysTable tbody").html('<tr><td colspan="8" class="loading">Chargement des clés API...</td></tr>');
    
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
            $("#apiKeysTable tbody").html(`<tr><td colspan="8" class="error">Erreur lors du chargement des clés API: ${xhr.status} ${xhr.statusText}</td></tr>`);
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
        $("#apiKeysTable tbody").html('<tr><td colspan="8">Aucune clé API trouvée</td></tr>');
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
            $("#apiKeysTable tbody").html('<tr><td colspan="8">Erreur: format de données non reconnu</td></tr>');
            return;
        }
    }
    
    // Stocker les clés API dans la variable globale
    allApiKeys = keysArray;
    
    if (keysArray.length === 0) {
        $("#apiKeysTable tbody").html('<tr><td colspan="8">Aucune clé API trouvée</td></tr>');
        return;
    }
    
    // Afficher les clés API
    renderApiKeysTable(keysArray);
}

// Fonction pour afficher les clés API dans le tableau
function renderApiKeysTable(keysArray) {
    if (!keysArray || keysArray.length === 0) {
        $("#apiKeysTable tbody").html('<tr><td colspan="8">Aucune clé API trouvée</td></tr>');
        return;
    }
    
    let html = '';
    keysArray.forEach(function(apiKey) {
        // Normaliser les noms de propriétés
        const id = apiKey.apiKeyId || apiKey.id || 'N/A';
        const clientId = apiKey.clientId || 'N/A';
        const keyValue = apiKey.key || 'N/A';
        const isAdmin = apiKey.isAdmin === true;
        const createdDate = apiKey.createdDate ? new Date(apiKey.createdDate).toLocaleDateString() : 'N/A';
        
        const baseUrl = apiKey.baseUrl || 'N/A';
        const platformVersion = apiKey.platformVersion || 'N/A';
        
        html += `<tr>
            <td>${id}</td>
            <td>${clientId}</td>
            <td>${baseUrl}</td>
            <td>${platformVersion}</td>
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
    $("#txtBaseUrl").val("");
    $("#txtPlatformVersion").val("");
    $("#chkIsAdmin").prop("checked", false);
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
        isAdmin: $("#chkIsAdmin").is(":checked")
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