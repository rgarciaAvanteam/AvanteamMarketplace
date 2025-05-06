# Avanteam Marketplace

Le Marketplace Avanteam est une plateforme centralisée pour la distribution et la gestion des composants pour Process Studio. Il permet aux clients de découvrir, télécharger et installer des composants supplémentaires pour étendre les fonctionnalités de leur plateforme Process Studio.

## Architecture

Le système est composé de deux parties principales :

1. **Client-side Integration** : Un module intégré à Process Studio permettant aux utilisateurs de parcourir et installer des composants directement depuis l'interface d'administration.

2. **Server-side API** : Une API REST centrale qui gère le catalogue de composants, les téléchargements, les mises à jour et l'authentification.

## Fonctionnalités principales

### Pour les utilisateurs
- Découverte et recherche de composants disponibles
- Filtrage par catégorie et compatibilité
- Affichage des composants compatibles avec la version actuelle
- Installation en un clic avec gestion des dépendances
- Mises à jour automatiques
- Visualisation de la documentation (README)

### Pour les administrateurs
- Gestion du catalogue de composants
- Ajout, mise à jour et suppression de composants
- Intégration avec GitHub pour automatiser la publication
- Gestion des clés API
- Statistiques d'installation et de téléchargement

## Déploiement

### Prérequis
- Process Studio 22.0 ou supérieur
- SQL Server 2016 ou supérieur
- .NET 6.0 SDK et Runtime
- .NET Core Hosting Bundle pour IIS
- Windows Server avec IIS installé
- Accès Internet pour les téléchargements de composants
- Token GitHub Personnel (PAT) pour l'intégration GitHub (optionnel)

### Installation de l'API

1. Utilisez le script de déploiement automatisé PowerShell pour installer l'API sur IIS:

```powershell
# Déploiement avec authentification SQL Server
.\DeployApiToIIS.ps1 -PhysicalPath "C:\inetpub\wwwroot\marketplace-dev" `
                    -SqlServer "SQL-SERVER\INSTANCE,1433" `
                    -SqlDatabase "AvanteamMarketplace" `
                    -SqlUser "votre_login_sql" `
                    -SqlPassword "votre_mot_de_passe" `
                    -GithubPAT "votre_token_github"

# Déploiement en mode Debug (pour développement)
.\DeployApiToIIS.ps1 -PhysicalPath "C:\inetpub\wwwroot\marketplace-dev" `
                    -SqlServer "SQL-SERVER\INSTANCE,1433" `
                    -SqlDatabase "AvanteamMarketplace" `
                    -SqlUser "votre_login_sql" `
                    -SqlPassword "votre_mot_de_passe" `
                    -UseDebugConfig
```

