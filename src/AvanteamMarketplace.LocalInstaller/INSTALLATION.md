# Guide d'installation de l'API locale pour les composants Marketplace

Ce document détaille le processus d'installation et de configuration de l'API locale pour l'installation automatisée des composants du Marketplace Avanteam.

## Prérequis

- **Windows Server** avec IIS installé
- **ASP.NET Core Runtime 6.0** ou plus récent
- **ASP.NET Core Module pour IIS** installé
- **PowerShell 5.1** ou plus récent
- **Process Studio** correctement installé et configuré

## Structure des répertoires

L'installation des composants suit la structure de répertoires suivante :

- **ProcessStudioRoot** : Répertoire racine de Process Studio (ex: `C:\inetpub\wwwroot\ProcessStudio`)
  - **Custom** : Dossier pour les extensions personnalisées
    - **MarketPlace** : Dossier principal pour le Marketplace
      - **api** : API locale pour l'installation des composants
      - **scripts** : Scripts d'installation et désinstallation
      - **logs** : Journaux d'installation
      - **Components** : Composants enregistrés par le Marketplace
        - **[ComponentId]** : Un dossier par composant installé
    - **[TargetPath]** : Répertoire d'installation personnalisé (selon manifest.json de chaque composant)

## Étapes d'installation

### 1. Compilation de l'API locale

Avant de déployer l'API, vous devez la compiler:

```powershell
cd AvanteamMarketplace.LocalInstaller
dotnet publish -c Release
```

### 2. Installation automatisée

Utilisez le script d'installation fourni:

```powershell
# Depuis le répertoire du projet
.\setup-local-installer.ps1 -ProcessStudioRoot "C:\inetpub\wwwroot\ProcessStudio"
```

### 3. Installation manuelle (alternative)

Si vous préférez une installation manuelle:

1. Créez les répertoires suivants:
   - `C:\inetpub\wwwroot\ProcessStudio\Custom\MarketPlace\api`
   - `C:\inetpub\wwwroot\ProcessStudio\Custom\MarketPlace\scripts`
   - `C:\inetpub\wwwroot\ProcessStudio\Custom\MarketPlace\logs`

2. Copiez les fichiers compilés depuis `bin\Release\net6.0\publish` vers le répertoire `api`

3. Copiez le fichier `install-component.ps1` vers le répertoire `scripts`

4. Assurez-vous que le web.config est correctement configuré dans le répertoire `api`

### 4. Configuration d'IIS

1. Assurez-vous que le module ASP.NET Core est installé:
   ```powershell
   Install-WindowsFeature Web-AspNetCore
   ```

2. Configurez les permissions:
   - L'utilisateur du pool d'applications doit avoir les droits d'exécution pour PowerShell
   - L'utilisateur doit avoir accès en lecture/écriture aux répertoires `Custom/MarketPlace/scripts` et `Custom/MarketPlace/logs`

3. Vérifiez que le fichier `web.config` est correctement configuré:
   ```xml
   <system.webServer>
     <handlers>
       <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
     </handlers>
     <aspNetCore processPath="dotnet" arguments=".\AvanteamMarketplace.LocalInstaller.dll" stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout" hostingModel="inprocess" />
   </system.webServer>
   ```

## Vérification de l'installation

Pour vérifier que l'API locale est correctement installée et fonctionnelle:

1. Accédez à l'URL `http://votreserveur/Custom/MarketPlace/api/status`
2. Vous devriez voir une réponse JSON avec le statut de l'API

## Scripts d'installation et désinstallation

### install-component.ps1

Ce script est responsable de l'installation des composants du Marketplace. Il effectue les opérations suivantes :

1. Télécharge le package du composant
2. Extrait le contenu dans un répertoire temporaire
3. Lit le fichier `manifest.json` pour déterminer le chemin d'installation cible
4. Copie les fichiers vers le répertoire d'installation et le répertoire d'enregistrement
5. Exécute le script d'installation personnalisé `install.ps1` du composant s'il est présent
6. Nettoie les fichiers temporaires

