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

Pour publier un composant dans le marketplace, vous pouvez utiliser deux approches:

### 1. Publication directe via script PowerShell

Utilisez le script `publish-to-marketplace.ps1` pour publier directement un composant depuis son dépôt:

```powershell
# Depuis le dossier du composant
./publish-to-marketplace.ps1 -AdminToken "votre_token_admin" -ApiBaseUrl "https://marketplace-dev.avanteam-online.com"
```

Le script:
- Lit automatiquement le fichier manifest.json
- Normalise le nom technique pour respecter les contraintes de validation
- Publie le composant directement sur le Marketplace

### 2. Publication via l'intégration GitHub 

Créez un dépôt GitHub avec la structure suivante:

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
  "repository": "https://github.com/organisation/nom-du-repo",
  "iconUrl": "images/icon.svg",
  "tags": ["tag1", "tag2"],
  "requiresRestart": false,
  "installation": {
    "targetPath": "Components/component-name",
    "customActions": ["install.ps1"]
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

## Mises à jour récentes

### Avril 2025 - Interface d'administration améliorée

L'interface d'administration a été améliorée avec les fonctionnalités suivantes :

1. **Correction des problèmes d'API** :
   - Ajout de la propriété `MinPlatformVersion` au modèle `VersionViewModel`
   - Mise à jour des mappages dans `MarketplaceService` pour inclure correctement cette propriété

2. **Améliorations visuelles** :
   - Styles CSS ajoutés pour les boutons d'action dans le tableau des versions
   - Ajout d'un style pour le badge "Actuelle" indiquant la version active d'un composant
   - Amélioration des contrastes et de la visibilité des éléments interactifs

3. **Gestion des versions de composants** :
   - Mise en œuvre de la fonctionnalité complète de modification des versions
   - Correction de la fonction `editVersion` manquante
   - Amélioration de la gestion des états des boutons pour éviter les problèmes d'interface

4. **Stabilité et robustesse** :
   - Meilleure gestion des erreurs dans la manipulation des fichiers
   - Délai de sécurité ajouté pour garantir que le DOM est entièrement mis à jour
   - Amélioration de la détection des propriétés dans les réponses API

## Résolution des problèmes courants

### Erreur HTTP 500.30 - ASP.NET Core app failed to start

1. Vérifiez les logs dans le dossier `logs` de l'application
2. Assurez-vous que le .NET Core Hosting Bundle est installé
3. Vérifiez que la configuration de la base de données est correcte
4. **Utilisez le mode inprocess** qui a été testé et validé pour fonctionner:
   ```xml
   <aspNetCore processPath="dotnet" arguments=".\AvanteamMarketplace.API.dll" stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout" hostingModel="inprocess">
   ```
5. Appliquez les migrations manuellement si nécessaire:
   ```bash
   dotnet ef database update --project src/AvanteamMarketplace.Infrastructure --startup-project src/AvanteamMarketplace.API
   ```

### Erreur de connexion à SQL Server

Si vous rencontrez des problèmes de connexion à SQL Server:

1. **Utilisez la configuration qui a été testée et validée**:
   - Mode **inprocess** dans web.config
   - Double backslash dans la chaîne de connexion JSON pour les instances SQL
   - Paramètres TrustServerCertificate=True et Encrypt=False

2. Vérifiez que la chaîne de connexion est correctement formatée dans le JSON:
   ```json
   "ConnectionStrings": {
     "DefaultConnection": "Server=SERVEUR\\\\INSTANCE,1433;Database=AvanteamMarketplace;User ID=utilisateur;Password=motdepasse;MultipleActiveResultSets=true;TrustServerCertificate=True;Encrypt=False"
   }
   ```

3. Testez la connectivité réseau entre le serveur IIS et SQL Server:
   ```powershell
   Test-NetConnection -ComputerName votre-serveur-sql -Port 1433
   ```

4. Vérifiez que le serveur SQL accepte les connexions à distance dans la Configuration Manager:
   - Activez TCP/IP et Named Pipes
   - Vérifiez que le SQL Browser est en cours d'exécution

### Erreur HTTP Error 502.5 - ANCM Out-Of-Process Startup Failure

Si vous rencontrez des erreurs de démarrage de l'application:

1. **Utilisez le mode inprocess** au lieu du mode out-of-process:
   ```xml
   <aspNetCore processPath="dotnet" arguments=".\AvanteamMarketplace.API.dll" stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout" hostingModel="inprocess">
   ```

2. Vérifiez que le .NET Core Hosting Bundle est installé:
   ```powershell
   # Téléchargez-le depuis: https://dotnet.microsoft.com/download/dotnet/6.0/runtime (section Hosting Bundle)
   # Installez-le manuellement
   ```

3. Vérifiez le runtime .NET Core:
   ```powershell
   dotnet --list-runtimes
   # Assurez-vous que "Microsoft.AspNetCore.App 6.x" est présent
   ```

4. Accordez des permissions supplémentaires au groupe IIS_IUSRS et au pool d'applications:
   ```powershell
   $appPath = "C:\chemin\vers\application"
   $acl = Get-Acl $appPath
   
   # Permissions pour IIS_IUSRS
   $rule = New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\IIS_IUSRS", "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
   $acl.SetAccessRule($rule)
   
   # Permissions pour le pool d'applications
   $appPoolRule = New-Object System.Security.AccessControl.FileSystemAccessRule("IIS AppPool\NomDuPool", "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
   $acl.SetAccessRule($appPoolRule)
   
   $acl | Set-Acl $appPath
   ```

5. Vérifiez les logs de démarrage:
   ```powershell
   Get-Content -Path "C:\chemin\vers\application\logs\stdout*.log"
   ```

6. **Configuration qui a fonctionné**: 
   La combinaison qui a résolu tous les problèmes est:
   - Mode inprocess dans web.config
   - Double backslash dans la chaîne de connexion pour les instances SQL
   - Paramètres TrustServerCertificate=True et Encrypt=False dans la chaîne de connexion

### Erreur DirectoryNotFoundException avec chemins absolus

Si vous rencontrez une erreur du type:
```
DirectoryNotFoundException: I:\mnt\c\Avanteam\dev\DevRG\AvanteamMarketplace\src\AvanteamMarketplace.API\wwwroot\
Microsoft.Extensions.FileProviders.PhysicalFileProvider..ctor(string root, ExclusionFilters filters)
```

Ce problème est lié aux chemins absolus configurés pour votre environnement de développement qui n'existent pas sur le serveur de test. Voici les solutions:

1. **Solution immédiate sans recompilation**:
   - Créer les répertoires manquants sur le serveur:
     ```powershell
     mkdir -p I:\mnt\c\Avanteam\dev\DevRG\AvanteamMarketplace\src\AvanteamMarketplace.API\wwwroot
     ```
   - Ou créer un lien symbolique vers le dossier wwwroot déployé:
     ```powershell
     mklink /D "I:\mnt\c\Avanteam\dev\DevRG\AvanteamMarketplace\src\AvanteamMarketplace.API\wwwroot" "C:\inetpub\wwwroot\marketplace-dev\wwwroot"
     ```

2. **Modifier web.config pour utiliser des chemins relatifs**:
   ```xml
   <aspNetCore processPath="dotnet" arguments=".\AvanteamMarketplace.API.dll" stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout" hostingModel="inprocess">
     <environmentVariables>
       <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Production" />
       <environmentVariable name="DOTNET_USE_POLLING_FILE_WATCHER" value="true" />
     </environmentVariables>
   </aspNetCore>
   ```

3. **Solution permanente - Désactiver StaticWebAssets ou utiliser des chemins relatifs**:
   - Ajouter au fichier AvanteamMarketplace.API.csproj:
     ```xml
     <PropertyGroup>
       <StaticWebAssetsEnabled>false</StaticWebAssetsEnabled>
       <!-- Ou utiliser des chemins relatifs: -->
       <UseRelativeStaticWebAssetPaths>true</UseRelativeStaticWebAssetPaths>
     </PropertyGroup>
     ```

### Problèmes d'affichage dans l'interface d'administration

1. **Erreur "Invalid date" dans la liste des composants**:
   - Vérifiez que la propriété `UpdatedDate` est présente dans le modèle `ComponentAdminViewModel`
   - Assurez-vous que le service `MarketplaceService` affecte correctement cette propriété lors de la création des ViewModels
   - Le code JavaScript a été amélioré pour gérer plusieurs noms de propriétés possibles (updatedDate, updatedAt, lastUpdate, etc.)

2. **Erreur lors de l'affichage des composants** (components.forEach is not a function):
   - Le serveur renvoie parfois un objet avec une propriété `$values` contenant le tableau de composants
   - Utilisez le code JavaScript amélioré qui détecte et extrait le tableau de composants quel que soit le format de réponse

3. **Problème lors de la génération/affichage des clés API**:
   - La réponse du serveur lors de la création d'une clé API a le format `{$id: '1', apiKey: {...}}`
   - Le code d'extraction de la clé a été amélioré pour récupérer la valeur dans `response.apiKey.key`
   - Une modal personnalisée avec bouton de copie a remplacé l'alerte standard pour faciliter la copie de la clé

4. **Erreur 400 Bad Request lors de la suppression d'une clé API**:
   - Assurez-vous d'utiliser la propriété `apiKeyId` pour identifier les clés API et non `id`
   - Le code JavaScript a été mis à jour pour gérer les différentes propriétés possibles (apiKeyId ou id)

### Erreur d'accès à la base de données

1. Vérifiez la chaîne de connexion dans appsettings.json
2. Assurez-vous que l'utilisateur SQL a les droits nécessaires
3. Vérifiez que la base de données existe et que les tables ont été créées

### Erreur d'intégration GitHub

1. Vérifiez que le token GitHub est valide et a les autorisations nécessaires
2. Assurez-vous que le dépôt spécifié existe et est accessible
3. Vérifiez les paramètres GitHub dans appsettings.json

### Erreur 500 lors de la suppression d'un composant

Si vous recevez une erreur 500 lors de la tentative de suppression d'un composant:

1. **Vérifiez si le composant est installé sur des plateformes clientes**:
   - Un composant ne peut pas être supprimé s'il est installé sur des plateformes clientes
   - L'API renvoie maintenant une erreur 400 Bad Request avec un message explicatif indiquant sur quelles plateformes le composant est installé
   - Vous devez d'abord désinstaller le composant de toutes les plateformes clientes avant de pouvoir le supprimer

## Licence

Ce projet est soumis à la licence Avanteam.

---

© 2025 Avanteam. Tous droits réservés.