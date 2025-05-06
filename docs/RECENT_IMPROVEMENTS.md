# Améliorations récentes du Marketplace

Ce document répertorie et décrit les améliorations récentes apportées à l'Avanteam Marketplace.

## Améliorations de l'interface utilisateur

### Système de notification moderne (Mai 2025)

Un système de notification moderne a été implémenté pour remplacer les alertes JavaScript standard. Ces notifications offrent une meilleure expérience utilisateur avec:

- Apparition/disparition animée en douceur
- Style visuel distinct selon le type de message (succès, erreur, information, avertissement)
- Fermeture automatique après un délai configurable
- Possibilité de fermer manuellement via un bouton
- Affichage de messages formatés et détaillés

**Fichiers modifiés:**
- `admin-ui.js` - Ajout de la fonction `showNotification`
- `admin-components.js` - Remplacement des alertes par des appels à `showNotification`
- `admin.css` - Ajout des styles pour les notifications

**Utilisation:**
```javascript
// Affiche une notification de succès qui disparaît après 5 secondes
showNotification("Opération réussie", "success");

// Affiche une notification d'erreur qui reste visible jusqu'à ce que l'utilisateur la ferme
showNotification("Une erreur est survenue", "error", 0);

// Types disponibles: "success", "error", "info", "warning"
```

### Amélioration des messages d'erreur lors de la suppression de composants (Mai 2025)

Les messages d'erreur lors de tentatives de suppression de composants utilisés par des clients ont été améliorés pour:

- Afficher un message explicite indiquant pourquoi le composant ne peut pas être supprimé
- Lister les clients qui utilisent actuellement le composant
- Présenter l'information dans une notification stylisée plutôt qu'une alerte brute

**Fichiers modifiés:**
- `admin-components.js` - Amélioration du traitement des erreurs dans la fonction `deleteComponent`

**Avantage:**
Les administrateurs comprennent maintenant clairement pourquoi un composant ne peut pas être supprimé, sans avoir à interpréter des codes d'erreur techniques.

## Corrections de bugs

### Filtrage des messages React DevTools (Mai 2025)

Correction d'un problème où les messages de debugging de React DevTools s'affichaient de manière répétitive dans la console du navigateur.

**Fichiers modifiés:**
- `marketplace-auth.js` - Ajout d'une condition pour filtrer les messages provenant de 'react-devtools-content-script'

```javascript
// Ne pas logger les messages de React DevTools pour éviter de spammer la console
if (event.data.source !== 'react-devtools-content-script') {
    console.log("Message reçu:", event.data);
}
```

### Correction des scripts d'installation des composants (Mai 2025)

Correction d'un problème où les scripts d'installation des composants ne définissaient pas explicitement un code de sortie, ce qui provoquait des messages d'erreur trompeurs lors de l'installation.

**Fichiers modifiés:**
- `component-HishikawaDiagram/install.ps1`
- `component-ParetoDiagram/install.ps1`
- `component-template/install.ps1`

Ajout de l'instruction `exit 0` à la fin de chaque script pour signaler correctement que l'installation s'est terminée avec succès.

### Correction du script d'installation de StyleSheetFormAI2 (Mai 2025)

Correction d'incohérences dans les noms de fichiers CSS dans le script d'installation du composant StyleSheetFormAI2.

**Fichiers modifiés:**
- `component-StyleSheetFormAI2/install.ps1` - Correction des références de "StyleSheetAI.css" à "StyleSheetAI2.css"

## Évolutions à venir

- **Bouton de téléchargement de package**: Ajout d'un bouton permettant de télécharger le package d'une version depuis l'interface d'administration
- **Amélioration des URLs d'aide**: Correction de la construction des URL pour les fichiers d'aide des composants
- **Création automatisée de paquets ZIP**: Scripts pour générer automatiquement des fichiers ZIP pour les répertoires de composants