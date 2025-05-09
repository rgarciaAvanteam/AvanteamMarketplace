<#
.SYNOPSIS
    Génère une clé API pour l'authentification au marketplace Avanteam
    
.DESCRIPTION
    Ce script génère une clé API pour l'authentification au marketplace Avanteam
    et l'ajoute au fichier Web.config de l'application.
    
.PARAMETER WebConfigPath
    Chemin vers le fichier Web.config
    
.EXAMPLE
    .\generate-api-key.ps1 -WebConfigPath "C:\Avanteam\ProcessStudioWeb\Custom\Marketplace\Web.config"
#>
param (
    [Parameter(Mandatory=$false)]
    [string]$WebConfigPath = ".\Web.config"
)

function Generate-ApiKey {
    # Générer une clé aléatoire forte (48 caractères, sans troncature)
    $random = New-Object byte[] 36  # Augmenté à 36 octets pour plus de sécurité
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($random)
    $apiKey = [Convert]::ToBase64String($random).Replace('+', '-').Replace('/', '_').Replace('=', '')
    
    return $apiKey
}

# Vérifier que le fichier Web.config existe
if (-not (Test-Path $WebConfigPath)) {
    Write-Error "Le fichier Web.config n'existe pas à l'emplacement spécifié: $WebConfigPath"
    exit 1
}

# Lire le contenu du fichier Web.config
try {
    [xml]$webConfig = Get-Content $WebConfigPath
}
catch {
    Write-Error "Erreur lors de la lecture du fichier Web.config: $_"
    exit 1
}

# Générer une nouvelle clé API
$apiKey = Generate-ApiKey

# Vérifier si la clé existe déjà
$apiKeyNode = $webConfig.configuration.appSettings.add | Where-Object { $_.key -eq "MarketplaceApiKey" }

if ($apiKeyNode -ne $null) {
    # Mettre à jour la valeur existante
    $apiKeyNode.value = $apiKey
    Write-Host "Clé API mise à jour: " -NoNewline
    Write-Host "$($apiKey.Substring(0, 6))..." -ForegroundColor Yellow
}
else {
    # Créer un nouvel élément
    $newNode = $webConfig.CreateElement("add")
    $newNode.SetAttribute("key", "MarketplaceApiKey")
    $newNode.SetAttribute("value", $apiKey)
    $webConfig.configuration.appSettings.AppendChild($newNode) | Out-Null
    Write-Host "Clé API créée: " -NoNewline
    Write-Host "$($apiKey.Substring(0, 6))..." -ForegroundColor Yellow
}

# Sauvegarder les modifications
try {
    $webConfig.Save($WebConfigPath)
    Write-Host "Les modifications ont été enregistrées dans $WebConfigPath"
}
catch {
    Write-Error "Erreur lors de l'enregistrement du fichier Web.config: $_"
    exit 1
}

Write-Host "Clé API générée avec succès." 
Write-Host "IMPORTANT: Pour l'enregistrement de votre instance, veuillez:" -ForegroundColor Yellow
Write-Host "1. Envoyer cette clé de manière sécurisée à Avanteam (email crypté ou portail client)"
Write-Host "2. Ne pas partager cette clé via des canaux non sécurisés"
Write-Host "3. Conserver une copie de la clé dans un gestionnaire de mots de passe"

# Exporter la clé dans un fichier sécurisé
$exportKey = Read-Host "Voulez-vous exporter la clé dans un fichier sécurisé? (O/N)"
if ($exportKey -eq "O" -or $exportKey -eq "o") {
    $keyFile = Join-Path (Split-Path -Parent $WebConfigPath) "apikey.txt"
    $apiKey | Out-File -FilePath $keyFile -Encoding utf8
    Write-Host "Clé API exportée dans $keyFile"
    Write-Host "ATTENTION: Veuillez supprimer ce fichier après l'avoir transmis à Avanteam" -ForegroundColor Red
}