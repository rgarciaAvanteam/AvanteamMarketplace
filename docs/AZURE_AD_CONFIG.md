# Configuration de l'authentification Azure AD pour AvanteamMarketplace

Ce document explique comment configurer l'authentification Azure AD pour le module AvanteamMarketplace, ce qui permettra aux utilisateurs Avanteam d'accéder aux fonctions d'installation et de désinstallation des composants.

## 1. Créer l'application dans Azure Portal

1. Connectez-vous au [portail Azure](https://portal.azure.com)
2. Accédez à "Azure Active Directory" dans le menu de gauche
3. Allez dans "Inscriptions d'applications" > "Nouvelle inscription"
4. Remplissez les informations suivantes :
   - **Nom** : AvanteamMarketplace
   - **Types de comptes pris en charge** : Comptes dans cet annuaire organisationnel uniquement (Avanteam uniquement - Locataire unique)
   - **URI de redirection** : Web > `https://votre-domaine-marketplace-api.com/auth/callback`

5. Cliquez sur "Inscrire"
6. Après la création, notez l'**ID d'application (client)** - il s'agit du ClientId à utiliser
7. Accédez à "Certificats et secrets" dans le menu de gauche
8. Cliquez sur "Nouveau secret client"
9. Donnez un nom au secret et choisissez une durée d'expiration
10. Cliquez sur "Ajouter" et **copiez immédiatement la valeur du secret** - c'est votre ClientSecret
11. Accédez à "Autorisations API" et cliquez sur "Ajouter une autorisation"
12. Sélectionnez "Microsoft Graph" puis "Autorisations déléguées"
13. Ajoutez au minimum ces autorisations :
    - `User.Read` (pour lire les informations de base de l'utilisateur)
    - `email` (pour accéder à l'adresse e-mail)
    - `profile` (pour accéder au profil)
14. Cliquez sur "Ajouter des autorisations"

## 2. Générer une clé secrète pour la signature des tokens

1. Exécutez le script `generate-marketplace-auth-key.ps1` pour générer une clé secrète aléatoire :
   ```powershell
   .\generate-marketplace-auth-key.ps1
   ```
2. Notez la clé générée, vous en aurez besoin pour l'étape suivante.

## 3. Mettre à jour les secrets dans appsettings.json

1. Utilisez le script `update-secrets.ps1` pour mettre à jour les secrets dans appsettings.json :
   ```powershell
   .\update-secrets.ps1 -AzureAdClientSecret "votre-client-secret" -MarketplaceAuthSecretKey "clé-jwt-générée" -MarketplaceAdminKey "clé-admin-marketplace"
   ```

2. Alternativement, vous pouvez mettre à jour manuellement les valeurs dans appsettings.json :
   - `AzureAd.ClientSecret` : Le secret client généré dans Azure AD
   - `MarketplaceAuth.SecretKey` : La clé secrète générée pour la signature des tokens JWT
   - `ApiKeys.AdminKey` : La clé admin utilisée pour les opérations d'administration

## 4. Configuration des URLs de redirection

Assurez-vous que les URLs suivantes sont correctement configurées :

1. Dans Azure AD Portal:
   - L'URI de redirection doit pointer vers : `https://votre-domaine-marketplace-api.com/auth/callback`

2. Dans le code client:
   - L'URL de l'API dans le fichier de configuration doit être correcte
   - Les URLs CORS doivent être correctement configurées dans appsettings.json pour autoriser les domaines des clients

## 5. Tester l'authentification

1. Déployez les modifications sur votre environnement
2. Ouvrez un client PSTUDIO et naviguez vers le module Marketplace
3. Vérifiez que :
   - Tous les utilisateurs peuvent voir les composants
   - Seuls les utilisateurs Avanteam authentifiés peuvent installer/désinstaller des composants
   - Le bouton de connexion apparaît correctement pour les utilisateurs non authentifiés
   - L'authentification réussit en redirigeant vers Azure AD puis revient à l'application

## Notes importantes

- Le secret client Azure AD expirera selon la durée que vous avez choisie (6 mois, 12 mois, etc.)
- Prévoyez un processus de renouvellement du secret avant son expiration
- La clé de signature des tokens JWT n'expire pas automatiquement, mais il est recommandé de la changer périodiquement
- Assurez-vous que tous les serveurs dans un environnement de haute disponibilité utilisent la même clé de signature