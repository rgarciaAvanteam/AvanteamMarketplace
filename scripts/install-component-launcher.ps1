#
# Script launcher pour l'installation de composants Avanteam Marketplace
# Ce script est téléchargé et exécuté par le client pour installer un composant
#

param (
    [Parameter(Mandatory=$true)]
    [string]$ComponentId,
    
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [Parameter(Mandatory=$true)]
    [string]$PackageUrl,
    
    [Parameter(Mandatory=$false)]
    [string]$ProcessStudioRoot = "",

    [Parameter(Mandatory=$false)]
    [switch]$Interactive = $false
)

# Configuration
$ScriptTitle = "Installation du composant Avanteam Marketplace"
$TempDirectory = Join-Path $env:TEMP "AvanteamMarketplace"
$InstallScriptName = "install-component.ps1"
$InstallScriptUrl = "https://marketplace.avanteam.fr/scripts/install-component.ps1"
$InstallScriptPath = Join-Path $TempDirectory $InstallScriptName
$ResultFilePath = Join-Path $TempDirectory "install-result.json"

# Fonction pour créer une fenêtre d'interface utilisateur si le mode interactif est activé
function Show-InstallationUI {
    param (
        [string]$Title,
        [string]$ComponentName,
        [string]$Version
    )
    
    if (-not $Interactive) {
        return
    }
    
    Add-Type -AssemblyName System.Windows.Forms
    
    $form = New-Object System.Windows.Forms.Form
    $form.Text = $Title
    $form.Size = New-Object System.Drawing.Size(600, 400)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    
    $label = New-Object System.Windows.Forms.Label
    $label.Location = New-Object System.Drawing.Point(10, 20)
    $label.Size = New-Object System.Drawing.Size(560, 40)
    $label.Text = "Installation du composant $ComponentName v$Version en cours..."
    $label.Font = New-Object System.Drawing.Font("Arial", 12)
    $form.Controls.Add($label)
    
    $progressBar = New-Object System.Windows.Forms.ProgressBar
    $progressBar.Location = New-Object System.Drawing.Point(10, 70)
    $progressBar.Size = New-Object System.Drawing.Size(560, 30)
    $progressBar.Style = "Marquee"
    $form.Controls.Add($progressBar)
    
    $logBox = New-Object System.Windows.Forms.TextBox
    $logBox.Location = New-Object System.Drawing.Point(10, 120)
    $logBox.Size = New-Object System.Drawing.Size(560, 190)
    $logBox.Multiline = $true
    $logBox.ScrollBars = "Vertical"
    $logBox.ReadOnly = $true
    $logBox.Font = New-Object System.Drawing.Font("Consolas", 9)
    $form.Controls.Add($logBox)
    
    $closeButton = New-Object System.Windows.Forms.Button
    $closeButton.Location = New-Object System.Drawing.Point(470, 320)
    $closeButton.Size = New-Object System.Drawing.Size(100, 30)
    $closeButton.Text = "Fermer"
    $closeButton.Enabled = $false
    $closeButton.Add_Click({ $form.Close() })
    $form.Controls.Add($closeButton)
    
    # Fonction pour ajouter des messages dans la boîte de log
    function Add-Log {
        param ([string]$message)
        $logBox.AppendText("$message`r`n")
        $logBox.SelectionStart = $logBox.Text.Length
        $logBox.ScrollToCaret()
    }
    
    # Démarrer l'interface
    $form.Show()
    
    # Retourner les éléments d'interface
    return @{
        Form = $form
        ProgressBar = $progressBar
        LogBox = $logBox
        AddLog = [scriptblock]::Create({ param($msg) Add-Log $msg })
        CloseButton = $closeButton
    }
}

# Assurer que le dossier temporaire existe
if (-not (Test-Path $TempDirectory)) {
    New-Item -ItemType Directory -Path $TempDirectory -Force | Out-Null
}

# Initialiser l'interface utilisateur si en mode interactif
$ui = $null
if ($Interactive) {
    $ui = Show-InstallationUI -Title $ScriptTitle -ComponentName $ComponentId -Version $Version
    & $ui.AddLog "Démarrage de l'installation du composant $ComponentId v$Version"
    & $ui.AddLog "Téléchargement du script d'installation..."
}
else {
    Write-Host "=== $ScriptTitle ===" -ForegroundColor Cyan
    Write-Host "Démarrage de l'installation du composant $ComponentId v$Version" -ForegroundColor White
    Write-Host "Téléchargement du script d'installation..." -ForegroundColor White
}

