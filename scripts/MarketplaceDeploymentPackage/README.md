# Package de déploiement Marketplace Avanteam

Ce package contient tout ce qui est nécessaire pour installer le Marketplace Avanteam dans une application Process Studio existante.

## Contenu

- `install-marketplace.ps1` - Script d'installation principal
- `ClientModule/` - Fichiers du module client Marketplace
- `LocalInstaller/` - Fichiers de l'API locale d'installation
- `Scripts/` - Scripts utilitaires

## Structure d'installation

L'installation suit une structure spécifique:

```
├── root/                    # Répertoire racine du site
│   ├── api-installer/       # API locale d'installation (application IIS avec son propre pool)
│   └── ...
│
└── app/                     # Application principale
    ├── Custom/
    │   ├── MarketPlace/     # Module client Marketplace
    │   └── ...
    └── ...
```

## Installation

1. Décompressez ce package sur le serveur cible
2. **IMPORTANT**: Exécutez le script `install-marketplace.ps1` en tant qu'administrateur
3. Suivez les instructions à l'écran
4. Le script vous demandera:
   - Le chemin du répertoire root (où sera installé api-installer)
   - Le chemin du répertoire app (où sera installé le client Marketplace)
   - Le nom du site web IIS existant
5. Le script configurera automatiquement IIS

## Comportement IIS

Le script:
- Crée/configure UNIQUEMENT l'application "api-installer" dans IIS
- Configure le pool d'applications "api-installer" avec des privilèges élevés
- Ne crée PAS d'applications IIS pour app/Custom ou app/Custom/MarketPlace
- Dépose simplement les fichiers du module client dans le répertoire app/Custom/MarketPlace

## Configuration importante

L'API locale d'installation (api-installer) est configurée avec des **privilèges élevés** (LocalSystem) pour permettre:
- L'installation et la désinstallation de composants
- La copie de fichiers dans des répertoires protégés
- L'exécution de scripts PowerShell avec des droits administratifs
- Toute autre opération administrative requise pour gérer les composants

## Paramètres du script

```powershell
.\install-marketplace.ps1 -RootPath "C:\inetpub\wwwroot" -AppPath "C:\inetpub\wwwroot\app" -ApiUrl "https://marketplace.example.com/api/marketplace" -WebsiteName "Default Web Site"
```

Tous les paramètres sont optionnels. Si non spécifiés, le script vous les demandera interactivement.

## Après l'installation

- Récupérez une clé API auprès de l'administrateur Avanteam du Marketplace
- Configurez cette clé dans le Web.config du module client MarketPlace
- Testez l'accès à l'interface utilisateur: http://votre-serveur/app/Custom/MarketPlace/Default.aspx
- Testez l'accès à l'API locale: http://votre-serveur/api-installer/status
