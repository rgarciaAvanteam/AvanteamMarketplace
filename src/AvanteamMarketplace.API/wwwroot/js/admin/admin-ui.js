// admin-ui.js
// Fonctions UI communes pour l'interface d'administration

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

/**
 * Affiche une notification à l'utilisateur
 * @param {string} message - Message à afficher
 * @param {string} type - Type de notification (success, error, info, warning)
 * @param {number} duration - Durée d'affichage en ms (par défaut 5000ms)
 */
function showNotification(message, type = "info", duration = 5000) {
    // Supprimer les notifications existantes
    $(".admin-notification").remove();
    
    // Créer la notification
    const notification = $(`<div class="admin-notification ${type}">
        <div class="notification-icon">
            ${type === "success" ? '<i class="fas fa-check-circle"></i>' : ''}
            ${type === "error" ? '<i class="fas fa-exclamation-circle"></i>' : ''}
            ${type === "info" ? '<i class="fas fa-info-circle"></i>' : ''}
            ${type === "warning" ? '<i class="fas fa-exclamation-triangle"></i>' : ''}
        </div>
        <div class="notification-content">
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close"><i class="fas fa-times"></i></button>
    </div>`);
    
    // Ajouter au DOM
    $("body").append(notification);
    
    // Animation d'entrée
    setTimeout(() => notification.addClass("show"), 10);
    
    // Gestionnaire pour fermer la notification
    notification.find(".notification-close").click(function() {
        notification.removeClass("show");
        setTimeout(() => notification.remove(), 300);
    });
    
    // Disparaître automatiquement après la durée spécifiée
    if (duration > 0) {
        setTimeout(() => {
            notification.removeClass("show");
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
    
    return notification;
}