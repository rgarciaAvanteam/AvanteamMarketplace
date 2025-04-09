# Guide de test pour l'installation des composants

Ce document explique comment tester manuellement le processus d'installation des composants et vérifier les logs.

## 1. Test du script PowerShell indépendamment

Pour tester le script PowerShell directement sans passer par l'interface web :

```powershell
# Depuis une console PowerShell, exécutez :
.\scripts\test-install.ps1 -packageUrl "https://example.com/component.zip" -componentId "test-component" -version "1.0.0"

# Pour tester le script principal d'installation :
.\scripts\install-component.ps1 -ComponentPackageUrl "https://example.com/component.zip" -ComponentId "test-component" -Version "1.0.0" -ProcessStudioRoot "C:\ProcessStudio"
```

Ces commandes vont créer des logs dans le dossier `scripts\Logs\`.

## 2. Vérification des logs

Les logs d'installation seront générés dans l'un de ces emplacements :

1. `scripts\Logs\` - l'emplacement principal où les logs sont générés
2. `%TEMP%\AvanteamMarketplaceLogs\` - emplacement alternatif si le script ne peut pas écrire dans le premier emplacement

## 3. Problèmes courants et solutions

### Aucun log n'est créé

1. **Vérifiez les permissions** - Le script doit avoir les permissions d'écriture dans le dossier `scripts\Logs\`
2. **Testez manuellement** - Utilisez `test-install.ps1` pour vérifier si PowerShell peut écrire dans le dossier
3. **Vérifiez les logs du serveur** - Consultez les logs IIS pour voir si des erreurs sont rapportées

### L'installation ne démarre pas

1. **Vérifiez que le script est appelé** - L'interface web doit appeler correctement la bonne API
2. **Vérifiez les journaux du serveur** - Des erreurs peuvent être visibles dans les logs serveur
3. **Vérifiez la console du navigateur** - Des messages d'erreur JavaScript peuvent apparaître

## 4. Pour les tests d'intégration

Dans un environnement de production, l'installation se déroule en plusieurs étapes :

1. Le client web télécharge le package via l'API
2. Le client lance l'exécution du script d'installation via l'API (ce qui n'est pas encore implémenté)
3. Le serveur exécute le script PowerShell avec les paramètres appropriés
4. Le serveur récupère les logs et les renvoie au client
5. Le client affiche les logs dans l'interface utilisateur

Pour une implémentation complète, un point d'API supplémentaire serait nécessaire pour exécuter le script PowerShell.

## 5. Solution temporaire

Puisque l'exécution du script PowerShell par l'API n'est pas encore implémentée, vous pouvez :

1. Laisser la simulation JavaScript afficher des logs dans l'interface utilisateur
2. Exécuter manuellement le script PowerShell après l'installation pour vérifier que tout fonctionne
3. Implémenter une solution de surveillance de dossier qui exécute automatiquement le script lorsqu'un composant est téléchargé