# Télécharger le script d'installation principal
try {
    Invoke-WebRequest -Uri $InstallScriptUrl -OutFile $InstallScriptPath -UseBasicParsing
    
    if ($Interactive) {
        & $ui.AddLog "Script d'installation téléchargé avec succès."
    }
    else {
        Write-Host "Script d'installation téléchargé avec succès." -ForegroundColor Green
    }
}
catch {
    $errorMessage = "Erreur lors du téléchargement du script d'installation: $_"
    
    if ($Interactive) {
        & $ui.AddLog $errorMessage
        $ui.CloseButton.Enabled = $true
        [System.Windows.Forms.Application]::DoEvents()
    }
    else {
        Write-Host $errorMessage -ForegroundColor Red
    }
    
    # Stocker le résultat en JSON pour le client web
    @{
        success = $false
        error = $errorMessage
        componentId = $ComponentId
        version = $Version
    } | ConvertTo-Json | Set-Content -Path $ResultFilePath
    
    exit 1
}

# Exécuter le script d'installation
if ($Interactive) {
    & $ui.AddLog "Exécution du script d'installation..."
    & $ui.AddLog "Arguments: ComponentId=$ComponentId, Version=$Version"
}
else {
    Write-Host "Exécution du script d'installation..." -ForegroundColor White
}

try {
    $installArgs = @{
        ComponentPackageUrl = $PackageUrl
        ComponentId = $ComponentId
        Version = $Version
    }
    
    # Ajouter le chemin racine de ProcessStudio si spécifié
    if ($ProcessStudioRoot -ne "") {
        $installArgs.Add("ProcessStudioRoot", $ProcessStudioRoot)
    }
    
    # Exécuter le script d'installation
    $result = & $InstallScriptPath @installArgs
    
    # Afficher le résultat de l'installation
    if ($result.Success) {
        $successMessage = "Installation du composant $ComponentId v$Version réussie!"
        
        if ($Interactive) {
            $ui.ProgressBar.Style = "Continuous"
            $ui.ProgressBar.Value = 100
            & $ui.AddLog $successMessage
            & $ui.AddLog "Installé dans: $($result.DestinationPath)"
            & $ui.AddLog "Log: $($result.LogFile)"
            $ui.CloseButton.Enabled = $true
            [System.Windows.Forms.Application]::DoEvents()
        }
        else {
            Write-Host $successMessage -ForegroundColor Green
            Write-Host "Installé dans: $($result.DestinationPath)" -ForegroundColor White
            Write-Host "Log: $($result.LogFile)" -ForegroundColor White
        }
    }
    else {
        $errorMessage = "Échec de l'installation: $($result.Error)"
        
        if ($Interactive) {
            $ui.ProgressBar.Style = "Continuous"
            $ui.ProgressBar.Value = 0
            & $ui.AddLog $errorMessage
            $ui.CloseButton.Enabled = $true
            [System.Windows.Forms.Application]::DoEvents()
        }
        else {
            Write-Host $errorMessage -ForegroundColor Red
        }
    }
    
    # Stocker le résultat en JSON pour le client web
    @{
        success = $result.Success
        error = $result.Error
        componentId = $ComponentId
        version = $Version
        logFile = $result.LogFile
        installId = $result.InstallId
        destinationPath = $result.DestinationPath
    } | ConvertTo-Json | Set-Content -Path $ResultFilePath
    
    # Retourner le code de sortie approprié
    if ($result.Success) {
        exit 0
    }
    else {
        exit 1
    }
}
catch {
    $errorMessage = "Erreur critique lors de l'installation: $_"
    
    if ($Interactive) {
        $ui.ProgressBar.Style = "Continuous"
        $ui.ProgressBar.Value = 0
        & $ui.AddLog $errorMessage
        $ui.CloseButton.Enabled = $true
        [System.Windows.Forms.Application]::DoEvents()
    }
    else {
        Write-Host $errorMessage -ForegroundColor Red
    }
    
    # Stocker le résultat en JSON pour le client web
    @{
        success = $false
        error = $errorMessage
        componentId = $ComponentId
        version = $Version
    } | ConvertTo-Json | Set-Content -Path $ResultFilePath
    
    exit 1
}

# En mode interactif, attendre que l'utilisateur ferme la fenêtre
if ($Interactive) {
    while ($ui.Form.Visible) {
        [System.Windows.Forms.Application]::DoEvents()
        Start-Sleep -Milliseconds 100
    }
}