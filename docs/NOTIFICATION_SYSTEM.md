# Système de notification du Marketplace

Ce document détaille le système de notification utilisé dans l'interface d'administration du Marketplace Avanteam. Ce système remplace les alertes JavaScript standard par des notifications modernes et stylisées.

## Table des matières

1. [Introduction](#introduction)
2. [Architecture technique](#architecture-technique)
3. [Types de notifications](#types-de-notifications)
4. [Utilisation dans le code](#utilisation-dans-le-code)
5. [Personnalisation](#personnalisation)
6. [Bonnes pratiques](#bonnes-pratiques)

## Introduction

Le système de notification offre un moyen élégant d'informer les utilisateurs des résultats d'actions, erreurs ou autres informations importantes. Contrairement aux alertes JavaScript standard qui bloquent l'interface et nécessitent une interaction, ces notifications:

- S'affichent dans un coin de l'écran sans interrompre le flux de travail
- Disparaissent automatiquement après un délai configurable
- Utilisent un code couleur et des icônes pour différencier les types de messages
- Peuvent afficher du contenu formaté plus riche qu'une simple alerte

## Architecture technique

Le système est composé de trois parties principales:

1. **Fonction JavaScript `showNotification`**: Crée et gère les notifications
2. **Styles CSS**: Définissent l'apparence et les animations des notifications
3. **Intégration dans les fonctions d'action**: Remplace les alertes par des appels à `showNotification`

### Fonction `showNotification`

```javascript
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
```

### Styles CSS

```css
/* Styles pour les notifications */
.admin-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 350px;
    background-color: white;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: stretch;
    z-index: 9999;
    opacity: 0;
    transform: translateY(-20px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    overflow: hidden;
}

.admin-notification.show {
    opacity: 1;
    transform: translateY(0);
}

.admin-notification .notification-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    color: white;
    flex-shrink: 0;
}

.admin-notification .notification-content {
    padding: 12px 16px;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.admin-notification .notification-message {
    font-size: 14px;
    line-height: 1.5;
}

.admin-notification .notification-close {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 12px;
    padding: 12px;
    color: #666;
    align-self: flex-start;
}

.admin-notification .notification-close:hover {
    color: #333;
}

/* Types de notifications */
.admin-notification.success {
    border-left: 4px solid #52c41a;
}

.admin-notification.success .notification-icon {
    background-color: #52c41a;
}

.admin-notification.error {
    border-left: 4px solid #f5222d;
}

.admin-notification.error .notification-icon {
    background-color: #f5222d;
}

.admin-notification.info {
    border-left: 4px solid #1890ff;
}

.admin-notification.info .notification-icon {
    background-color: #1890ff;
}

.admin-notification.warning {
    border-left: 4px solid #faad14;
}

.admin-notification.warning .notification-icon {
    background-color: #faad14;
}
```

## Types de notifications

Le système prend en charge quatre types de notifications, chacun avec son propre style visuel:

1. **Success** (`success`): Notifications vertes avec icône de coche, utilisées pour confirmer qu'une action a réussi
2. **Error** (`error`): Notifications rouges avec icône d'exclamation, utilisées pour indiquer une erreur
3. **Information** (`info`): Notifications bleues avec icône d'information, utilisées pour des messages informatifs
4. **Warning** (`warning`): Notifications orange avec icône de triangle d'avertissement, utilisées pour des avertissements

## Utilisation dans le code

### Afficher une notification simple

```javascript
// Notification de succès (disparaît après 5 secondes par défaut)
showNotification("Composant créé avec succès", "success");

// Notification d'erreur
showNotification("Impossible de créer le composant", "error");

// Notification d'information
showNotification("Chargement des données en cours...", "info");

// Notification d'avertissement
showNotification("Le composant sera visible après validation", "warning");
```

### Contrôler la durée d'affichage

```javascript
// Notification qui reste affichée jusqu'à ce que l'utilisateur la ferme (durée = 0)
showNotification("Cette information est importante", "info", 0);

// Notification qui disparaît rapidement (1.5 secondes)
showNotification("Action terminée", "success", 1500);
```

### Exemple d'utilisation pour la gestion d'erreur API

```javascript
$.ajax({
    url: "/api/components",
    type: "POST",
    data: formData,
    success: function(response) {
        showNotification("Composant créé avec succès", "success");
        // Actions supplémentaires...
    },
    error: function(xhr, status, error) {
        // Extraire le message d'erreur détaillé de la réponse
        let errorMessage = "Erreur lors de la création du composant";
        
        try {
            const response = JSON.parse(xhr.responseText);
            if (response && response.error) {
                errorMessage = response.error;
            }
        } catch (e) {
            console.error("Erreur lors du parsing de la réponse:", e);
        }
        
        // Afficher la notification d'erreur
        showNotification(errorMessage, "error");
    }
});
```

## Personnalisation

Le système de notification peut être personnalisé de plusieurs façons:

### Modifier la position des notifications

Par défaut, les notifications apparaissent en haut à droite de l'écran. Pour modifier cette position, ajustez les propriétés CSS `top` et `right` dans la classe `.admin-notification`.

```css
.admin-notification {
    /* Positionner en bas à droite */
    top: auto;
    bottom: 20px;
    right: 20px;
    
    /* Ou au centre en haut */
    top: 20px;
    right: auto;
    left: 50%;
    transform: translateX(-50%) translateY(-20px);
}

.admin-notification.show {
    transform: translateX(-50%) translateY(0);
}
```

### Ajouter du contenu personnalisé

La fonction `showNotification` peut être étendue pour prendre en charge des contenus plus riches, comme des actions ou des détails supplémentaires:

```javascript
function showNotificationWithAction(message, actionText, actionCallback, type = "info") {
    const notification = showNotification(message, type, 0); // Durée 0 pour ne pas disparaître automatiquement
    
    const actionButton = $(`<button class="notification-action">${actionText}</button>`);
    notification.find(".notification-content").append(actionButton);
    
    actionButton.click(function() {
        actionCallback();
        notification.find(".notification-close").click();
    });
    
    return notification;
}

// Utilisation
showNotificationWithAction(
    "Composant créé, voulez-vous ajouter une version?", 
    "Ajouter une version", 
    function() { openAddVersionModal(componentId); },
    "success"
);
```

## Bonnes pratiques

1. **Messages clairs et concis**: Les messages devraient être courts et directs
2. **Type approprié**: Utilisez le type qui correspond au contenu du message
   - `success` pour les actions réussies
   - `error` pour les erreurs et problèmes
   - `info` pour les informations neutres
   - `warning` pour les avertissements
3. **Durée appropriée**: Ajustez la durée en fonction de l'importance du message
   - Messages critiques: durée plus longue ou nécessitant une fermeture manuelle (durée = 0)
   - Messages informatifs simples: durée standard (5 secondes)
   - Confirmations rapides: durée courte (2-3 secondes)
4. **Éviter la surcharge**: N'affichez pas trop de notifications simultanément
5. **Messages utiles**: Incluez des informations utiles et actionnables, surtout pour les erreurs
6. **HTML sécurisé**: Si vous incluez du HTML dans les messages, assurez-vous qu'il est échappé correctement pour éviter les failles XSS

---

Ce système de notification améliore considérablement l'expérience utilisateur de l'interface d'administration du Marketplace en fournissant des retours contextuels élégants sans interrompre le flux de travail.