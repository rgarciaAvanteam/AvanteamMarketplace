// admin-file-handlers.js
// Gestion des téléversements de fichiers

// Fonction pour initialiser les gestionnaires d'événements liés aux fichiers
function initFileHandlers() {
    console.log("Initialisation des gestionnaires de fichiers");

    // Remettre à zéro tous les gestionnaires d'événements existants
    $(".file-select-button").off('click');
    $("input[type='file']").off('change');

    // Assigner des nouveaux gestionnaires uniques pour chaque type d'input file
    initFileHandlerFor('fileVersionPackage', 'selectedVersionFileName');
    initFileHandlerFor('filePackage', 'selectedFileName');
    initFileHandlerFor('fileIcon', 'selectedIconName');

    console.log("Initialisation des gestionnaires de fichiers terminée");
}

function initFileHandlerFor(inputId, labelId) {
    const fileInput = document.getElementById(inputId);
    if (!fileInput) {
        console.error(`Élément d'entrée de fichier avec ID ${inputId} non trouvé`);
        return;
    }

    // Définir une fonction locale de gestionnaire pour ce fichier spécifique
    const handleFileChange = function (e) {
        // Ne pas empêcher le comportement par défaut - c'était la source du problème
        // Laisser l'événement se propager naturellement

        console.log(`Changement détecté dans ${inputId}`, new Date().getTime());

        // Capture les fichiers sélectionnés
        if (this.files && this.files.length > 0) {
            const fileName = this.files[0].name;
            console.log(`Fichier sélectionné: ${fileName}`);

            // Mettre à jour le texte avec le nom du fichier sélectionné
            const label = document.getElementById(labelId);
            if (label) {
                // Validation spécifique pour les icônes (doit être SVG)
                if (inputId === "fileIcon") {
                    const file = this.files[0];
                    if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
                        label.innerHTML = '<span style="color: #dc3545;"><i class="fas fa-exclamation-circle"></i> Format invalide. Utilisez un fichier SVG.</span>';
                        console.log(`Fichier icône invalide: ${file.name}, type: ${file.type}`);
                    } else {
                        label.innerHTML = '<i class="fas fa-check-circle" style="color: green; margin-right: 5px;"></i>' + fileName;
                        console.log(`Fichier icône valide: ${fileName}`);
                    }
                } else {
                    label.innerHTML = '<i class="fas fa-check-circle" style="color: green; margin-right: 5px;"></i>' + fileName;
                    console.log(`Label mis à jour: ${labelId}`);
                }
            } else {
                console.error(`Label avec ID ${labelId} non trouvé`);
            }

            // Vérifier si nous devons extraire une version du nom de fichier (pour le package)
            if (inputId === "filePackage" && fileName) {
                const versionMatch = fileName.match(/[-_](\d+\.\d+\.\d+)[-_\.]|[^a-zA-Z0-9](\d+\.\d+\.\d+)$/);
                if (versionMatch && (versionMatch[1] || versionMatch[2])) {
                    const version = versionMatch[1] || versionMatch[2];
                    const versionInput = $("#txtPackageVersion");
                    if (versionInput.length && versionInput.val() === "") {
                        versionInput.val(version);
                        console.log(`Version extraite et définie: ${version}`);
                    }
                }
            }

            // Maintenir le focus sur le bon modal
            let modalSelector = "";
            if (inputId === "filePackage") modalSelector = "#packageModal";
            else if (inputId === "fileIcon") modalSelector = "#iconModal";
            else if (inputId === "fileVersionPackage") modalSelector = "#versionModal";

            if (modalSelector) {
                $(modalSelector).focus();
                console.log(`Focus maintenu sur ${modalSelector}`);
            }
        } else {
            console.log(`Aucun fichier sélectionné pour ${inputId}`);
        }
    };

    // Utiliser une approche uniforme avec jQuery pour la gestion des événements
    $(fileInput).off('change').on('change', handleFileChange);

    // Configurer les boutons qui déclenchent la sélection de fichier
    const allButtons = $(`#${inputId}`).closest('.custom-file-upload').find('.file-select-button');

    if (allButtons.length) {
        allButtons.each(function () {
            $(this).off('click').on('click', function (e) {
                e.preventDefault();
                console.log(`Clic sur bouton pour ${inputId}`, new Date().getTime());

                // Utiliser une approche simplifiée et directe pour déclencher le clic
                // Sans multiples timeouts qui peuvent causer des problèmes
                $(`#${inputId}`).trigger('click');

                return false;
            });
        });
        console.log(`${allButtons.length} bouton(s) configuré(s) pour ${inputId}`);
    } else {
        console.warn(`Aucun bouton trouvé pour ${inputId}`);
    }
}