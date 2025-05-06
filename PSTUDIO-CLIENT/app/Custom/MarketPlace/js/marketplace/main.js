/**
 * main.js - Point d'entrée principal du Marketplace
 * 
 * Ce fichier est chargé en dernier et se charge d'initialiser
 * tous les modules du Marketplace dans le bon ordre.
 */

(function() {
    // Attendre que le DOM soit complètement chargé
    document.addEventListener('DOMContentLoaded', function() {
        console.log("🚀 Initialisation du Marketplace...");
        
        // Vérifier que le médiateur est disponible
        if (typeof MarketplaceMediator === 'undefined') {
            console.error("Le médiateur n'est pas disponible. Vérifiez que le fichier mediator.js est correctement chargé.");
            return;
        }
        
        // Initialiser la configuration
        const configModule = MarketplaceMediator.getModule('config');
        if (configModule) {
            configModule.init();
            
            // Vérifier que la version de la plateforme est bien définie
            const platformVersion = configModule.getPlatformVersion();
            if (!platformVersion || platformVersion.trim() === '') {
                console.error("ERREUR: Version de plateforme non définie après initialisation.");
                
                // Essayer de récupérer depuis les éléments HTML directement
                try {
                    const versionDisplays = [
                        document.querySelector('.marketplace-version .version-value'),
                        document.getElementById('hfPlatformVersion')
                    ];
                    
                    for (const display of versionDisplays) {
                        if (display && display.textContent && display.textContent.trim() !== '') {
                            const version = display.textContent.trim();
                            console.log(`Version trouvée dans le DOM: ${version}`);
                            configModule.set('platformVersion', version);
                            break;
                        }
                    }
                } catch (e) {
                    console.error("Erreur lors de la récupération de la version depuis le DOM:", e);
                }
                
                // Si toujours pas de version, utiliser une valeur par défaut
                if (!configModule.getPlatformVersion()) {
                    console.warn("Définition d'une version par défaut (23.10.0)");
                    configModule.set('platformVersion', '23.10.0');
                }
            } else {
                console.log(`Version de plateforme configurée: ${platformVersion}`);
            }
        } else {
            console.error("Module de configuration non disponible.");
            return;
        }
        
        // Initialiser le module d'authentification
        const authModule = MarketplaceMediator.getModule('auth');
        if (authModule) {
            authModule.init();
        } else {
            console.warn("Module d'authentification non disponible.");
        }
        
        // Initialiser le module de composants
        const componentsModule = MarketplaceMediator.getModule('components');
        if (componentsModule) {
            componentsModule.init();
        } else {
            console.error("Module de composants non disponible.");
            return;
        }
        
        // Initialiser le module de filtres
        const filtersModule = MarketplaceMediator.getModule('filters');
        if (filtersModule) {
            filtersModule.init();
        } else {
            console.warn("Module de filtres non disponible.");
        }
        
        // Initialiser le module d'interface utilisateur en dernier
        const uiModule = MarketplaceMediator.getModule('ui');
        if (uiModule) {
            uiModule.init();
        } else {
            console.error("Module d'interface utilisateur non disponible.");
            return;
        }
        
        // Ajouter des gestionnaires d'événements globaux
        window.addEventListener('error', function(event) {
            console.error("Erreur JavaScript globale:", event.error || event.message);
        });
        
        // Définir des fonctions globales minimales (wrapper vers les modules)
        // Ces fonctions sont les seules exposées globalement pour l'interaction externe
        window.MarketplaceApp = {
            refreshComponents: function() {
                const ui = MarketplaceMediator.getModule('ui');
                if (ui) {
                    ui.refreshAllComponents();
                }
            },
            showComponentDetails: function(componentId) {
                const ui = MarketplaceMediator.getModule('ui');
                if (ui) {
                    ui.showComponentDetails(componentId);
                }
            },
            login: function() {
                const auth = MarketplaceMediator.getModule('auth');
                if (auth) {
                    auth.login();
                }
            },
            logout: function() {
                const auth = MarketplaceMediator.getModule('auth');
                if (auth) {
                    auth.logout();
                }
            },
            showNotification: function(message, type) {
                const auth = MarketplaceMediator.getModule('auth');
                if (auth) {
                    auth.showNotification(message, type);
                }
            }
        };
        
        console.log("✅ Marketplace initialisé avec succès!");
    });
})();