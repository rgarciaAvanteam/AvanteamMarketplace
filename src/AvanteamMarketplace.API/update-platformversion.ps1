# Script PowerShell pour appliquer la migration SQL de PlatformVersion

param(
    [string]$ServerInstance = "(localdb)\MSSQLLocalDB",
    [string]$Database = "AvanteamMarketplace"
)

Write-Host "Mise à jour de la base de données pour ajouter la colonne PlatformVersion..." -ForegroundColor Yellow

try {
    # Vérifier que sqlcmd est disponible
    $sqlcmdExists = Get-Command sqlcmd -ErrorAction SilentlyContinue
    
    if ($null -eq $sqlcmdExists) {
        Write-Host "L'utilitaire sqlcmd n'est pas disponible. Veuillez installer SQL Server Command Line Utilities." -ForegroundColor Red
        exit 1
    }
    
    # Chemin du script SQL
    $scriptPath = Join-Path $PSScriptRoot "add-platformversion-column.sql"
    
    if (-not (Test-Path $scriptPath)) {
        Write-Host "Le script SQL n'a pas été trouvé à l'emplacement suivant : $scriptPath" -ForegroundColor Red
        exit 1
    }
    
    # Exécuter le script SQL
    Write-Host "Exécution du script SQL : $scriptPath" -ForegroundColor Cyan
    Write-Host "Connexion à $ServerInstance, base de données $Database" -ForegroundColor Cyan
    
    sqlcmd -S $ServerInstance -d $Database -i $scriptPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "La migration a été appliquée avec succès !" -ForegroundColor Green
    }
    else {
        Write-Host "Erreur lors de l'exécution du script SQL. Code de sortie : $LASTEXITCODE" -ForegroundColor Red
    }
}
catch {
    Write-Host "Une erreur s'est produite : $_" -ForegroundColor Red
}