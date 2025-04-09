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
    # Générer une clé aléatoire de 32 caractères
    $random = New-Object byte[] 24
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($random)
    $apiKey = [Convert]::ToBase64String($random).Replace('+', '-').Replace('/', '_').Replace('=', '').Substring(0, 32)
    
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
    Write-Host "Clé API mise à jour: $apiKey"
}
else {
    # Créer un nouvel élément
    $newNode = $webConfig.CreateElement("add")
    $newNode.SetAttribute("key", "MarketplaceApiKey")
    $newNode.SetAttribute("value", $apiKey)
    $webConfig.configuration.appSettings.AppendChild($newNode) | Out-Null
    Write-Host "Clé API créée: $apiKey"
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

Write-Host "Clé API générée avec succès. Veuillez transmettre cette clé à Avanteam pour l'enregistrement de votre instance."