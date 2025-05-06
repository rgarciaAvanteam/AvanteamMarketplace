# Guide de l'interface d'administration du Marketplace

Ce document fournit des instructions détaillées sur l'utilisation de l'interface d'administration du Marketplace Avanteam.

## Table des matières

1. [Connexion à l'interface d'administration](#connexion-à-linterface-dadministration)
2. [Gestion des composants](#gestion-des-composants)
   - [Afficher les composants](#afficher-les-composants)
   - [Créer un nouveau composant](#créer-un-nouveau-composant)
   - [Modifier un composant](#modifier-un-composant)
   - [Supprimer un composant](#supprimer-un-composant)
   - [Gérer les versions d'un composant](#gérer-les-versions-dun-composant)
3. [Gestion des clés API](#gestion-des-clés-api)
   - [Afficher les clés API](#afficher-les-clés-api)
   - [Créer une nouvelle clé API](#créer-une-nouvelle-clé-api)
   - [Supprimer une clé API](#supprimer-une-clé-api)
4. [Interface utilisateur](#interface-utilisateur)
   - [Notifications](#notifications)
   - [Modalités (popups)](#modalités-popups)
   - [Tableaux et pagination](#tableaux-et-pagination)

## Connexion à l'interface d'administration

L'interface d'administration est sécurisée et nécessite une authentification:

1. Ouvrez l'URL de l'administration du Marketplace (généralement `/admin` ou une URL spécifique fournie par votre équipe technique)
2. Entrez vos identifiants administrateur Avanteam
3. Si l'authentification est réussie, vous serez redirigé vers l'interface d'administration

## Gestion des composants

### Afficher les composants

L'onglet "Composants" affiche la liste de tous les composants disponibles dans le Marketplace:

- Utilisez la barre de recherche pour filtrer les composants par nom, description ou catégorie
- Cliquez sur l'en-tête d'une colonne pour trier les composants
- Les boutons d'action à droite de chaque ligne permettent de gérer le composant

### Créer un nouveau composant

Pour ajouter un nouveau composant:

1. Cliquez sur le bouton "Ajouter un composant" dans l'onglet Composants
2. Remplissez le formulaire avec les informations du composant:
   - **Nom**: Identifiant unique (sans espaces, caractères spéciaux limités)
   - **Nom d'affichage**: Nom convivial affiché aux utilisateurs
   - **Description**: Description détaillée du composant
   - **Catégorie**: Catégorie à laquelle appartient le composant
   - **Auteur**: Auteur ou organisation responsable du composant
   - **Tags**: Mots-clés pour faciliter la recherche
   - **Version minimale de la plateforme**: Version minimale de Process Studio requise
   - **Version maximale de la plateforme**: Version maximale de Process Studio supportée
   - **URL du dépôt**: Lien vers le dépôt de code (GitHub, etc.)
3. Cliquez sur "Enregistrer" pour créer le composant

### Modifier un composant

Pour modifier un composant existant:

1. Cliquez sur le bouton d'édition (icône crayon) à côté du composant souhaité
2. Modifiez les informations dans le formulaire
3. Cliquez sur "Enregistrer" pour appliquer les modifications

### Supprimer un composant

Pour supprimer un composant:

1. Cliquez sur le bouton de suppression (icône corbeille) à côté du composant souhaité
2. Confirmez la suppression dans la boîte de dialogue qui apparaît

**Important**: Un composant ne peut pas être supprimé s'il est actuellement installé sur des installations clientes. Une notification d'erreur s'affichera, indiquant les clients qui utilisent encore ce composant.

### Gérer les versions d'un composant

Pour gérer les versions d'un composant:

1. Cliquez sur le bouton "Versions" à côté du composant souhaité
2. Le panneau des versions s'ouvre sur la droite, affichant toutes les versions du composant
3. Options disponibles:
   - **Ajouter une version**: Cliquez sur "Ajouter une version" et complétez le formulaire
   - **Modifier une version**: Cliquez sur l'icône de modification d'une version
   - **Supprimer une version**: Cliquez sur l'icône de suppression d'une version
   - **Définir comme version actuelle**: Cliquez sur l'icône "Définir comme actuelle"
   - **Télécharger le package**: Cliquez sur l'icône de téléchargement

## Gestion des clés API

### Afficher les clés API

L'onglet "Clés API" affiche toutes les clés API existantes:

- Le tableau montre la clé, la description, et la date de création
- Les boutons d'action permettent de gérer chaque clé

### Créer une nouvelle clé API

Pour créer une nouvelle clé API:

1. Cliquez sur le bouton "Générer une clé API"
2. Entrez une description pour identifier l'utilisation de cette clé
3. Cliquez sur "Générer" pour créer la clé

**Important**: La clé API complète n'est affichée qu'une seule fois lors de sa création. Copiez-la immédiatement et stockez-la de manière sécurisée.

### Supprimer une clé API

Pour supprimer une clé API:

1. Cliquez sur le bouton de suppression à côté de la clé souhaitée
2. Confirmez la suppression dans la boîte de dialogue qui apparaît

**Attention**: La suppression d'une clé API est définitive et révoquera immédiatement l'accès accordé à cette clé.

## Interface utilisateur

### Notifications

Le système de notification affiche des messages informatifs dans l'interface:

- **Notifications de succès** (vertes): Confirment qu'une action a été effectuée avec succès
- **Notifications d'erreur** (rouges): Indiquent qu'une action a échoué, avec des détails sur l'erreur
- **Notifications d'information** (bleues): Fournissent des informations générales
- **Notifications d'avertissement** (orange): Alertent sur des situations potentiellement problématiques

Les notifications disparaissent automatiquement après quelques secondes, ou peuvent être fermées manuellement en cliquant sur la croix.

### Modalités (popups)

Les modalités sont utilisées pour les formulaires et les confirmations:

- Pour fermer une modalité, cliquez sur la croix en haut à droite, ou en dehors de la modalité
- Les formulaires dans les modalités incluent généralement des boutons "Annuler" et "Enregistrer"

### Tableaux et pagination

Les tableaux d'administration offrent plusieurs fonctionnalités:

- **Tri**: Cliquez sur les en-têtes de colonnes pour trier les données
- **Recherche**: Utilisez la barre de recherche au-dessus du tableau pour filtrer les entrées
- **Pagination**: Utilisez les contrôles de pagination en bas du tableau pour naviguer entre les pages
- **Actions par ligne**: Chaque ligne contient des boutons d'action pour gérer l'élément correspondant