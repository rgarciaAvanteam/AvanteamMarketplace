using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using AvanteamMarketplace.Core.Services;
using AvanteamMarketplace.Core.ViewModels;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AvanteamMarketplace.Infrastructure.Services
{
    /// <summary>
    /// Service pour l'installation des composants via PowerShell
    /// </summary>
    public class ComponentInstallerService : IComponentInstallerService
    {
        private readonly ILogger<ComponentInstallerService> _logger;
        private readonly IConfiguration _configuration;
        private readonly string _scriptsDirectory;
        private readonly string _processStudioRoot;
        
        /// <summary>
        /// Constructeur
        /// </summary>
        public ComponentInstallerService(ILogger<ComponentInstallerService> logger, IConfiguration configuration)
        {
            _logger = logger;
            _configuration = configuration;
            
            // Répertoire des scripts PowerShell
            _scriptsDirectory = configuration["Installation:ScriptsDirectory"] ?? 
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "scripts");
            
            // Répertoire racine de Process Studio
            _processStudioRoot = configuration["Installation:ProcessStudioRoot"] ?? 
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..");
            
            // S'assurer que les répertoires existent
            EnsureDirectoryExists(_scriptsDirectory);
            
            _logger.LogInformation($"Service d'installation initialisé. Scripts: {_scriptsDirectory}, Root: {_processStudioRoot}");
        }
        
        /// <summary>
        /// Exécute le script PowerShell pour installer un composant
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <param name="version">Version du composant</param>
        /// <param name="packageUrl">URL du package à télécharger</param>
        /// <param name="processStudioRoot">Répertoire racine de Process Studio (optionnel)</param>
        /// <returns>Résultat de l'installation</returns>
        public async Task<InstallationResultViewModel> InstallComponentAsync(int componentId, string version, string packageUrl, string processStudioRoot = null)
        {
            try
            {
                // Utiliser le répertoire racine spécifié ou celui par défaut
                var rootPath = !string.IsNullOrEmpty(processStudioRoot) ? processStudioRoot : _processStudioRoot;
                
                // Construire le chemin du script PowerShell
                var installScriptPath = Path.Combine(_scriptsDirectory, "install-component.ps1");
                
                if (!File.Exists(installScriptPath))
                {
                    _logger.LogError($"Script d'installation non trouvé: {installScriptPath}");
                    return new InstallationResultViewModel
                    {
                        Success = false,
                        Error = $"Script d'installation non trouvé: {installScriptPath}"
                    };
                }
                
                _logger.LogInformation($"Début de l'installation du composant {componentId} v{version} avec le script {installScriptPath}");
                
                // Générer un ID d'installation unique
                var installId = $"install-{Guid.NewGuid():N}";
                var startInfo = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-ExecutionPolicy Bypass -NoProfile -File \"{installScriptPath}\" -ComponentPackageUrl \"{packageUrl}\" -ComponentId \"{componentId}\" -Version \"{version}\" -ProcessStudioRoot \"{rootPath}\"",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };
                
                var output = new StringBuilder();
                var error = new StringBuilder();
                
                using (var process = new Process())
                {
                    process.StartInfo = startInfo;
                    
                    process.OutputDataReceived += (sender, e) =>
                    {
                        if (e.Data != null)
                        {
                            output.AppendLine(e.Data);
                            _logger.LogInformation($"[PS] {e.Data}");
                        }
                    };
                    
                    process.ErrorDataReceived += (sender, e) =>
                    {
                        if (e.Data != null)
                        {
                            error.AppendLine(e.Data);
                            _logger.LogError($"[PS-ERR] {e.Data}");
                        }
                    };
                    
                    _logger.LogInformation($"Lancement du processus PowerShell avec arguments: {startInfo.Arguments}");
                    
                    process.Start();
                    process.BeginOutputReadLine();
                    process.BeginErrorReadLine();
                    
                    await process.WaitForExitAsync();
                    
                    _logger.LogInformation($"Processus PowerShell terminé avec code: {process.ExitCode}");
                    
                    // Analyser la sortie pour trouver le chemin du log et autres informations
                    var logPath = ParseLogPath(output.ToString());
                    var destinationPath = ParseDestinationPath(output.ToString());
                    
                    if (process.ExitCode != 0 || error.Length > 0)
                    {
                        _logger.LogError($"Erreur lors de l'installation: {error}");
                        return new InstallationResultViewModel
                        {
                            Success = false,
                            Error = error.ToString(),
                            ComponentId = componentId.ToString(),
                            Version = version,
                            InstallId = installId,
                            LogFile = logPath
                        };
                    }
                    
                    return new InstallationResultViewModel
                    {
                        Success = true,
                        ComponentId = componentId.ToString(),
                        Version = version,
                        InstallId = installId,
                        LogFile = logPath,
                        DestinationPath = destinationPath
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Exception lors de l'installation du composant {componentId} v{version}");
                return new InstallationResultViewModel
                {
                    Success = false,
                    Error = ex.ToString(),
                    ComponentId = componentId.ToString(),
                    Version = version
                };
            }
        }
        
        /// <summary>
        /// Récupère les logs d'installation en temps réel
        /// </summary>
        /// <param name="installId">ID d'installation</param>
        /// <returns>Logs d'installation</returns>
        public async Task<string> GetInstallationLogsAsync(string installId)
        {
            try
            {
                // Rechercher le fichier de log correspondant à l'ID d'installation
                var logsDir = Path.Combine(_scriptsDirectory, "Logs");
                if (!Directory.Exists(logsDir))
                {
                    return "Répertoire de logs non trouvé";
                }
                
                var logFiles = Directory.GetFiles(logsDir, $"*{installId}*.log");
                if (logFiles.Length == 0)
                {
                    return "Fichier de log non trouvé pour cette installation";
                }
                
                // Lire le contenu du fichier de log
                var logContent = await File.ReadAllTextAsync(logFiles[0]);
                return logContent;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des logs pour l'installation {installId}");
                return $"Erreur lors de la récupération des logs: {ex.Message}";
            }
        }
        
        // Méthodes privées
        
        private void EnsureDirectoryExists(string directory)
        {
            if (!Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
                _logger.LogInformation($"Création du répertoire {directory}");
            }
        }
        
        private string ParseLogPath(string output)
        {
            // Essayer de trouver une ligne contenant le chemin du log
            foreach (var line in output.Split(Environment.NewLine))
            {
                if (line.Contains("Journal d'installation complet disponible dans:"))
                {
                    var parts = line.Split("Journal d'installation complet disponible dans:");
                    if (parts.Length > 1)
                    {
                        return parts[1].Trim();
                    }
                }
            }
            return null;
        }
        
        private string ParseDestinationPath(string output)
        {
            // Essayer de trouver une ligne contenant le chemin de destination
            foreach (var line in output.Split(Environment.NewLine))
            {
                if (line.Contains("Chemin de destination complet:"))
                {
                    var parts = line.Split("Chemin de destination complet:");
                    if (parts.Length > 1)
                    {
                        return parts[1].Trim();
                    }
                }
            }
            return null;
        }
    }
}