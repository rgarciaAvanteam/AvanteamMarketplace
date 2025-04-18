/**
 * marketplace-auth.js - Gestion de l'authentification via l'API Marketplace
 * Intégration avec Azure AD pour sécuriser les opérations sensibles
 */

const MarketplaceAuth = (function() {
    // État d'authentification
    let state = {
        isAuthenticated: false,
        isAvanteamAdmin: false,
        token: null,
        userInfo: null
    };
    
    // Configuration
    const config = {
        apiUrl: "", // Sera défini lors de l'initialisation
        callbackUrl: ""
    };
    
    /**
     * Détermine l'URL de callback en se basant sur le chemin de la page actuelle
     * Pour gérer les différentes structures d'URL des clients (avec ou sans préfixe comme /APP/)
     */
    function determineCallbackUrl() {
        // Récupérer le chemin actuel
        const currentPath = window.location.pathname;
        console.log("Chemin actuel:", currentPath);
        
        // Méthode 1: Rechercher exactement le motif "Custom/MarketPlace"
        const marketplacePattern = /^(.*?)(Custom\/MarketPlace)/i;
        const match = currentPath.match(marketplacePattern);
        
        if (match && match[1]) {
            // Le groupe 1 contient le préfixe (exemple: "/app/")
            const prefix = match[1];
            // Construire l'URL complète
            config.callbackUrl = window.location.origin + prefix + "Custom/MarketPlace/auth-callback.html";
            console.log("URL de callback déterminée via regex: " + config.callbackUrl);
        } else {
            // Méthode 2: Analyse du chemin pour extraire la partie avant "Custom/MarketPlace"
            const pathParts = currentPath.toLowerCase().split("custom/marketplace");
            if (pathParts.length > 1) {
                const prefix = pathParts[0];
                config.callbackUrl = window.location.origin + prefix + "Custom/MarketPlace/auth-callback.html";
                console.log("URL de callback déterminée via split: " + config.callbackUrl);
            } else {
                // Fallback au cas où la structure est différente
                console.log("Impossible de déterminer le préfixe, utilisation de l'URL par défaut");
                config.callbackUrl = window.location.origin + "/Custom/MarketPlace/auth-callback.html";
            }
        }
        
        // Log pour débogage
        console.log("URL de callback finale: " + config.callbackUrl);
    }
    
    // Références DOM
    let loginButton;
    let domInitialized = false;
    
    /**
     * Initialise le module d'authentification
     * @param {string} apiUrl - URL de l'API Marketplace
     */
    function init(apiUrl) {
        config.apiUrl = apiUrl;
        
        // Déterminer l'URL de callback en fonction du contexte actuel
        determineCallbackUrl();
        
        console.log("Initialisation du module d'authentification");
        console.log("URL API:", apiUrl);
        console.log("URL Callback:", config.callbackUrl);
        
        // Vérifier si déjà authentifié via sessionStorage
        const token = sessionStorage.getItem("marketplaceAuthToken");
        if (token) {
            state.token = token;
            console.log("Token trouvé en session, validation...");
            
            // Valider le token auprès de l'API
            validateToken(token).then(result => {
                if (result.isValid) {
                    state.isAuthenticated = true;
                    state.isAvanteamAdmin = result.isAdmin;
                    state.userInfo = {
                        name: result.name,
                        email: result.email,
                        userId: result.userId
                    };
                    
                    console.log("Token valide. Admin:", result.isAdmin);
                    
                    // Mettre à jour l'interface
                    updateUI();
                } else {
                    console.log("Token invalide, suppression");
                    // Token invalide, le supprimer
                    sessionStorage.removeItem("marketplaceAuthToken");
                }
            });
        }
        
        // Ajouter le bouton de connexion
        addLoginButton();
        
        // Écouter les messages de la fenêtre de callback
        window.addEventListener("message", (event) => {
            console.log("Message reçu:", event.data);
            
            if (event.data.type === "AUTH_SUCCESS") {
                console.log("Authentification réussie");
                state.token = event.data.token;
                
                validateToken(state.token).then(result => {
                    if (result.isValid) {
                        state.isAuthenticated = true;
                        state.isAvanteamAdmin = result.isAdmin;
                        state.userInfo = {
                            name: result.name,
                            email: result.email,
                            userId: result.userId
                        };
                        
                        console.log("Token validé avec succès. Admin:", result.isAdmin);
                        showNotification("Authentification réussie", "success");
                        updateUI();
                    } else {
                        console.log("Token invalidé par l'API");
                        showNotification("Échec de validation du token", "error");
                    }
                });
            } else if (event.data.type === "AUTH_ERROR") {
                console.log("Erreur d'authentification:", event.data.error);
                showNotification(event.data.message || "Échec de l'authentification", "error");
            }
        });
        
        domInitialized = true;
    }
    
    /**
     * Valide le token auprès de l'API
     * @param {string} token - Le token à valider
     * @returns {Promise<Object>} Résultat de la validation
     */
    async function validateToken(token) {
        try {
            console.log("Validation du token...");
            const response = await fetch(`${config.apiUrl.replace(/\/api\/marketplace$/, "")}/api/auth/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });
            
            if (!response.ok) {
                console.error("Erreur de validation:", response.status);
                return { isValid: false };
            }
            
            const result = await response.json();
            console.log("Résultat de validation:", result);
            return result;
        } catch (error) {
            console.error("Erreur lors de la validation du token:", error);
            return { isValid: false };
        }
    }
    
    /**
     * Ajoute un bouton de connexion à l'interface
     */
    function addLoginButton() {
        if (!domInitialized && document.readyState !== 'complete') {
            // Réessayer quand le DOM sera prêt
            window.addEventListener('DOMContentLoaded', addLoginButton);
            return;
        }
        
        // Vérifier si le bouton existe déjà
        if (document.querySelector('.auth-button')) {
            return;
        }
        
        console.log("Ajout du bouton de connexion");
        
        // Créer le style CSS
        const style = document.createElement("style");
        style.textContent = `
            .auth-button {
                background-color: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 50%;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                margin-left: 10px;
                transition: all 0.2s;
            }
            .auth-button:hover {
                background-color: #e9ecef;
            }
            .auth-button.authenticated {
                background-color: #28a745;
                color: white;
                border-color: #28a745;
            }
            .auth-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .auth-modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
            }
            .auth-modal-content {
                position: relative;
                background-color: white;
                padding: 20px;
                border-radius: 5px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                max-width: 400px;
                width: 90%;
            }
            .auth-modal-buttons {
                display: flex;
                justify-content: flex-end;
                margin-top: 20px;
                gap: 10px;
            }
            .active-filter-count {
                position: absolute;
                top: -5px;
                right: -5px;
                background-color: #dc3545;
                color: white;
                border-radius: 50%;
                width: 18px;
                height: 18px;
                font-size: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
        `;
        document.head.appendChild(style);
        
        // Créer le bouton
        loginButton = document.createElement("button");
        loginButton.className = "auth-button";
        loginButton.innerHTML = '<i class="fas fa-user-lock"></i>';
        loginButton.title = "Connexion administrateur Avanteam";
        
        // Ajouter au DOM (à côté de la barre de recherche)
        const searchContainer = document.querySelector(".marketplace-search");
        if (searchContainer) {
            searchContainer.parentNode.insertBefore(loginButton, searchContainer.nextSibling);
        } else {
            // Fallback
            const tabs = document.querySelector(".marketplace-tabs");
            if (tabs) {
                tabs.appendChild(loginButton);
            }
        }
        
        // Gestionnaire d'événement
        loginButton.addEventListener("click", handleLoginButtonClick);
        
        // Mettre à jour l'état du bouton
        updateUI();
    }
    
    /**
     * Gère le clic sur le bouton de connexion
     */
    function handleLoginButtonClick() {
        if (state.isAuthenticated) {
            // Déjà connecté, proposer de se déconnecter
            const modal = document.createElement("div");
            modal.className = "auth-modal";
            modal.innerHTML = `
                <div class="auth-modal-backdrop"></div>
                <div class="auth-modal-content">
                    <h3>Profil utilisateur</h3>
                    ${state.userInfo ? `
                        <p><strong>Nom:</strong> ${state.userInfo.name}</p>
                        <p><strong>Email:</strong> ${state.userInfo.email}</p>
                        <p><strong>Rôle:</strong> ${state.isAvanteamAdmin ? 'Administrateur' : 'Utilisateur'}</p>
                    ` : ''}
                    <div class="auth-modal-buttons">
                        <button class="btn btn-secondary auth-modal-cancel">Fermer</button>
                        <button class="btn btn-danger auth-modal-logout">Se déconnecter</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            modal.querySelector(".auth-modal-cancel").addEventListener("click", () => {
                document.body.removeChild(modal);
            });
            
            modal.querySelector(".auth-modal-logout").addEventListener("click", () => {
                document.body.removeChild(modal);
                logout();
            });
            
            modal.querySelector(".auth-modal-backdrop").addEventListener("click", () => {
                document.body.removeChild(modal);
            });
        } else {
            // Non connecté, lancer l'authentification
            login();
        }
    }
    
    /**
     * Déclenche le processus de connexion
     */
    function login() {
        console.log("Démarrage de l'authentification...");
        
        // Ouvrir une popup pour l'authentification
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        
        const authUrl = `${config.apiUrl.replace(/\/api\/marketplace$/, "")}/api/auth/login?redirectUri=${encodeURIComponent(config.callbackUrl)}`;
        console.log("URL d'authentification:", authUrl);
        
        const authWindow = window.open(
            authUrl,
            "marketplace_auth",
            `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
        );
        
        // Vérifier si la fenêtre a été bloquée
        if (!authWindow || authWindow.closed || typeof authWindow.closed == 'undefined') {
            console.error("Fenêtre de connexion bloquée par le navigateur");
            showNotification("Fenêtre de connexion bloquée par le navigateur. Veuillez autoriser les popups pour ce site.", "error");
        }
    }
    
    /**
     * Déconnexion
     */
    function logout() {
        console.log("Déconnexion...");
        state.isAuthenticated = false;
        state.isAvanteamAdmin = false;
        state.token = null;
        state.userInfo = null;
        
        // Supprimer de la session
        sessionStorage.removeItem("marketplaceAuthToken");
        
        // Mettre à jour l'interface
        updateUI();
        
        showNotification("Déconnexion réussie", "success");
    }
    
    /**
     * Met à jour l'interface en fonction de l'état d'authentification
     */
    function updateUI() {
        if (!domInitialized) return;
        
        console.log("Mise à jour de l'interface. Authentifié:", state.isAuthenticated);
        
        // Mettre à jour le bouton de connexion
        if (loginButton) {
            if (state.isAuthenticated) {
                loginButton.classList.add("authenticated");
                loginButton.innerHTML = '<i class="fas fa-user-check"></i>';
                loginButton.title = state.isAvanteamAdmin ? 
                    "Connecté en tant qu'administrateur Avanteam" : 
                    "Connecté, mais sans droits d'administration";
            } else {
                loginButton.classList.remove("authenticated");
                loginButton.innerHTML = '<i class="fas fa-user-lock"></i>';
                loginButton.title = "Connexion administrateur Avanteam";
            }
        }
        
        // Mettre à jour les boutons d'installation/désinstallation
        updateActionButtons();
    }
    
    /**
     * Met à jour les boutons d'action en fonction de l'état d'authentification
     */
    function updateActionButtons() {
        if (!domInitialized) return;
        
        console.log("Mise à jour des boutons d'action. Admin:", state.isAvanteamAdmin);
        
        // Sélectionner tous les boutons d'installation/désinstallation
        const installButtons = document.querySelectorAll(".btn-install");
        const uninstallButtons = document.querySelectorAll(".btn-uninstall");
        const updateButtons = document.querySelectorAll(".btn-update");
        
        // Fonction pour mettre à jour un bouton
        const updateButton = (button) => {
            if (!state.isAuthenticated || !state.isAvanteamAdmin) {
                // Désactiver visuellement le bouton
                button.classList.add("btn-disabled");
                button.setAttribute("disabled-auth", "true");
                button.removeAttribute("disabled"); // Pour pouvoir intercepter le clic
                
                // Stocker l'action originale
                if (!button.hasAttribute("original-onclick")) {
                    button.setAttribute("original-onclick", button.getAttribute("onclick"));
                    button.removeAttribute("onclick");
                    
                    // Ajouter un gestionnaire pour intercepter le clic
                    button.addEventListener("click", showAuthPrompt);
                }
            } else {
                // Réactiver le bouton
                button.classList.remove("btn-disabled");
                button.removeAttribute("disabled-auth");
                
                // Restaurer l'action originale
                if (button.hasAttribute("original-onclick")) {
                    button.setAttribute("onclick", button.getAttribute("original-onclick"));
                    button.removeAttribute("original-onclick");
                    button.removeEventListener("click", showAuthPrompt);
                }
            }
        };
        
        // Appliquer les mises à jour
        installButtons.forEach(updateButton);
        uninstallButtons.forEach(updateButton);
        updateButtons.forEach(updateButton);
    }
    
    /**
     * Affiche une invite d'authentification lorsqu'un utilisateur non authentifié
     * tente d'utiliser une fonctionnalité restreinte
     */
    function showAuthPrompt(event) {
        event.preventDefault();
        
        console.log("Affichage de l'invite d'authentification");
        
        // Créer une modale pour informer l'utilisateur
        const modal = document.createElement("div");
        modal.className = "auth-modal";
        modal.innerHTML = `
            <div class="auth-modal-backdrop"></div>
            <div class="auth-modal-content">
                <h3>Authentification requise</h3>
                <p>L'installation et la désinstallation de composants sont réservées aux administrateurs Avanteam.</p>
                <p>Veuillez vous connecter avec votre compte Avanteam pour continuer.</p>
                <div class="auth-modal-buttons">
                    <button class="btn btn-secondary auth-modal-cancel">Annuler</button>
                    <button class="btn btn-primary auth-modal-login">Se connecter</button>
                </div>
            </div>
        `;
        
        // Ajouter au DOM
        document.body.appendChild(modal);
        
        // Gestionnaires d'événements
        modal.querySelector(".auth-modal-cancel").addEventListener("click", () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector(".auth-modal-login").addEventListener("click", () => {
            document.body.removeChild(modal);
            login();
        });
        
        modal.querySelector(".auth-modal-backdrop").addEventListener("click", () => {
            document.body.removeChild(modal);
        });
    }
    
    /**
     * Affiche une notification temporaire
     * @param {string} message - Message à afficher
     * @param {string} type - Type de notification (success, error, info)
     */
    function showNotification(message, type = "info") {
        // Vérifier si la notification existe déjà
        let notification = document.querySelector('.auth-notification');
        if (notification) {
            document.body.removeChild(notification);
        }
        
        // Créer la notification
        notification = document.createElement('div');
        notification.className = `auth-notification ${type}`;
        notification.textContent = message;
        
        // Ajouter le style
        const style = document.createElement('style');
        style.textContent = `
            .auth-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 10px 15px;
                border-radius: 4px;
                color: white;
                z-index: 9999;
                animation: slideIn 0.3s ease-out, fadeOut 0.5s ease-in 2.5s forwards;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            }
            .auth-notification.success {
                background-color: #28a745;
            }
            .auth-notification.error {
                background-color: #dc3545;
            }
            .auth-notification.info {
                background-color: #17a2b8;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        // Ajouter au DOM
        document.body.appendChild(notification);
        
        // Supprimer après 3 secondes
        setTimeout(() => {
            if (notification && notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
    
    /**
     * Obtient le token pour les appels API
     * @returns {string|null} Le token ou null si non authentifié
     */
    function getToken() {
        return state.token;
    }
    
    /**
     * Vérifie si l'utilisateur courant est un administrateur Avanteam
     * @returns {boolean} true si l'utilisateur est un administrateur
     */
    function isAvanteamAdmin() {
        return state.isAvanteamAdmin;
    }
    
    // API publique
    return {
        init: init,
        login: login,
        logout: logout,
        getToken: getToken,
        isAvanteamAdmin: isAvanteamAdmin,
        showNotification: showNotification
    };
})();