Paramètres du script :
- `ComponentPackageUrl` : URL du package à télécharger
- `ComponentId` : Identifiant unique du composant
- `Version` : Version du composant
- `ProcessStudioRoot` : Répertoire racine de Process Studio (optionnel)

### uninstall-component.ps1

Ce script est responsable de la désinstallation des composants. Il effectue les opérations suivantes :

1. Vérifie si le composant est installé dans le répertoire d'enregistrement
2. Lit le fichier `manifest.json` pour déterminer le chemin d'installation personnalisé
3. Exécute le script de désinstallation personnalisé `uninstall.ps1` du composant si présent
4. Crée une sauvegarde des fichiers avant suppression
5. Supprime les fichiers du composant
6. Nettoie les répertoires vides

Paramètres du script :
- `ComponentId` : Identifiant unique du composant
- `ProcessStudioRoot` : Répertoire racine de Process Studio (optionnel)
- `Force` : Forcer la désinstallation même en cas de dépendances (optionnel)

## Format du manifest.json

Chaque composant doit inclure un fichier `manifest.json` à sa racine avec la structure suivante :

```json
{
  "name": "Nom du composant",
  "version": "1.0.0",
  "author": "Avanteam",
  "description": "Description du composant",
  "installation": {
    "targetPath": "Custom/CheminPersonnalise",
    "customActions": ["install.ps1"]
  },
  "dependencies": [
    {
      "id": "autre-composant",
      "name": "Autre Composant",
      "version": "1.0.0"
    }
  ]
}
```

Le champ `targetPath` spécifie le répertoire où les fichiers du composant seront installés, relativement à la racine de Process Studio.

## Scripts personnalisés des composants

### install.ps1

Ce script est exécuté depuis le répertoire d'installation du composant après la copie des fichiers. Il reçoit les paramètres suivants :

```powershell
param (
    [Parameter(Mandatory=$true)]
    [string]$ProcessStudioRoot,
    
    [Parameter(Mandatory=$false)]
    [string]$ComponentId,
    
    [Parameter(Mandatory=$false)]
    [string]$Version
)
```

Le script doit effectuer les actions personnalisées d'installation, comme la modification de fichiers de configuration existants.

### uninstall.ps1

Ce script est exécuté depuis le répertoire d'enregistrement du composant avant la suppression des fichiers. Il reçoit les paramètres suivants :

```powershell
param (
    [Parameter(Mandatory=$true)]
    [string]$ProcessStudioRoot,
    
    [Parameter(Mandatory=$false)]
    [string]$ComponentId
)
```

Le script doit effectuer les actions personnalisées de désinstallation, comme la suppression des références au composant dans les fichiers de configuration.

## Dépannage

### L'API retourne une erreur 500

1. Vérifiez les logs IIS dans `%SystemDrive%\inetpub\logs\LogFiles`
2. Vérifiez les logs de l'API dans `Custom\MarketPlace\api\logs\stdout_xxx.log`
3. Assurez-vous que le module ASP.NET Core est correctement installé
4. Vérifiez les permissions du compte d'application IIS

### L'installation des composants échoue

1. Vérifiez les logs d'installation dans `Custom\MarketPlace\logs`
2. Vérifiez les logs personnalisés générés pendant l'installation
3. Assurez-vous que le script `install-component.ps1` est présent et accessible
4. Vérifiez que PowerShell est accessible par l'utilisateur du pool d'applications
5. Vérifiez les chemins de fichiers dans le script d'installation personnalisé du composant

### Problèmes avec le fichier FormularDesigner.xml

Si vous rencontrez des problèmes avec la modification du fichier FormularDesigner.xml :

1. Vérifiez que le fichier existe à l'emplacement attendu (`ProcessStudioRoot\Custom\FormularDesigner.xml`)
2. Vérifiez que le script install.ps1 du composant contient la logique pour rechercher le fichier à plusieurs emplacements
3. Utilisez la version améliorée du script qui vérifie les deux emplacements possibles

## Support

Pour toute assistance, contactez le support Avanteam:
- Email: support@avanteam.fr
- Site web: https://avanteam.fr