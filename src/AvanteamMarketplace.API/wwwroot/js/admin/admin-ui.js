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