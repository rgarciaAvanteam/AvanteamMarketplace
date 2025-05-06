# API d'Installation Locale Marketplace Avanteam

Cette API fournit les endpoints nécessaires pour l'installation et la désinstallation locale des composants du Marketplace Avanteam dans Process Studio.

## Configuration

L'API est conçue pour être déployée dans IIS avec un chemin virtuel, généralement `/api-installer`.

### Prérequis

- .NET 6.0 SDK ou supérieur
- IIS avec le module ASP.NET Core
- PowerShell 5.1 ou supérieur

### Structure des répertoires

- `scripts/` : Contient les scripts PowerShell utilisés par l'API
  - `install-component.ps1` : Script d'installation des composants
  - `uninstall-component.ps1` : Script de désinstallation des composants
- `logs/` : Répertoire où sont stockés les fichiers de log

## Déploiement

1. Compiler le projet :
   ```
   dotnet publish -c Release
   ```

2. Copier le contenu du dossier `bin/Release/net6.0/publish` dans le répertoire IIS cible (Sous le répertoire Root dans '/api-installer')

3. Déclarer application sous votre site principale avec :
   - Chemin physique : le répertoire où les fichiers ont été copiés
   - Chemin virtuel : `/api-installer` (ou tout autre chemin configuré dans votre environnement)
   - Pool d'applications : créer un nouveau pool d'applications .NET Core

4. S'assurer que l'utilisateur du pool d'applications a les droits d'accès nécessaires pour :
   - Le répertoire de l'API
   - Le répertoire racine de Process Studio (spécifié dans `appsettings.json`)

## Configuration

Le fichier `appsettings.json` permet de configurer l'API :

```json
{
  "ProcessStudioRoot": "../app",
  "Installer": {
    "ScriptsPath": "scripts",
    "LogsPath": "logs",
    "InstallationTimeout": 600
  }
}
```

- `ProcessStudioRoot` : Chemin relatif ou absolu vers le répertoire racine de Process Studio
- `Installer.ScriptsPath` : Chemin vers le répertoire des scripts
- `Installer.LogsPath` : Chemin vers le répertoire des logs
- `InstallationTimeout` : Temps maximum en secondes pour l'installation ou la désinstallation

## Documentation API

Une fois l'API déployée, la documentation Swagger est disponible à l'URL :
```
https://[votre-serveur]/api-installer/swagger
```

## Endpoints API

### GET /status

Vérifie l'état de l'API et retourne les informations de configuration.

**Réponse (200 OK)** :
```json
{
  "Status": "API d'installation locale opérationnelle",
  "RootPath": "C:\\ProcessStudio",
  "ScriptsPath": "C:\\api-installer\\scripts",
  "LogsPath": "C:\\api-installer\\logs",
  "Timestamp": "2025-04-16T14:30:45.123Z",
  "Features": ["install", "uninstall"]
}
```

### POST /install

Installe un composant à partir d'une URL de package.

**Corps de la requête** :
```json
{
  "componentId": 123,
  "version": "1.0.0",
  "packageUrl": "https://example.com/packages/component-123-1.0.0.zip",
  "installId": "install-20250416-abc123"
}
```

**Paramètres** :
- `componentId` : Identifiant unique du composant (obligatoire)
- `version` : Version du composant (obligatoire)
- `packageUrl` : URL de téléchargement du package (obligatoire)
- `installId` : Identifiant unique de l'installation (facultatif, généré automatiquement si non fourni)

**Réponse (200 OK)** :
```json
{
  "success": true,
  "componentId": 123,
  "version": "1.0.0",
  "installId": "install-20250416-abc123",
  "destinationPath": "C:\\ProcessStudio\\Components\\Component123",
  "logs": [
    {
      "level": "INFO",
      "message": "Téléchargement du package depuis l'URL..."
    },
    {
      "level": "SUCCESS",
      "message": "Installation réussie!"
    }
  ],
  "logFile": "C:\\api-installer\\logs\\install-123-1.0.0-install-20250416-abc123.log"
}
```

**Réponse d'erreur (400, 404, 500)** :
```json
{
  "success": false,
  "error": "L'URL du package est requise",
  "logs": [
    {
      "level": "ERROR",
      "message": "L'URL du package est manquante dans la demande d'installation"
    }
  ]
}
```

### POST /uninstall

Désinstalle un composant présent sur le serveur Process Studio.

**Corps de la requête** :
```json
{
  "componentId": 123,
  "force": false,
  "uninstallId": "uninstall-20250416-xyz789"
}
```

**Paramètres** :
- `componentId` : Identifiant unique du composant (obligatoire)
- `force` : Force la désinstallation même en cas de dépendances (facultatif, défaut : false)
- `uninstallId` : Identifiant unique de la désinstallation (facultatif, généré automatiquement si non fourni)

**Réponse (200 OK)** :
```json
{
  "success": true,
  "componentId": 123,
  "uninstallId": "uninstall-20250416-xyz789",
  "backupPath": "C:\\api-installer\\backups\\Component123-20250416-143045.zip",
  "logs": [
    {
      "level": "INFO",
      "message": "Création d'une sauvegarde du composant..."
    },
    {
      "level": "SUCCESS",
      "message": "Désinstallation réussie!"
    }
  ],
  "logFile": "C:\\api-installer\\logs\\uninstall-123-uninstall-20250416-xyz789.log"
}
```

## Journalisation

Les journaux sont stockés dans le répertoire des logs configuré (`logs/` par défaut) :

- Logs d'installation : `install-{componentId}-{version}-{installId}.log`
- Logs de désinstallation : `uninstall-{componentId}-{uninstallId}.log`
- Logs système : `installer-{date}.log`

## Résolution des problèmes

### L'API retourne une erreur 404

Vérifier que :
- L'application est correctement déployée dans IIS
- Le chemin virtuel est correctement configuré
- Le module ASP.NET Core est installé sur IIS

### Échec d'installation d'un composant

Vérifier que :
- L'URL du package est accessible
- L'utilisateur du pool d'applications a les droits d'accès nécessaires
- Le répertoire de destination existe et est accessible en écriture
- Consulter les logs d'installation pour plus de détails

### Swagger ne s'affiche pas correctement

Si Swagger ne se charge pas correctement, vérifier :
1. Que l'URL d'accès est correcte (`https://[votre-serveur]/api-installer/swagger`)
2. Que le chemin relatif configuré dans Program.cs est approprié pour votre environnement :
   ```csharp
   c.SwaggerEndpoint("../swagger/v1/swagger.json", "API d'Installation Locale v1");
   ```
3. Que le fichier swagger.json est accessible via l'URL `https://[votre-serveur]/api-installer/swagger/v1/swagger.json`

## Maintenance

### Mise à jour des scripts

Les scripts d'installation et de désinstallation se trouvent dans le répertoire `scripts/`. Vous pouvez les mettre à jour sans avoir à redéployer l'API complète.

### Nettoyage des logs

Les fichiers de log peuvent s'accumuler au fil du temps. Il est recommandé de mettre en place une tâche planifiée pour supprimer les anciens fichiers de log (plus de 30 jours par exemple).