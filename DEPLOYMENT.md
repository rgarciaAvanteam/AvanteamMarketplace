# Guide de déploiement d'Avanteam Marketplace

Ce guide détaille les étapes pour déployer le module API Avanteam Marketplace sur IIS (Windows Server 2019) et l'intégration client dans Process Studio.

> **Mise à jour** : Nouvelle version incluant la gestion des versions maximales compatibles (MaxPlatformVersion) pour les composants, l'interface d'administration et la documentation Swagger améliorée.

## Prérequis

- Windows Server 2019 avec IIS installé
- SQL Server 2016 ou supérieur
- .NET 7.0 SDK et Runtime (mise à jour depuis .NET 6.0)
- .NET Core Hosting Bundle pour IIS
- Module URL Rewrite pour IIS

## 1. Préparation du serveur

### Installer les composants IIS

```powershell
# Installer IIS avec les fonctionnalités nécessaires
Install-WindowsFeature -Name Web-Server,Web-Asp-Net45,Web-Net-Ext45,Web-ISAPI-Ext,Web-ISAPI-Filter,Web-Http-Logging,Web-Filtering,Web-IP-Security

# Installer .NET Core Hosting Bundle (exécutez manuellement)
# Téléchargez depuis: https://dotnet.microsoft.com/download/dotnet/7.0/runtime
# Sélectionnez "Hosting Bundle"

# Installer le module URL Rewrite
# Téléchargez depuis: https://www.iis.net/downloads/microsoft/url-rewrite
```

### Créer le répertoire d'application

```powershell
# Créer le répertoire pour l'API
New-Item -ItemType Directory -Path "C:\inetpub\wwwroot\marketplace-dev" -Force
```

## 2. Compilation et publication de l'API

Exécutez ces commandes sur votre machine de développement où le code source est disponible:

```powershell
# Naviguer vers le dossier du projet
cd C:\Avanteam\dev\DevRG\AvanteamMarketplace

# Restaurer les packages NuGet
dotnet restore

# Publier l'API en mode Release
dotnet publish src\AvanteamMarketplace.API\AvanteamMarketplace.API.csproj -c Release -o publish
```

## 3. Déploiement des fichiers

### Copier les fichiers publiés

Copiez tous les fichiers du dossier `publish` vers le répertoire `C:\inetpub\wwwroot\AvanteamMarketplaceAPI` sur le serveur cible.

### Configurer la base de données

1. Créez une base de données SQL Server nommée `AvanteamMarketplace`
2. Modifiez le fichier `appsettings.json` dans le répertoire de l'API:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=SQL-PROD;Database=AvanteamMarketplace;Trusted_Connection=True;MultipleActiveResultSets=true"
  },
  "Environment": "Production",
  "ApiKeys": {
    "AdminKey": "votre-clé-admin-sécurisée"
  },
  "ApiBaseUrl": "https://votre-serveur",
  "Cors": {
    "AllowedOrigins": [
      "https://*.avanteam.fr",
      "https://*.avanteam-online.com",
      "https://votre-domaine-specifique.com"
    ]
  }
}
```

### Remplacer les jetons de sécurité

Les fichiers de configuration contiennent des jetons qui doivent être remplacés avec les valeurs réelles:

1. `#{MARKETPLACE_ADMIN_KEY}#` - Clé d'administration pour l'API
2. `#{GITHUB_PAT}#` - Token d'accès personnel GitHub pour l'intégration des composants

Vous pouvez utiliser un script de déploiement pour remplacer ces jetons automatiquement:

```powershell
# Exemple de remplacement de jetons
$files = Get-ChildItem -Path "C:\inetpub\wwwroot\marketplace-dev" -Filter "appsettings*.json" -Recurse
foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $content = $content.Replace('#{MARKETPLACE_ADMIN_KEY}#', 'votre-clé-admin-sécurisée')
    $content = $content.Replace('#{GITHUB_PAT}#', 'votre-token-github')
    Set-Content -Path $file.FullName -Value $content
}
```

## 4. Configuration IIS

