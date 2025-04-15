// admin-github.js
// Synchronisation avec GitHub pour le Marketplace

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