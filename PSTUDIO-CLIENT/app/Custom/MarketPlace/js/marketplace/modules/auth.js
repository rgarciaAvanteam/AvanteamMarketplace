/**
 * auth.js - Module d'authentification du Marketplace
 * 
 * Gère l'authentification des utilisateurs, la vérification des tokens,
 * et les autorisations d'accès aux fonctionnalités d'administration.
 */

MarketplaceMediator.defineModule('auth', ['config', 'utils'], function(config, utils) {
    // État de l'authentification
    let authState = {
        isAuthenticated: false,
        isAdmin: false,
        token: null,
        user: null,
        tokenExpiration: null
    };
    
    /**
     * Initialise le module d'authentification
     */
    function init() {
        console.log("Initialisation du module d'authentification");
        
        // Extraire l'URL de callback basée sur l'URL actuelle
        const callbackUrl = determineCallbackUrl();
        
        // Extraire le token d'authentification de l'URL ou de la session
        checkForAuthToken();
        
        // Restaurer l'état d'authentification depuis le stockage
        restoreAuthState();
        
        // Vérifier si un token existe déjà en session (maintenant restoreAuthState l'a déjà fait)
        // On ne refait pas utils.getFromStorage pour éviter une double lecture
        if (authState.token) {
            console.log("Token trouvé en état, validation...");
            
            // Logs de débogage pour comprendre l'état actuel
            console.log("État d'authentification actuel:", {
                isAuthenticated: authState.isAuthenticated,
                isAdmin: authState.isAdmin,
                tokenPresent: !!authState.token,
                userInfo: authState.user
            });
            
            // Valider le token pour s'assurer qu'il est toujours valide
            validateToken(authState.token);
        } else {
            // Vérifier une dernière fois dans localStorage
            const token = utils.getFromStorage('marketplace_auth_token', null);
            
            if (token) {
                console.log("Token trouvé dans localStorage, validation...");
                validateToken(token);
            } else {
                console.log("Aucun token trouvé, état par défaut");
                updateAuthState({
                    isAuthenticated: false,
                    isAdmin: false,
                    token: null,
                    user: null,
                    tokenExpiration: null
                });
            }
        }
        
        // Ajouter le bouton de connexion/déconnexion
        addAuthButton();
        
        // Publier un événement indiquant que l'authentification est initialisée
        MarketplaceMediator.publish('authInitialized', { 
            isAuthenticated: authState.isAuthenticated,
            isAdmin: authState.isAdmin 
        });
    }
    
    /**
     * Restaure l'état d'authentification depuis le stockage
     */
    function restoreAuthState() {
        try {
            // Essayer de récupérer le token depuis plusieurs sources
            // 1. Essayer d'abord dans localStorage (pour persistance entre sessions)
            let token = utils.getFromStorage('marketplace_auth_token', null);
            
            // 2. Si non trouvé, essayer dans sessionStorage (pour compatibilité avec l'ancien code)
            if (!token) {
                try { 
                    token = sessionStorage.getItem("marketplaceAuthToken");
                    console.log("Token trouvé dans sessionStorage:", token ? "présent" : "absent");
                    
                    // Si trouvé dans sessionStorage mais pas dans localStorage, migrer vers localStorage
                    if (token) {
                        utils.saveToStorage('marketplace_auth_token', token);
                        console.log("Token migré de sessionStorage vers localStorage");
                    }
                } catch (sessionError) {
                    console.warn("Erreur lors de l'accès à sessionStorage:", sessionError);
                }
            } else {
                console.log("Token trouvé dans localStorage");
            }
            
            // Récupérer les autres informations d'authentification
            const isAdmin = utils.getFromStorage('marketplace_auth_is_admin', false);
            const userName = utils.getFromStorage('marketplace_auth_user_name', '');
            const userEmail = utils.getFromStorage('marketplace_auth_user_email', '');
            const userId = utils.getFromStorage('marketplace_auth_user_id', '');
            
            // Si un token est présent, restaurer l'état
            if (token) {
                console.log("Restauration de l'état d'authentification depuis le stockage");
                console.log("Token présent, isAdmin:", isAdmin);
                
                // Restaurer l'état d'authentification
                authState = {
                    isAuthenticated: true,
                    isAdmin: isAdmin === true || isAdmin === "true", // Assurer une conversion correcte bool/string
                    token: token,
                    user: {
                        id: userId,
                        name: userName,
                        email: userEmail
                    },
                    tokenExpiration: calculateTokenExpiration(token)
                };
                
                // Vérifier et logger le statut d'admin
                if (authState.isAdmin) {
                    console.log("Utilisateur restauré avec droits administrateur");
                } else {
                    console.warn("Utilisateur restauré SANS droits administrateur");
                }
            } else {
                console.log("Aucun token trouvé dans le stockage, état par défaut");
            }
        } catch (e) {
            console.error("Erreur lors de la restauration de l'état d'authentification:", e);
        }
    }
    
    /**
     * Détermine l'URL de callback pour l'authentification
     * @returns {string} - URL de callback
     */
    function determineCallbackUrl() {
        const currentPath = window.location.pathname;
        console.log("Chemin actuel:", currentPath);
        
        // Tenter de déterminer le chemin de base du marketplace en préservant tous les préfixes potentiels
        let basePath = '';
        
        // 1. Essai avec regex pour capturer tous les segments jusqu'à Custom/MarketPlace/
        // Cette expression régulière capture tout le début du chemin, y compris les préfixes comme /APP/
        const marketplaceRegex = /(^.*?\/[Cc]ustom\/[Mm]arket[Pp]lace\/)/i;
        const match = currentPath.match(marketplaceRegex);
        
        if (match && match[1]) {
            basePath = match[1];
            console.log("Chemin de base trouvé via regex principale:", basePath);
        } else {
            // 2. Essai avec une méthode de split plus précise
            const pathSegments = currentPath.toLowerCase().split('/');
            let customIndex = -1;
            let marketplaceIndex = -1;
            
            // Trouver les indices des segments 'custom' et 'marketplace'
            for (let i = 0; i < pathSegments.length; i++) {
                if (pathSegments[i] === 'custom') {
                    customIndex = i;
                } else if (customIndex !== -1 && pathSegments[i] === 'marketplace') {
                    marketplaceIndex = i;
                    break;
                }
            }
            
            if (customIndex !== -1) {
                // Reconstruire le chemin en préservant la casse d'origine
                const originalSegments = currentPath.split('/');
                // Prendre tous les segments jusqu'à marketplace inclus
                const endIndex = (marketplaceIndex !== -1) ? marketplaceIndex + 1 : customIndex + 1;
                basePath = '/' + originalSegments.slice(1, endIndex).join('/') + '/';
                console.log("Chemin de base trouvé via analyse de segments:", basePath);
            } else {
                // 3. Fallback: utiliser le chemin actuel jusqu'au dernier /
                basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
                console.log("Chemin de base fallback:", basePath);
            }
        }
        
        // Assurer que le chemin commence par un / et se termine par un /
        if (!basePath.startsWith('/')) {
            basePath = '/' + basePath;
        }
        
        if (!basePath.endsWith('/')) {
            basePath = basePath + '/';
        }
        
        // Supprimer les doubles slashes potentiels (//), sauf pour http:// ou https://
        basePath = basePath.replace(/([^:])\/+/g, '$1/');
        
        // Construire l'URL de callback
        const callbackUrl = window.location.origin + basePath + 'auth-callback.html';
        console.log("URL de callback finale:", callbackUrl);
        
        // Construire aussi l'URL de retour après authentification
        const returnUrl = window.location.origin + basePath + 'Default.aspx';
        console.log("URL de retour après authentification:", returnUrl);
        
        // Sauvegarder les URLs
        utils.saveToStorage('marketplace_auth_callback', callbackUrl);
        utils.saveToStorage('marketplace_auth_return', returnUrl);
        
        return callbackUrl;
    }
    
    /**
     * Vérifie si un token d'authentification est présent dans l'URL
     */
    function checkForAuthToken() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (token) {
            console.log("Token trouvé dans l'URL");
            validateToken(token);
            
            // Nettoyer l'URL
            const url = new URL(window.location);
            url.searchParams.delete('token');
            window.history.replaceState({}, document.title, url.toString());
        }
    }
    
    /**
     * Valide un token d'authentification
     * @param {string} token - Token à valider
     */
    function validateToken(token) {
        console.log("Validation du token...");
        
        const apiUrl = config.getApiUrl();
        
        if (!apiUrl) {
            console.error("URL API non configurée, impossible de valider le token");
            return;
        }
        
        // Corriger l'URL en remplaçant /api/marketplace/auth par /api/auth
        let correctedApiUrl = apiUrl;
        if (apiUrl.endsWith('/api/marketplace')) {
            correctedApiUrl = apiUrl.replace('/api/marketplace', '');
            console.log("URL API de validation corrigée:", correctedApiUrl);
        }
        
        fetch(`${correctedApiUrl}/api/auth/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ token })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erreur ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(result => {
            console.log("Résultat de validation:", result);
            
            if (result.isValid) {
                // Sauvegarder le token
                utils.saveToStorage('marketplace_auth_token', token);
                
                // Sauvegarder également les informations d'admin explicitement
                utils.saveToStorage('marketplace_auth_is_admin', result.isAdmin);
                utils.saveToStorage('marketplace_auth_user_name', result.name);
                utils.saveToStorage('marketplace_auth_user_email', result.email);
                utils.saveToStorage('marketplace_auth_user_id', result.userId);
                
                // Mise à jour de l'état d'authentification
                updateAuthState({
                    isAuthenticated: true,
                    isAdmin: result.isAdmin,
                    token: token,
                    user: {
                        id: result.userId,
                        name: result.name,
                        email: result.email
                    },
                    tokenExpiration: calculateTokenExpiration(token)
                });
                
                console.log(`Token valide. Admin: ${result.isAdmin}`);
                
                // Message de debug pour confirmer l'état d'autorisation
                if (result.isAdmin) {
                    console.log("Utilisateur authentifié avec droits administrateur");
                } else {
                    console.warn("Utilisateur authentifié SANS droits administrateur");
                }
            } else {
                handleInvalidToken("Token invalide ou expiré");
            }
        })
        .catch(error => {
            console.error("Erreur lors de la validation du token:", error);
            handleInvalidToken("Erreur de validation du token");
        });
    }
    
    /**
     * Calcule la date d'expiration d'un token JWT
     * @param {string} token - Token JWT
     * @returns {Date|null} - Date d'expiration ou null si impossible à déterminer
     */
    function calculateTokenExpiration(token) {
        try {
            // Extraire le payload (deuxième partie du token)
            const payload = token.split('.')[1];
            const decodedPayload = JSON.parse(atob(payload));
            
            // Vérifier si une date d'expiration est présente
            if (decodedPayload.exp) {
                return new Date(decodedPayload.exp * 1000);
            }
            
            // Date d'expiration par défaut (24h)
            return new Date(Date.now() + 24 * 60 * 60 * 1000);
        } catch (error) {
            console.error("Erreur lors du calcul de l'expiration du token:", error);
            return null;
        }
    }
    
    /**
     * Gère le cas d'un token invalide
     * @param {string} reason - Raison de l'invalidité
     */
    function handleInvalidToken(reason) {
        console.log(`Token invalide: ${reason}`);
        
        // Supprimer le token de la session
        utils.saveToStorage('marketplace_auth_token', null);
        
        // Mise à jour de l'état d'authentification
        updateAuthState({
            isAuthenticated: false,
            isAdmin: false,
            token: null,
            user: null,
            tokenExpiration: null
        });
    }
    
    /**
     * Met à jour l'état d'authentification
     * @param {Object} newState - Nouvel état
     */
    function updateAuthState(newState) {
        // Effectuer les conversions de type nécessaires (bool/string)
        if (newState.isAdmin !== undefined) {
            newState.isAdmin = newState.isAdmin === true || newState.isAdmin === "true";
        }
        
        // Log pour le debugging
        console.log("Mise à jour de l'état d'authentification:", {
            currentState: {
                isAuthenticated: authState.isAuthenticated,
                isAdmin: authState.isAdmin,
                tokenPresent: !!authState.token
            },
            newState: {
                isAuthenticated: newState.isAuthenticated,
                isAdmin: newState.isAdmin,
                tokenPresent: !!newState.token
            }
        });
        
        // Mise à jour de l'état local
        authState = { ...authState, ...newState };
        
        // Sauvegarder les valeurs clés dans localStorage
        if (newState.token !== undefined) {
            utils.saveToStorage('marketplace_auth_token', newState.token);
        }
        
        if (newState.isAdmin !== undefined) {
            utils.saveToStorage('marketplace_auth_is_admin', newState.isAdmin);
        }
        
        if (newState.user) {
            if (newState.user.name) utils.saveToStorage('marketplace_auth_user_name', newState.user.name);
            if (newState.user.email) utils.saveToStorage('marketplace_auth_user_email', newState.user.email);
            if (newState.user.id) utils.saveToStorage('marketplace_auth_user_id', newState.user.id);
        }
        
        // Mise à jour de l'interface
        updateUI();
        
        // Publier un événement pour informer les autres modules
        MarketplaceMediator.publish('authStateChanged', { ...authState });
    }
    
    /**
     * Met à jour l'interface utilisateur selon l'état d'authentification
     */
    function updateUI() {
        console.log(`Mise à jour de l'interface. Authentifié: ${authState.isAuthenticated}`);
        
        // Mettre à jour l'état du bouton d'authentification
        updateAuthButtonState();
        
        // Mise à jour des boutons d'action (admin)
        updateActionButtons();
    }
    
    /**
     * Met à jour l'état du bouton d'authentification
     */
    function updateAuthButtonState() {
        // Vérifier si le nouveau bouton existe
        const authButton = document.querySelector('.auth-button');
        if (authButton) {
            if (authState.isAuthenticated) {
                authButton.classList.add('authenticated');
                authButton.innerHTML = '<i class="fas fa-user-check"></i>';
                authButton.title = authState.isAdmin ? 
                    "Connecté en tant qu'administrateur Avanteam" : 
                    "Connecté, mais sans droits d'administration";
            } else {
                authButton.classList.remove('authenticated');
                authButton.innerHTML = '<i class="fas fa-user-lock"></i>';
                authButton.title = "Connexion administrateur Avanteam";
            }
        }
        
        // Gestion de rétrocompatibilité avec l'ancien bouton
        const marketplaceAuthButton = document.querySelector('.marketplace-auth-button');
        if (marketplaceAuthButton) {
            if (authState.isAuthenticated) {
                marketplaceAuthButton.textContent = `Déconnexion (${authState.user ? authState.user.name : 'Utilisateur'})`;
                marketplaceAuthButton.classList.add('authenticated');
                marketplaceAuthButton.onclick = handleAuthButtonClick;
            } else {
                marketplaceAuthButton.textContent = 'Connexion Administrateur';
                marketplaceAuthButton.classList.remove('authenticated');
                marketplaceAuthButton.onclick = handleAuthButtonClick;
            }
        }
    }
    
    /**
     * Gère le clic sur le bouton d'authentification
     * @param {Event} event - L'événement de clic
     */
    function handleAuthButtonClick(event) {
        // Empêcher le comportement par défaut pour éviter tout postback
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (authState.isAuthenticated) {
            // Déjà connecté, proposer de se déconnecter
            const modal = document.createElement("div");
            modal.className = "auth-modal";
            modal.innerHTML = `
                <div class="auth-modal-backdrop"></div>
                <div class="auth-modal-content">
                    <h3>Profil utilisateur</h3>
                    ${authState.user ? `
                        <p><strong>Nom:</strong> ${authState.user.name}</p>
                        <p><strong>Email:</strong> ${authState.user.email}</p>
                        <p><strong>Rôle:</strong> ${authState.isAdmin ? 'Administrateur' : 'Utilisateur'}</p>
                    ` : ''}
                    <div class="auth-modal-buttons">
                        <button type="button" class="btn btn-secondary auth-modal-cancel">Fermer</button>
                        <button type="button" class="btn btn-danger auth-modal-logout">Se déconnecter</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            modal.querySelector(".auth-modal-cancel").addEventListener("click", (e) => {
                e.preventDefault();
                document.body.removeChild(modal);
            });
            
            modal.querySelector(".auth-modal-logout").addEventListener("click", (e) => {
                e.preventDefault();
                document.body.removeChild(modal);
                logout();
            });
            
            modal.querySelector(".auth-modal-backdrop").addEventListener("click", (e) => {
                e.preventDefault();
                document.body.removeChild(modal);
            });
        } else {
            // Non connecté, lancer l'authentification
            login();
        }
    }
    
    /**
     * Met à jour les boutons d'action selon les droits d'admin
     */
    function updateActionButtons() {
        console.log(`Mise à jour des boutons d'action. Admin: ${authState.isAdmin}`);
        
        // Affiche ou masque les boutons réservés aux administrateurs
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => {
            el.style.display = authState.isAdmin ? '' : 'none';
        });
    }
    
    /**
     * Ajoute le bouton d'authentification à l'interface
     */
    function addAuthButton() {
        console.log("Ajout du bouton de connexion");
        
        // Vérifier si le bouton existe déjà
        if (document.querySelector('.auth-button') || document.querySelector('.marketplace-auth-button')) {
            // Si le bouton existe, seulement mettre à jour son état
            updateAuthButtonState();
            return;
        }
        
        // Créer le bouton avec le style de l'ancien code
        const loginButton = document.createElement("button");
        loginButton.className = "auth-button";
        loginButton.type = "button"; // Spécifier le type pour éviter les soumissions de formulaire
        loginButton.innerHTML = authState.isAuthenticated ? 
            '<i class="fas fa-user-check"></i>' : 
            '<i class="fas fa-user-lock"></i>';
        loginButton.title = authState.isAuthenticated ? 
            (authState.isAdmin ? "Connecté en tant qu'administrateur Avanteam" : "Connecté, mais sans droits d'administration") : 
            "Connexion administrateur Avanteam";
        
        if (authState.isAuthenticated) {
            loginButton.classList.add('authenticated');
        }
        
        // Créer un conteneur pour le bouton en bas à droite
        const loginButtonContainer = document.createElement("div");
        loginButtonContainer.className = "login-button-container";
        
        // Ajouter le bouton au conteneur
        loginButtonContainer.appendChild(loginButton);
        
        // Ajouter le conteneur au body
        document.body.appendChild(loginButtonContainer);
        
        // Gestionnaire d'événement pour montrer le menu de profil/déconnexion
        loginButton.addEventListener("click", handleAuthButtonClick);
    }
    
    /**
     * Affiche un message de notification
     * @param {string} message - Message à afficher
     * @param {string} type - Type de notification (info, success, warning, error)
     */
    function showNotification(message, type = 'info') {
        // Vérifier si la div de notification existe déjà
        let notification = document.getElementById('marketplace-notification');
        
        if (!notification) {
            // Créer la div de notification
            notification = document.createElement('div');
            notification.id = 'marketplace-notification';
            notification.className = 'marketplace-notification';
            document.body.appendChild(notification);
        }
        
        // Définir le type de notification
        notification.className = `marketplace-notification ${type}`;
        
        // Définir le message
        notification.textContent = message;
        
        // Afficher la notification
        notification.style.display = 'block';
        
        // Masquer après 5 secondes
        setTimeout(() => {
            notification.style.display = 'none';
        }, 5000);
    }
    
    /**
     * Démarre le processus de connexion
     */
    function login() {
        const apiUrl = config.getApiUrl();
        const callbackUrl = utils.getFromStorage('marketplace_auth_callback', window.location.href);
        
        if (!apiUrl) {
            showNotification("URL API non configurée, impossible de se connecter", "error");
            return;
        }
        
        console.log("URL API:", apiUrl);
        console.log("URL Callback:", callbackUrl);
        
        // Construction de l'URL d'authentification
        // Corriger l'URL en remplaçant /api/marketplace/auth par /api/auth
        let correctedApiUrl = apiUrl;
        if (apiUrl.endsWith('/api/marketplace')) {
            correctedApiUrl = apiUrl.replace('/api/marketplace', '');
            console.log("URL API corrigée:", correctedApiUrl);
        }
        
        const authUrl = `${correctedApiUrl}/api/auth/login?redirectUri=${encodeURIComponent(callbackUrl)}`;
        console.log("URL d'authentification finale:", authUrl);
        
        // Montrer une notification pour informer l'utilisateur
        showNotification("Ouverture de la fenêtre d'authentification...", "info");
        
        // Ouvrir une popup pour l'authentification, avec des dimensions adaptées à l'écran
        const width = Math.min(600, window.innerWidth * 0.9);
        const height = Math.min(700, window.innerHeight * 0.9);
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        
        // Ouvrir la fenêtre d'authentification au centre de l'écran
        const authWindow = window.open(
            authUrl,
            "marketplace_auth",
            `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
        );
        
        // Vérifier si la fenêtre a été bloquée
        if (!authWindow || authWindow.closed || typeof authWindow.closed == 'undefined') {
            console.error("Fenêtre de connexion bloquée par le navigateur");
            showNotification("Fenêtre de connexion bloquée. Veuillez autoriser les popups pour ce site.", "error");
        } else {
            // Si possible, donner le focus à la fenêtre d'authentification
            try {
                authWindow.focus();
            } catch (e) {
                console.log("Impossible de donner le focus à la fenêtre d'authentification:", e);
            }
            
            // Configurer la capture du message de retour
            window.addEventListener("message", function authMessageListener(event) {
                console.log("Message reçu:", event.data);
                
                // Vérifier le type de message
                if (event.data && event.data.type === "AUTH_SUCCESS") {
                    // Retirer l'écouteur d'événements pour éviter les duplications
                    window.removeEventListener("message", authMessageListener);
                    
                    console.log("Authentification réussie, token reçu:", event.data.token);
                    validateToken(event.data.token);
                    
                    // Fermer la fenêtre d'authentification si elle est encore ouverte
                    if (authWindow && !authWindow.closed) {
                        authWindow.close();
                    }
                } else if (event.data && event.data.type === "AUTH_ERROR") {
                    // Retirer l'écouteur d'événements pour éviter les duplications
                    window.removeEventListener("message", authMessageListener);
                    
                    console.error("Erreur d'authentification:", event.data.error);
                    showNotification("Échec de l'authentification: " + (event.data.message || "Erreur inconnue"), "error");
                    
                    // Fermer la fenêtre d'authentification si elle est encore ouverte
                    if (authWindow && !authWindow.closed) {
                        authWindow.close();
                    }
                }
            });
        }
    }
    
    /**
     * Déconnecte l'utilisateur
     */
    function logout() {
        // Supprimer toutes les informations d'authentification de la session
        utils.saveToStorage('marketplace_auth_token', null);
        utils.saveToStorage('marketplace_auth_is_admin', null);
        utils.saveToStorage('marketplace_auth_user_name', null);
        utils.saveToStorage('marketplace_auth_user_email', null);
        utils.saveToStorage('marketplace_auth_user_id', null);
        
        // Mise à jour de l'état d'authentification
        updateAuthState({
            isAuthenticated: false,
            isAdmin: false,
            token: null,
            user: null,
            tokenExpiration: null
        });
        
        console.log("Déconnexion effectuée - toutes les informations d'authentification ont été effacées");
        
        // Afficher une notification
        showNotification("Vous avez été déconnecté avec succès", "info");
    }
    
    /**
     * Vérifie si l'utilisateur est authentifié
     * @returns {boolean} - true si authentifié, false sinon
     */
    function isAuthenticated() {
        return authState.isAuthenticated;
    }
    
    /**
     * Vérifie si l'utilisateur est administrateur
     * @returns {boolean} - true si admin, false sinon
     */
    function isAdmin() {
        return authState.isAdmin;
    }
    
    /**
     * Obtient le token d'authentification
     * @returns {string|null} - Token ou null si non authentifié
     */
    function getToken() {
        return authState.token;
    }
    
    /**
     * Obtient les informations de l'utilisateur
     * @returns {Object|null} - Informations utilisateur ou null si non authentifié
     */
    function getUserInfo() {
        return authState.user;
    }
    
    // API publique
    return {
        init,
        login,
        logout,
        isAuthenticated,
        isAdmin,
        getToken,
        getUserInfo,
        showNotification
    };
});