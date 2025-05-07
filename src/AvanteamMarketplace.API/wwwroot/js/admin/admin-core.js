// admin-core.js
// Module principal de l'interface d'administration du Marketplace

// Variables globales - déclarées pour être accessibles partout
var currentComponentId = null;
var currentApiKeyId = null;
var currentVersionId = null;
var deleteTarget = null;
var deleteType = null;

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

// Gestionnaire global pour les erreurs d'authentification
function handleAuthenticationError() {
    console.error("Erreur d'authentification (401). Redirection vers la page de login...");
    window.location.href = "/admin/login"; // URL en minuscules pour cohérence
}

// Intercepter toutes les requêtes AJAX pour gérer les erreurs d'authentification
$(document).ajaxError(function(event, jqXHR, ajaxSettings, thrownError) {
    if (jqXHR.status === 401) {
        // Erreur d'authentification 401 Unauthorized
        handleAuthenticationError();
    }
});

// Intercepter les requêtes fetch via une fonction wrapper
const originalFetch = window.fetch;
window.fetch = function(input, init) {
    return originalFetch(input, init).then(response => {
        if (response.status === 401) {
            // Erreur d'authentification 401 Unauthorized
            handleAuthenticationError();
            throw new Error('Authentication error');
        }
        return response;
    });
};

$(document).ready(function() {
    console.log("Document prêt - Initialisation de l'interface admin");
    
    // Initialiser les gestionnaires de fichiers
    setTimeout(() => {
        initFileHandlers();
    }, 300); // Attendre que le DOM soit complètement chargé

    // Initialisation
    initTabs();
    loadComponents();
    loadApiKeys();
    
    // Gestionnaire modal de confirmation de suppression
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
});