Le script va:
- Compiler et publier l'API
- Configurer IIS (pool d'applications, site web, liaisons)
- Configurer la base de données et appliquer les migrations automatiquement
- Générer une clé d'administration
- Configurer HTTPS et les certificats (si spécifiés)

2. Ou déployez manuellement l'API:

```bash
# Compiler l'application
dotnet publish -c Release -o publish

# Exécuter les migrations
dotnet ef database update

# Installer sur IIS via Web Deploy ou copie manuelle
```

### Installation du client

1. Utilisez le script de déploiement automatisé PowerShell pour installer le client:

```powershell
# Déploiement du client
.\DeployClientModule.ps1 -TargetPath "C:\ProcessStudio\Custom" `
                        -ApiUrl "https://marketplace-dev.avanteam-online.com/api/marketplace"
```

2. Ou installez manuellement le client:
   - Copiez le dossier `AvanteamMarketplace` dans le répertoire `Custom` de Process Studio
   - Générez une clé API avec le script `generate-api-key.ps1`
   - Configurez le fichier Web.config avec l'URL de l'API et la clé générée
   - Redémarrez Process Studio

```powershell
# Générer une clé API manuellement
.\scripts\generate-api-key.ps1 -WebConfigPath "C:\ProcessStudio\Custom\AvanteamMarketplace\Web.config"
```

3. Enregistrez la clé API générée dans la base de données du Marketplace via l'API d'administration
4. Vous pouvez désormais accéder au Marketplace depuis Process Studio

## Développement

### Structure du projet

- `src/AvanteamMarketplace.API` : API REST pour le marketplace
- `src/AvanteamMarketplace.Core` : Modèles et interfaces du domaine
- `src/AvanteamMarketplace.Infrastructure` : Implémentations des services et accès aux données
- `AvanteamMarketplace/` : Client-side Integration pour Process Studio

### Technologies utilisées

- **Backend** : ASP.NET Core 6.0, Entity Framework Core
- **Frontend** : ASP.NET WebForms, JavaScript, CSS
- **Database** : SQL Server
- **Authentication** : Custom API Key Authentication

### Développement local

1. Clonez le dépôt
2. Assurez-vous d'avoir .NET 6.0 SDK installé
3. Restaurez les packages NuGet
4. Configurez une base de données SQL Server locale
5. Mettez à jour la chaîne de connexion dans appsettings.json
6. Exécutez les migrations pour créer la base de données
7. Démarrez l'API

```bash
# Restaurer les packages
dotnet restore

# Créer une migration initiale (si nécessaire)
dotnet ef migrations add InitialCreate --project src/AvanteamMarketplace.Infrastructure --startup-project src/AvanteamMarketplace.API

# Mettre à jour la base de données
dotnet ef database update --project src/AvanteamMarketplace.Infrastructure --startup-project src/AvanteamMarketplace.API

# Démarrer l'API
dotnet run --project src/AvanteamMarketplace.API
```

### Configuration du GitHub PAT (Personal Access Token)

Pour utiliser l'intégration GitHub:

1. Créez un token d'accès personnel (PAT) sur GitHub:
   - Connectez-vous à votre compte GitHub
   - Accédez à Paramètres > Paramètres développeur > Personal access tokens
   - Générez un nouveau token avec les autorisations suivantes:
     - `repo` (accès complet au dépôt)
     - `read:packages` (lecture des packages)

2. Configurez le token dans appsettings.json:
   ```json
   "GitHub": {
     "Owner": "votre-organisation",
     "PersonalAccessToken": "votre-token-github",
     "ComponentsRepository": "components",
     "ApiEndpoint": "https://api.github.com"
   }
   ```

## Publication de composants

Pour publier un composant dans le marketplace, créez un dépôt GitHub avec la structure suivante :

```
component-name/
├── manifest.json       # Métadonnées du composant
├── README.md           # Documentation
├── install.ps1         # Script d'installation personnalisé (facultatif)
└── src/                # Code source du composant
```

Le fichier `manifest.json` doit contenir les informations suivantes :

```json
{
  "name": "component-name",
  "displayName": "Component Display Name",
  "description": "Description of the component",
  "version": "1.0.0",
  "category": "Category",
  "author": "Author",
  "minPlatformVersion": "23.0",
  "requiresRestart": false,
  "installation": {
    "targetPath": "Components/component-name"
  }
}
```

## Sécurité

### Authentification

Le marketplace utilise une authentification par clé API pour garantir que seuls les clients autorisés peuvent accéder aux composants:

- Les clés API sont générées et associées à des identifiants clients uniques
- Une clé d'administration est générée lors de l'installation initiale
- Les clés sont transmises via l'en-tête HTTP `Authorization: Bearer {API_KEY}`
- Les administrateurs peuvent générer des clés avec des droits d'administration pour la gestion des composants

### Configuration sécurisée

Pour assurer la sécurité du déploiement:

1. Remplacez la clé d'administration par défaut en production:
   ```json
   "ApiKeys": {
     "AdminKey": "votre-clé-admin-sécurisée"
   }
   ```

2. Utilisez HTTPS pour toutes les communications
3. Limitez les origines CORS aux domaines de vos clients:
   ```json
   "Cors": {
     "AllowedOrigins": [
       "https://*.votre-domaine.com"
     ]
   }
   ```

4. Stockez les secrets (tokens GitHub, clés API) de manière sécurisée:
   - En développement: User Secrets
   - En production: Variables d'environnement ou Azure Key Vault

## Résolution des problèmes courants

### Erreur HTTP 500.30 - ASP.NET Core app failed to start

1. Vérifiez les logs dans le dossier `logs` de l'application
2. Assurez-vous que le .NET Core Hosting Bundle est installé
3. Vérifiez que la configuration de la base de données est correcte
4. Vérifiez que l'application est configurée pour s'exécuter en mode out-of-process dans IIS:
   ```xml
   <aspNetCore processPath="dotnet" arguments=".\AvanteamMarketplace.API.dll" stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout" hostingModel="outofprocess">
   ```
5. Appliquez les migrations manuellement si nécessaire:
   ```bash
   dotnet ef database update --project src/AvanteamMarketplace.Infrastructure --startup-project src/AvanteamMarketplace.API
   ```

### Erreur de connexion à SQL Server

Si vous rencontrez des problèmes de connexion à SQL Server:

1. Utilisez le mode out-of-process dans le fichier web.config (crucial pour résoudre les problèmes de contexte de sécurité)
2. Testez la connectivité réseau entre le serveur IIS et SQL Server:
   ```powershell
   Test-NetConnection -ComputerName votre-serveur-sql -Port 1433
   ```
3. Essayez de spécifier explicitement le protocole TCP dans la chaîne de connexion:
   ```
   Server=tcp:votre-serveur-sql,1433;Database=...
   ```

### Erreur HTTP Error 502.5 - ANCM Out-Of-Process Startup Failure

Si vous rencontrez cette erreur après avoir configuré le mode out-of-process:

1. Vérifiez que le .NET Core Hosting Bundle est installé:
   ```powershell
   # Téléchargez-le depuis: https://dotnet.microsoft.com/download/dotnet/6.0/runtime (section Hosting Bundle)
   # Installez-le manuellement
   ```

2. Vérifiez le runtime .NET Core:
   ```powershell
   dotnet --list-runtimes
   # Assurez-vous que "Microsoft.AspNetCore.App 6.x" est présent
   ```

3. Accordez des permissions supplémentaires au groupe IIS_IUSRS:
   ```powershell
   $acl = Get-Acl "C:\chemin\vers\application"
   $rule = New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\IIS_IUSRS", "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
   $acl.SetAccessRule($rule)
   $acl | Set-Acl "C:\chemin\vers\application"
   ```

4. Vérifiez les logs de démarrage:
   ```powershell
   Get-Content -Path "C:\chemin\vers\application\logs\stdout*.log"
   ```

### Erreur d'accès à la base de données

1. Vérifiez la chaîne de connexion dans appsettings.json
2. Assurez-vous que l'utilisateur SQL a les droits nécessaires
3. Vérifiez que la base de données existe et que les tables ont été créées

### Erreur d'intégration GitHub

1. Vérifiez que le token GitHub est valide et a les autorisations nécessaires
2. Assurez-vous que le dépôt spécifié existe et est accessible
3. Vérifiez les paramètres GitHub dans appsettings.json

## Licence

Ce projet est soumis à la licence Avanteam.

---

© 2025 Avanteam. Tous droits réservés.