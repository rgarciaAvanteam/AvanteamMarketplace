/**
 * Avanteam Marketplace - Script client principal
 * Fichier principal qui charge tous les modules nécessaires
 */

// Assurez-vous que les modules sont chargés dans le bon ordre de dépendance
document.write('<script src="js/marketplace/marketplace-core.js"></script>');
document.write('<script src="js/marketplace/marketplace-ui.js"></script>');
document.write('<script src="js/marketplace/marketplace-components.js"></script>');
document.write('<script src="js/marketplace/marketplace-install.js"></script>');
document.write('<script src="js/marketplace/marketplace-uninstall.js"></script>');
document.write('<script src="js/marketplace/marketplace-filters.js"></script>');

// Note: L'utilisation de document.write est uniquement pour la simplicité de ce refactoring
// Dans un environnement de production, vous pourriez utiliser un bundler comme Webpack
// ou des modules ES pour gérer les dépendances.