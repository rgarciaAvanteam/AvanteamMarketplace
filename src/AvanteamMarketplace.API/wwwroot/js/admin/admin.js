// admin.js
// Point d'entrée principal pour l'interface d'administration du Marketplace
// Ce fichier charge tous les modules nécessaires dans le bon ordre

// Assurez-vous que les modules sont chargés dans le bon ordre de dépendance
document.write('<script src="../js/admin/admin-core.js"></script>');
document.write('<script src="../js/admin/admin-ui.js"></script>');
document.write('<script src="../js/admin/admin-file-handlers.js"></script>');
document.write('<script src="../js/admin/admin-components.js"></script>');
document.write('<script src="../js/admin/admin-versions.js"></script>');
document.write('<script src="../js/admin/admin-apikeys.js"></script>');
document.write('<script src="../js/admin/admin-github.js"></script>');


// Note: L'utilisation de document.write est uniquement pour la simplicité de ce refactoring
// Dans un environnement de production, vous pourriez utiliser un bundler comme Webpack 
// ou des modules ES pour gérer les dépendances.