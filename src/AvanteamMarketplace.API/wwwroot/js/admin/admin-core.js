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
    
    // Appliquer les restrictions d'accès au démarrage
    applyGlobalAccessRestrictions();
    
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

// ========== Gestion globale des restrictions d'accès ==========

// Fonction pour appliquer les restrictions globales selon le niveau d'accès
function applyGlobalAccessRestrictions() {
    // Vérifier le niveau d'accès de l'utilisateur connecté
    if (typeof adminAccessLevel === 'undefined') {
        console.warn('adminAccessLevel non défini, accès complet par défaut');
        return; // Accès complet par défaut
    }
    
    console.log('Application des restrictions globales pour le niveau:', adminAccessLevel);
    
    // Si l'utilisateur a un accès en lecture seule
    if (adminAccessLevel === 'read') {
        
        // Masquer tous les boutons d'actions de modification/suppression
        $(".action-btn-edit, .action-btn-delete, .action-btn-upload").hide();
        
        // Masquer les boutons principaux d'ajout
        $("#btnAddComponent, #btnAddApiKey, #btnAddVersion").hide();
        
        // Désactiver tous les formulaires de modification
        $("input[type='text'], input[type='url'], textarea, select").prop('readonly', true);
        $("input[type='checkbox']").prop('disabled', true);
        
        // Cacher les boutons de sauvegarde dans les modals
        $("#btnSaveComponent, #btnSaveApiKey, #btnSaveVersion, #btnUploadPackage").hide();
        
        // Modifier le titre de la page pour indiquer le mode lecture seule
        $("h1").append(' <small style="color: #6c757d;">(Mode lecture seule)</small>');
        
    } else if (adminAccessLevel === 'full') {
        // Tous les boutons restent visibles pour l'accès complet
        console.log('Accès complet - toutes les fonctionnalités globales disponibles');
    }
}