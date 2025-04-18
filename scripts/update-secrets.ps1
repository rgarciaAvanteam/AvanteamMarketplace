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

# Mettre � jour les secrets
$configContent.AzureAd.ClientSecret = $AzureAdClientSecret
$configContent.MarketplaceAuth.SecretKey = $MarketplaceAuthSecretKey
$configContent.ApiKeys.AdminKey = $MarketplaceAdminKey

# Sauvegarder le fichier mis � jour
$configContent | ConvertTo-Json -Depth 10 | Set-Content -Path $configPath

Write-Host "Configuration mise � jour avec succ�s !"
Write-Host "Secrets configur�s :"
Write-Host "- AzureAd.ClientSecret: [MASQU�]"
Write-Host "- MarketplaceAuth.SecretKey: [MASQU�]"
Write-Host "- ApiKeys.AdminKey: [MASQU�]"