### Créer un pool d'applications dédié

```powershell
# Importer le module IIS
Import-Module WebAdministration

# Créer un nouveau pool d'applications
New-WebAppPool -Name "AvanteamMarketplacePool"
Set-ItemProperty -Path "IIS:\AppPools\AvanteamMarketplacePool" -Name "managedRuntimeVersion" -Value ""
Set-ItemProperty -Path "IIS:\AppPools\AvanteamMarketplacePool" -Name "managedPipelineMode" -Value "Integrated"
```

### Créer le site web

```powershell
# Créer le site web avec le port 443 (HTTPS)
New-Website -Name "AvanteamMarketplaceAPI" -PhysicalPath "C:\inetpub\wwwroot\AvanteamMarketplaceAPI" -ApplicationPool "AvanteamMarketplacePool" -Port 443 -Ssl
```

### Configurer les droits d'accès

```powershell
# Définir les permissions pour le pool d'applications
$acl = Get-Acl "C:\inetpub\wwwroot\AvanteamMarketplaceAPI"
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule("IIS AppPool\AvanteamMarketplacePool", "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.SetAccessRule($accessRule)
$acl | Set-Acl "C:\inetpub\wwwroot\AvanteamMarketplaceAPI"
```

### Configurer le certificat SSL

1. Obtenez un certificat SSL valide (Let's Encrypt, certificat commercial, ou auto-signé pour les tests)
2. Importez-le dans le magasin de certificats Windows
3. Liez-le au site web:

```powershell
# Lier le certificat SSL (remplacez THUMBPRINT par l'empreinte de votre certificat)
New-WebBinding -Name "AvanteamMarketplaceAPI" -Protocol "https" -Port 443 -IPAddress "*" -SslFlags 0
$cert = Get-Item -Path "cert:\LocalMachine\My\THUMBPRINT"
$binding = Get-WebBinding -Name "AvanteamMarketplaceAPI" -Protocol "https"
$binding.AddSslCertificate($cert.Thumbprint, "my")
```

### Configuration IIS importante

L'API doit être configurée avec un web.config spécifique qui a été testé et validé. Cette configuration est automatiquement appliquée par le script de déploiement, mais si vous effectuez un déploiement manuel, assurez-vous que votre fichier web.config contient:

```xml
<aspNetCore processPath="dotnet" arguments=".\AvanteamMarketplace.API.dll" stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout" hostingModel="inprocess">
  <environmentVariables>
    <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Production" />
  </environmentVariables>
</aspNetCore>
```

La chaîne de connexion à la base de données doit également être correctement formatée, notamment pour les serveurs SQL avec instances nommées:

```json
"ConnectionStrings": {
  "DefaultConnection": "Server=SERVEUR\\INSTANCE,1433;Database=AvanteamMarketplace;User ID=utilisateur;Password=motdepasse;MultipleActiveResultSets=true;TrustServerCertificate=True;Encrypt=False"
}
```

**Points importants:**
1. Les backslashes doivent être échappés dans le JSON (double backslash)
2. Les paramètres `TrustServerCertificate=True` et `Encrypt=False` sont nécessaires pour éviter les problèmes de connexion
3. Le mode `inprocess` dans web.config offre de meilleures performances et a été testé avec succès
4. L'environnement doit être défini sur `Production` pour éviter les erreurs HTTP 400

## 5. Initialisation de la base de données

La migration de la base de données se fera automatiquement au premier démarrage de l'API. Cependant, vous pouvez aussi l'exécuter manuellement:

```powershell
# Dans le répertoire de l'API
dotnet ef database update
```

## 6. Test de l'installation

### Vérification de l'API et de la documentation Swagger

1. Naviguez vers `https://votre-serveur/swagger` pour vérifier que l'API fonctionne correctement
2. Vérifiez que la documentation Swagger affiche:
   - Les descriptions détaillées des endpoints
   - Les exemples de requêtes et réponses
   - Les informations sur l'authentification API Key
   - Les schémas de modèles complets avec descriptions

### Accès à l'interface d'administration

1. Naviguez vers `https://votre-serveur/admin`
2. Utilisez la clé d'administration configurée dans `appsettings.json` (ApiKeys:AdminKey)
3. Vérifiez que vous pouvez accéder aux fonctionnalités suivantes:
   - Gestion des composants (création, mise à jour, suppression)
   - Gestion des clés API
   - Synchronisation avec GitHub

## 7. Configuration de Process Studio

### Configuration des fichiers principaux

Le fonctionnement de Process Studio et du module Marketplace repose sur deux fichiers de configuration essentiels situés dans `/Avanteam Process Suite/PStudio.Configuration/`:

1. **programs.ini**
   - Fichier de configuration principal (463 lignes)
   - Définit les paramètres suivants:
     - **Environment**: `Development`, `Production` ou `Staging`
     - **Security**: Configuration HTTPS/SSL et HSTS
     - **SMTP**: Paramètres du serveur de messagerie
     - **Authentication**: Mode d'authentification et timeouts
     - **Parameters**: Paramètres spécifiques aux modules
     - **Conversion**: Configuration de génération de documents
   - Exemple de configuration pour l'environnement:
     ```ini
     [Environment]
     Type=Development
     AllowDebug=true
     
     [Security]
     UseHttps=true
     HstsEnabled=true
     HstsMaxAge=31536000
     ```

2. **applications.xml**
   - Contient les connexions aux bases de données
   - Définit deux connexions principales:
     - `app_PROD_APP`: Base de données d'application (paramétrage et données)
     - `app_prod_DIR`: Base de données d'annuaire (utilisateurs et permissions)
   - Exemple de connexion:
     ```xml
     <Connection name="ACME.Application.app_PROD_APP" type="Sql" 
                connectionstring="Data Source=SERVEUR\INSTANCE;Persist Security Info=True;
                                 User ID=utilisateur;Password=motdepasse;
                                 Initial Catalog=app_PROD_APP" />
     ```

### Configuration nécessaire pour le Marketplace

Pour un fonctionnement optimal du Marketplace, vérifiez ces éléments de configuration:

1. Dans **programs.ini**:
   - La section `[RESTServices]` doit être correctement configurée pour les appels API
   - La section `[MarketPlace]` doit contenir la clé API et l'URL du serveur Marketplace

2. Dans **applications.xml**:
   - Les attributs `baseUrl` et `remoteUri` doivent être correctement définis pour la connexion aux services

Pour une documentation complète des fichiers de configuration, consultez [le guide des fichiers de configuration](./docs/CONFIGURATION_FILES.md).

## 8. Déploiement du module client dans Process Studio

Pour chaque instance de Process Studio où vous souhaitez intégrer le Marketplace:

### Préparation du package client

Le module client doit être déployé sur chaque serveur Process Studio. Pour faciliter ce déploiement, nous vous recommandons de préparer un package client:

```powershell
# Sur le serveur de développement, générer un package de déploiement client
New-Item -ItemType Directory -Path ".\client-package" -Force | Out-Null
Copy-Item -Path ".\Avanteam Process Suite\PStudio.Net.Web\app\Custom\MarketPlace\*" -Destination ".\client-package\" -Recurse
Copy-Item -Path ".\DeployClientModule.ps1" -Destination ".\client-package\" -Force
Compress-Archive -Path ".\client-package\*" -DestinationPath ".\MarketplaceClient.zip" -Force

# Le fichier MarketplaceClient.zip est maintenant prêt à être transféré sur les serveurs Process Studio
```

### Déploiement du package client

Sur le serveur Process Studio cible:

1. Transférez le fichier `MarketplaceClient.zip` sur le serveur
2. Décompressez-le dans un répertoire temporaire
3. Exécutez le script de déploiement inclus:

```powershell
# Décompresser le package
Expand-Archive -Path "MarketplaceClient.zip" -DestinationPath ".\temp-marketplace" -Force

# Exécuter le script de déploiement avec les paramètres appropriés
cd .\temp-marketplace
.\DeployClientModule.ps1 -ProcessStudioPath "C:\ProcessStudio" -ApiUrl "https://votre-serveur/api/marketplace"
```

### Configurer la version de Process Studio

Le module Marketplace détecte automatiquement la version de Process Studio de plusieurs façons:

1. **Fichier version.txt** - Créez un fichier `version.txt` à la racine du site contenant la version (format : "v23.5" ou "23.5"):
   ```powershell
   # Créer un fichier version.txt à la racine de Process Studio
   Set-Content -Path "C:\ProcessStudio\version.txt" -Value "v23.5"
   ```

2. **Configuration dans Web.config** - Définissez la version dans le Web.config du module:
   ```xml
   <appSettings>
     <!-- Version de Process Studio -->
     <add key="ProcessStudioVersion" value="23.5" />
   </appSettings>
   ```

3. **Valeur par défaut** - Si aucune détection n'est possible, la version par défaut "23.10.0" sera utilisée

### Générer une clé API

Le script de déploiement générera automatiquement une clé API pour cette installation, mais vous pouvez également la générer manuellement:

```powershell
# Dans le répertoire Custom\MarketPlace
.\scripts\generate-api-key.ps1
```

La clé générée doit être communiquée de manière sécurisée à l'équipe Avanteam pour être enregistrée sur le serveur API central. Cette étape est essentielle pour que le client puisse s'authentifier auprès de l'API.

### Configurer l'URL de l'API

Le script de déploiement configurera automatiquement l'URL de l'API, mais vous pouvez également la modifier manuellement dans le fichier `Web.config` du dossier `Custom\MarketPlace`:

```xml
<appSettings>
  <!-- URL de l'API centrale du marketplace -->
  <add key="MarketplaceApiUrl" value="https://votre-serveur/api/marketplace" />
  
  <!-- La clé API sera déjà renseignée par le script generate-api-key.ps1 -->
</appSettings>
```

> **Important**: Après le déploiement, notez bien la clé API générée et transmettez-la à l'équipe Avanteam pour activation sur le serveur central. Sans cette activation, le client ne pourra pas communiquer avec l'API.

### Finaliser le déploiement

Après le déploiement du module client:

1. **Vérifiez l'installation**:
   ```powershell
   # Vérifier que les fichiers essentiels sont présents
   Test-Path "C:\ProcessStudio\Custom\MarketPlace\Default.aspx"
   Test-Path "C:\ProcessStudio\Custom\MarketPlace\js\marketplace\marketplace.js"
   ```

2. **Redémarrez l'application IIS de Process Studio**:
   ```powershell
   # Option 1: Utiliser le script fourni
   .\recycle-apppool.bat
   
   # Option 2: Redémarrer manuellement le pool d'applications
   Import-Module WebAdministration
   Restart-WebAppPool -Name "ProcessStudioAppPool"  # Remplacez par le nom réel du pool
   ```

3. **Testez l'accès au Marketplace**:
   - Naviguez vers `http://votre-serveur-process-studio/app/Custom/MarketPlace/Default.aspx`
   - Vérifiez que la page se charge correctement et affiche les composants disponibles
   - Assurez-vous que la version de Process Studio est correctement détectée

4. **Vérifiez les logs**:
   - En cas de problème, consultez les logs dans le dossier `logs` du module client
   - Les erreurs d'authentification indiqueraient que la clé API n'est pas correctement enregistrée

## 8. Publication de composants

### Utilisation de l'interface d'administration

La nouvelle interface d'administration permet de gérer les composants directement via le navigateur:

1. Connectez-vous à l'interface d'administration à l'adresse `https://votre-serveur/admin`
2. Utilisez l'onglet "Composants" pour:
   - Créer un nouveau composant
   - Télécharger un package de composant (.zip)
   - Modifier les informations d'un composant existant
   - Supprimer un composant

3. Utilisez l'onglet "Intégration GitHub" pour synchroniser des composants depuis GitHub:
   - Entrez l'URL du dépôt GitHub
   - Cliquez sur "Synchroniser"
   - Vérifiez le statut de la synchronisation

### Utilisation du script publish-to-marketplace.ps1

Pour publier un composant dans le Marketplace directement depuis son dépôt:

1. Placez le script `publish-to-marketplace.ps1` dans le dossier racine du composant (avec le fichier manifest.json)
2. Exécutez le script avec les paramètres nécessaires:

```powershell
./publish-to-marketplace.ps1 -AdminToken "votre_token_admin" -ApiBaseUrl "https://marketplace-dev.avanteam-online.com"
```

Le script:
- Lit automatiquement le fichier manifest.json
- Normalise le nom technique pour respecter les contraintes de validation
- Publie le composant directement sur le Marketplace
- Gère les erreurs de validation et affiche les messages appropriés

Options du script:
- `-AdminToken` : Token d'authentification avec droits administrateur (obligatoire)
- `-ApiBaseUrl` : URL de base de l'API (par défaut: "https://marketplace-dev.avanteam-online.com")
- `-TimeoutSeconds` : Délai d'attente en secondes pour la requête (par défaut: 30)

### Alternative : API d'intégration GitHub

Pour les dépôts GitHub, vous pouvez également utiliser l'endpoint d'intégration GitHub:

```powershell
$adminToken = "votre_token_admin"
$repoUrl = "https://github.com/organisation/nom-repo"

Invoke-RestMethod -Uri "https://marketplace-dev.avanteam-online.com/api/management/components/github/sync?repository=$repoUrl" `
                 -Method POST `
                 -Headers @{Authorization="Bearer $adminToken"}
```

## 9. Résolution des problèmes courants

### Erreurs HTTP 400 avec l'interface d'administration

Si vous rencontrez des erreurs HTTP 400 lors de l'utilisation de l'interface d'administration:

1. Vérifiez que le paramètre `Environment` est défini sur `Production` dans `appsettings.json`
2. Assurez-vous que le web.config contient la variable d'environnement `ASPNETCORE_ENVIRONMENT` définie sur `Production`
3. Vérifiez que les services de protection des données sont correctement configurés
4. Si les erreurs persistent, consultez les logs de l'application pour plus de détails

### Problèmes de compatibilité JavaScript dans l'interface d'administration

Si vous rencontrez des erreurs JavaScript dans la console comme `apiKeys.forEach is not a function`, vérifiez que:

1. Le fichier `admin.js` est correctement déployé dans le dossier `wwwroot/js/`
2. Le navigateur est compatible avec les fonctionnalités JavaScript utilisées (ES6)
3. Les réponses de l'API sont correctement traitées avec les différents formats possibles:
   - Format standard (tableau simple)
   - Format avec propriété `$values` (sérialisation .NET)
   - Format avec propriété `items` ou `data`

### Erreurs 404 pour les fichiers CSS

Si les styles ne s'affichent pas correctement:

1. Vérifiez que les fichiers CSS sont présents dans le dossier `wwwroot/css/`
2. Assurez-vous que `marketplace.css` et `admin.css` sont correctement déployés
3. Vérifiez les chemins d'accès dans la console du navigateur pour identifier les erreurs 404

### Problèmes CORS

Si vous rencontrez des erreurs CORS comme "Access to fetch has been blocked by CORS policy", assurez-vous que:

1. La section CORS dans `appsettings.json` inclut spécifiquement le domaine client:

```json
"Cors": {
  "AllowedOrigins": [
    "https://*.avanteam.fr",
    "https://*.avanteam-online.com",
    "https://votre-domaine-specifique.com"
  ]
}
```

2. Le middleware CORS est correctement configuré dans `Program.cs` avec:
   - `SetIsOriginAllowedToAllowWildcardSubdomains()` pour que les wildcards fonctionnent
   - `AllowCredentials()` pour les requêtes authentifiées
   - Middleware placé au bon endroit dans le pipeline (après `UseHttpsRedirection` mais avant `UseAuthentication`)

### Version de Process Studio incorrecte

Si la version de Process Studio affichée est incorrecte (par exemple "1.0"):

1. Vérifiez que le fichier `version.txt` existe à la racine du site avec le bon format (ex: "v23.5")
2. Assurez-vous que les permissions permettent la lecture de ce fichier par l'application web
3. Vérifiez le paramètre `ProcessStudioVersion` dans Web.config comme solution alternative
4. Examinez les logs de débogage pour les erreurs de détection de version

### Documentation Swagger incorrecte ou incomplète

Si la documentation Swagger n'affiche pas les informations détaillées:

1. Vérifiez que le fichier XML de documentation est généré lors de la compilation
2. Assurez-vous que la configuration Swagger dans `Program.cs` inclut:
   - `IncludeXmlComments()` pointant vers le fichier XML de documentation
   - `EnableAnnotations()` pour prendre en charge les attributs d'annotation Swagger
   - Configuration des groupes et tags pour organiser les endpoints

## 10. Utilisation de l'interface d'administration

### Authentification et sécurité

L'interface d'administration est protégée par une clé d'administration définie dans le fichier `appsettings.json`:

```json
"ApiKeys": {
  "AdminKey": "votre-clé-admin-sécurisée"
}
```

Cette clé doit être conservée secrète et communiquée uniquement aux administrateurs autorisés.

### Gestion des composants

L'onglet "Composants" permet de:

1. **Créer un nouveau composant**
   - Remplir le formulaire avec les informations du composant
   - Télécharger un logo et des captures d'écran
   - Définir la version, les dépendances et les tags
   - Spécifier les versions minimales et maximales compatibles de Process Studio

2. **Modifier un composant existant**
   - Mettre à jour les informations, la description ou les captures d'écran
   - Ajouter de nouvelles versions
   - Modifier les métadonnées (visibilité, catégories, etc.)
   - Gérer les contraintes de compatibilité (MinPlatformVersion et MaxPlatformVersion)

3. **Supprimer un composant**
   - Supprimer définitivement un composant du marketplace
   - Option pour désactiver temporairement sans supprimer

### Gestion des clés API

L'onglet "Clés API" permet de:

1. **Consulter les clés existantes**
   - Voir toutes les clés API enregistrées
   - Vérifier leur statut (active/inactive) et leur date d'expiration

2. **Créer une nouvelle clé**
   - Générer une clé pour un nouveau client
   - Définir une date d'expiration et une description

3. **Révoquer une clé**
   - Désactiver une clé sans la supprimer
   - Option pour supprimer définitivement

### Intégration GitHub

L'onglet "GitHub" permet de:

1. **Synchroniser un dépôt**
   - Entrer l'URL du dépôt GitHub
   - Importer automatiquement le composant selon son manifest.json

2. **Configurer les webhooks**
   - Mettre en place des webhooks pour la mise à jour automatique
   - Tester la connexion GitHub

## 11. Déploiement automatisé

Pour faciliter le déploiement dans des environnements d'entreprise, des scripts d'automatisation sont disponibles:

### Script de déploiement complet

Le script `deploy-complete.ps1` réalise toutes les étapes nécessaires:

```powershell
# Usage: ./deploy-complete.ps1 -TargetServer "serveur-iis" -SqlServer "serveur-sql" -Database "AvanteamMarketplace" -ApiUrl "https://marketplace.example.com"
```

### Génération automatique du package client

Pour créer un package client prêt à déployer sur plusieurs serveurs Process Studio:

```powershell
# Usage: ./create-client-package.ps1 -OutputPath "C:\Deployment\Packages"
```

Ce script crée un package auto-installable qui inclut:
- Le module client MarketPlace
- Le script de déploiement
- Une documentation d'installation
- Un script de vérification post-installation

### Déploiement à distance

Pour déployer sur plusieurs serveurs Process Studio à distance:

```powershell
# Usage: ./deploy-remote-clients.ps1 -ClientListFile "clients.csv" -PackagePath "MarketplaceClient.zip"
```

Le fichier CSV doit contenir:
- Nom du serveur
- Chemin d'installation
- URL de l'API
- Informations d'authentification (optionnel)

## Support technique

Pour toute assistance, contactez le support Avanteam.