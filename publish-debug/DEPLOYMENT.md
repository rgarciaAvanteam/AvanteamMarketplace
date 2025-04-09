# Guide de déploiement d'Avanteam Marketplace

Ce guide détaille les étapes pour déployer le module API Avanteam Marketplace sur IIS (Windows Server 2019) et l'intégration client dans Process Studio.

> **Mise à jour** : Configuration pour l'environnement de développement à l'adresse https://marketplace-dev.avanteam-online.com

## Prérequis

- Windows Server 2019 avec IIS installé
- SQL Server 2016 ou supérieur
- .NET 6.0 SDK et Runtime
- .NET Core Hosting Bundle pour IIS

## 1. Préparation du serveur

### Installer les composants IIS

```powershell
# Installer IIS avec les fonctionnalités nécessaires
Install-WindowsFeature -Name Web-Server,Web-Asp-Net45,Web-Net-Ext45,Web-ISAPI-Ext,Web-ISAPI-Filter,Web-Http-Logging,Web-Filtering,Web-IP-Security

# Installer .NET Core Hosting Bundle (exécutez manuellement)
# Téléchargez depuis: https://dotnet.microsoft.com/download/dotnet/6.0/runtime
# Sélectionnez "Hosting Bundle"
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
  
  // Autres paramètres...
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
    <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Development" />
    <environmentVariable name="ASPNETCORE_DETAILEDERRORS" value="1" />
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

## 5. Initialisation de la base de données

La migration de la base de données se fera automatiquement au premier démarrage de l'API. Cependant, vous pouvez aussi l'exécuter manuellement:

```powershell
# Dans le répertoire de l'API
dotnet ef database update
```

## 6. Test de l'installation

1. Naviguez vers `https://votre-serveur/swagger` pour vérifier que l'API fonctionne correctement
2. Notez l'URL complète pour la configuration des clients

## 7. Déploiement du module client dans Process Studio

Pour chaque instance de Process Studio où vous souhaitez intégrer le Marketplace:

### Copier les fichiers client

Copiez le dossier complet `AvanteamMarketplace` (sans le dossier `src`) vers le répertoire `Custom` de Process Studio:

```powershell
# Exemple
Copy-Item -Path "C:\Avanteam\dev\DevRG\AvanteamMarketplace" -Destination "C:\ProcessStudio\Custom\" -Recurse -Exclude "src","*.sln"
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

Utilisez le script inclus pour générer une clé API pour cette installation:

```powershell
# Dans le répertoire Custom\AvanteamMarketplace
.\scripts\generate-api-key.ps1
```

### Configurer l'URL de l'API

Modifiez le fichier `Web.config` dans le dossier `Custom\AvanteamMarketplace` pour pointer vers votre API:

```xml
<appSettings>
  <!-- URL de l'API centrale du marketplace -->
  <add key="MarketplaceApiUrl" value="https://votre-serveur/api/marketplace" />
  
  <!-- La clé API sera déjà renseignée par le script generate-api-key.ps1 -->
</appSettings>
```

### Redémarrer Process Studio

Redémarrez l'application Process Studio pour prendre en compte les changements.

## 8. Résolution des problèmes courants

### Problèmes de compatibilité JavaScript

Si vous rencontrez des erreurs JavaScript dans la console comme `components.forEach is not a function`, vérifiez que:

1. Le fichier `marketplace.js` est à jour et inclut les correctifs de gestion des formats de données
2. Le navigateur est compatible avec les fonctionnalités JavaScript utilisées (ES6)
3. La réponse de l'API est bien au format JSON et n'est pas bloquée par des problèmes d'authentification

### Version de Process Studio incorrecte

Si la version de Process Studio affichée est incorrecte (par exemple "1.0"):

1. Vérifiez que le fichier `version.txt` existe à la racine du site avec le bon format (ex: "v23.5")
2. Assurez-vous que les permissions permettent la lecture de ce fichier par l'application web
3. Vérifiez le paramètre `ProcessStudioVersion` dans Web.config comme solution alternative
4. Examinez les logs de débogage pour les erreurs de détection de version

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

3. Le fichier logo `marketplace-logo.svg` est présent dans le dossier `images/` pour éviter les erreurs 404

### Erreurs de chargement d'images

Si les images ou icônes ne s'affichent pas correctement:

1. Vérifiez que le fichier `marketplace-logo.svg` est présent dans le dossier `/images/` du module
2. Inspectez les chemins d'accès dans la console du navigateur pour identifier les erreurs 404
3. Assurez-vous que les fichiers d'images sont accessibles avec les bonnes permissions

### Administration du Marketplace

#### Enregistrement des clés API

Les clés API générées lors de l'installation des clients doivent être ajoutées dans la configuration de l'API:

1. Connectez-vous à la base de données SQL Server
2. Consultez la table `ApiKeys` pour voir la clé admin générée automatiquement
3. Pour autoriser de nouvelles clés, ajoutez-les soit dans la table `ApiKeys`, soit via l'API d'administration

#### Gestion des composants

Utilisez l'API d'administration pour:

1. Ajouter de nouveaux composants
2. Mettre à jour les composants existants
3. Supprimer des composants
4. Publier des composants depuis GitHub

## Support technique

Pour toute assistance, contactez le support Avanteam.