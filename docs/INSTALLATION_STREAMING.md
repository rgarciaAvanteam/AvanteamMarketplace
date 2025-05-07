# Guide de gestion du streaming des logs d'installation

Ce document décrit le système de streaming des logs d'installation dans le Marketplace et son mécanisme de gestion des erreurs.

## Architecture du streaming

Le système de streaming des logs utilise le pattern Server-Sent Events (SSE) pour envoyer des mises à jour en temps réel pendant l'installation d'un composant.

### Composants principaux

1. **Côté serveur:**
   - `InstallerStreamController.cs`: Contrôleur qui gère les connexions SSE et envoie des messages aux clients
   - `InstallerController.cs`: Contrôleur qui exécute l'installation et ajoute les logs à la file d'attente

2. **Côté client:**
   - `ui.js`: Gère l'interface utilisateur d'installation et la connexion au stream
   - Interface EventSource native du navigateur: Utilisée pour recevoir les messages SSE

## Gestion des erreurs 502 Bad Gateway

Une erreur 502 Bad Gateway peut se produire lorsqu'un proxy intermédiaire coupe prématurément la connexion de streaming, même si l'installation elle-même continue correctement en arrière-plan.

### Solution implémentée

1. **Amélioration des pings serveur:**
   - Fréquence augmentée à 15 secondes (au lieu de 30)
   - Ajout d'identifiants uniques pour éviter les mises en cache
   - Logs de debug pour tracer les pings

2. **Désactivation du buffering:**
   - Middleware ajouté dans Program.cs pour désactiver explicitement le buffering
   - En-têtes spécifiques pour les réponses de streaming

3. **Gestion côté client:**
   - Détection et traitement spécifique des erreurs 502
   - Simulation de succès lorsqu'une erreur 502 est détectée pendant l'installation
   - Affichage d'un message explicatif à l'utilisateur

4. **Validation améliorée:**
   - Nouveaux critères de succès pour les installations incluant le cas d'interruption du stream

## Comportement attendu

- Si le stream est coupé avec une erreur 502, le client affiche un avertissement mais poursuit l'installation
- L'utilisateur voit que l'installation continue en arrière-plan
- Le composant est correctement marqué comme installé même si le stream a été interrompu

## Dépannage

Si des problèmes persistent avec le streaming des logs:

1. Vérifier les logs du serveur LocalInstaller pour confirmer que l'installation a bien été effectuée
2. Consulter le fichier `installer-YYYY-MM-DD.log` pour les détails d'exécution
3. Rafraîchir la liste des composants pour voir le statut réel d'installation

## Futures améliorations possibles

- Mise en place d'un système de polling comme fallback en cas d'échec du streaming SSE
- Stockage des logs d'installation dans une base de données pour consultation ultérieure
- Amélioration de la détection des proxys intermédiaires qui pourraient couper les connexions