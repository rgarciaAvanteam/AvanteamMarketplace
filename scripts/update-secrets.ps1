param (
    [Parameter(Mandatory=$true)]
    [string]$AzureAdClientSecret,
    
    [Parameter(Mandatory=$true)]
    [string]$MarketplaceAuthSecretKey,
    
    [Parameter(Mandatory=$true)]
    [string]$MarketplaceAdminKey
)

$configPath = ".\src\AvanteamMarketplace.API\appsettings.json"
$configContent = Get-Content -Path $configPath -Raw | ConvertFrom-Json

# Mettre à jour les secrets
$configContent.AzureAd.ClientSecret = $AzureAdClientSecret
$configContent.MarketplaceAuth.SecretKey = $MarketplaceAuthSecretKey
$configContent.ApiKeys.AdminKey = $MarketplaceAdminKey

# Sauvegarder le fichier mis à jour
$configContent | ConvertTo-Json -Depth 10 | Set-Content -Path $configPath

Write-Host "Configuration mise à jour avec succès !"
Write-Host "Secrets configurés :"
Write-Host "- AzureAd.ClientSecret: [MASQUÉ]"
Write-Host "- MarketplaceAuth.SecretKey: [MASQUÉ]"
Write-Host "- ApiKeys.AdminKey: [MASQUÉ]"