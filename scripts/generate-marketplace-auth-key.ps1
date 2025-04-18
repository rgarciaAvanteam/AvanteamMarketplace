# Génère une clé secrète aléatoire pour la signature des tokens JWT
# Cette clé doit être suffisamment longue et complexe pour assurer la sécurité

$keyLength = 64  # Longueur de la clé en caractères (32 bytes minimum recommandé)
$key = [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes($keyLength))

Write-Host "Clé secrète pour MarketplaceAuth.SecretKey générée :"
Write-Host $key
Write-Host ""
Write-Host "Utilisez cette clé pour configurer le paramètre MarketplaceAuth.SecretKey dans appsettings.json"
Write-Host "ATTENTION: Conservez cette clé en sécurité, elle est utilisée pour signer et valider les tokens d'authentification."

# Vous pouvez utiliser cette clé avec le script update-secrets.ps1