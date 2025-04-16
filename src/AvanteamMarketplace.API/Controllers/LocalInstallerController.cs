using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using System.Diagnostics;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace AvanteamMarketplace.API.Controllers
{
    /// <summary>
    /// Contrôleur pour l'installation locale de composants dans Process Studio
    /// </summary>
    /// <remarks>
    /// Ce contrôleur doit être copié dans l'application Process Studio.
    /// Il fournit un endpoint local pour installer les composants du marketplace.
    /// Le chemin de l'API est /Custom/MarketPlace/api/install
    /// </remarks>
    [ApiController]
    [Route("Custom/MarketPlace/api")]
    public class LocalInstallerController : ControllerBase
    {
        private readonly ILogger<LocalInstallerController> _logger;
        private readonly string _rootPath;
        private readonly string _scriptsPath;

        public LocalInstallerController(ILogger<LocalInstallerController> logger)
        {
            _logger = logger;
            
            // Déterminer le répertoire racine de l'application
            _rootPath = AppDomain.CurrentDomain.BaseDirectory;
            _scriptsPath = Path.Combine(_rootPath, "Custom", "MarketPlace", "scripts");
            
            _logger.LogInformation($"API d'installation locale initialisée. Racine: {_rootPath}, Scripts: {_scriptsPath}");
        }

        /// <summary>
        /// Installe un composant dans Process Studio
        /// </summary>
        /// <param name="request">Informations du composant à installer (ID, version, URL du package)</param>
        /// <returns>Résultat de l'installation avec logs et statut</returns>
        /// <response code="200">Installation terminée (réussie ou échouée) avec logs détaillés</response>
        /// <response code="400">Si l'URL du package est manquante</response>
        /// <response code="404">Si le script d'installation n'est pas trouvé</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        /// <remarks>
        /// Ce endpoint est appelé par le client pour installer un composant téléchargé du Marketplace.
        /// Il exécute le script PowerShell d'installation qui gère le téléchargement et l'installation
        /// du package dans Process Studio.
        /// 
        /// Exemple de requête:
        /// ```json
        /// {
        ///   "componentId": 123,
        ///   "version": "1.0.0",
        ///   "packageUrl": "https://example.com/packages/component-123-1.0.0.zip",
        ///   "installId": "install-20250416-abc123"
        /// }
        /// ```
        /// </remarks>
        [HttpPost("install")]
        public async Task<IActionResult> InstallComponent([FromBody] InstallRequest request)
        {
            try
            {
                _logger.LogInformation($"Demande d'installation reçue pour le composant {request.ComponentId} v{request.Version}");
                
                if (string.IsNullOrEmpty(request.PackageUrl))
                {
                    return BadRequest(new { success = false, error = "L'URL du package est requise" });
                }
                
                // Vérifier que le script d'installation existe
                var installScriptPath = Path.Combine(_scriptsPath, "install-component.ps1");
                if (!System.IO.File.Exists(installScriptPath))
                {
                    _logger.LogError($"Script d'installation non trouvé: {installScriptPath}");
                    return NotFound(new
                    {
                        success = false,
                        error = $"Script d'installation non trouvé: {installScriptPath}"
                    });
                }
                
                // Préparer les arguments pour le script PowerShell
                var arguments = $"-ExecutionPolicy Bypass -NoProfile -File \"{installScriptPath}\" " +
                                $"-ComponentPackageUrl \"{request.PackageUrl}\" " +
                                $"-ComponentId \"{request.ComponentId}\" " +
                                $"-Version \"{request.Version}\" " +
                                $"-ProcessStudioRoot \"{_rootPath}\"";
                
                // Configurer le processus PowerShell
                var startInfo = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = arguments,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };
                
                var output = new List<LogEntry>();
                var error = "";
                var destinationPath = "";
                
                // Exécuter le script PowerShell
                using (var process = new Process())
                {
                    process.StartInfo = startInfo;
                    
                    process.OutputDataReceived += (sender, e) =>
                    {
                        if (e.Data != null)
                        {
                            _logger.LogInformation($"[PS] {e.Data}");
                            
                            // Ajouter aux logs avec détection du niveau et traitement de certaines informations
                            var logLevel = "INFO";
                            if (e.Data.Contains("[ERROR]") || e.Data.Contains("ERREUR"))
                            {
                                logLevel = "ERROR";
                            }
                            else if (e.Data.Contains("[WARNING]") || e.Data.Contains("AVERTISSEMENT"))
                            {
                                logLevel = "WARNING";
                            }
                            else if (e.Data.Contains("[SUCCESS]"))
                            {
                                logLevel = "SUCCESS";
                            }
                            
                            output.Add(new LogEntry { Level = logLevel, Message = e.Data });
                            
                            // Essayer de capturer le chemin de destination
                            if (e.Data.Contains("Chemin de destination complet:"))
                            {
                                var parts = e.Data.Split("Chemin de destination complet:");
                                if (parts.Length > 1)
                                {
                                    destinationPath = parts[1].Trim();
                                }
                            }
                        }
                    };
                    
                    process.ErrorDataReceived += (sender, e) =>
                    {
                        if (e.Data != null)
                        {
                            _logger.LogError($"[PS-ERR] {e.Data}");
                            error += e.Data + Environment.NewLine;
                            output.Add(new LogEntry { Level = "ERROR", Message = e.Data });
                        }
                    };
                    
                    process.Start();
                    process.BeginOutputReadLine();
                    process.BeginErrorReadLine();
                    
                    await process.WaitForExitAsync();
                    
                    var success = process.ExitCode == 0 && string.IsNullOrEmpty(error);
                    
                    // Préparer la réponse
                    var result = new InstallResponse
                    {
                        Success = success,
                        ComponentId = request.ComponentId,
                        Version = request.Version,
                        InstallId = request.InstallId,
                        Logs = output,
                        DestinationPath = destinationPath
                    };
                    
                    if (!success)
                    {
                        result.Error = !string.IsNullOrEmpty(error) ? error : "Une erreur est survenue lors de l'installation";
                    }
                    
                    return Ok(result);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Exception lors de l'installation du composant {request.ComponentId}");
                
                return StatusCode(500, new
                {
                    success = false,
                    error = $"Erreur serveur: {ex.Message}",
                    logs = new List<LogEntry>
                    {
                        new LogEntry { Level = "ERROR", Message = $"Exception: {ex.Message}" }
                    }
                });
            }
        }
    }

    /// <summary>
    /// Représente une demande d'installation de composant
    /// </summary>
    public class InstallRequest
    {
        /// <summary>
        /// Identifiant unique du composant à installer
        /// </summary>
        [JsonProperty("componentId")]
        public int ComponentId { get; set; }
        
        /// <summary>
        /// Version du composant à installer
        /// </summary>
        [JsonProperty("version")]
        public string Version { get; set; }
        
        /// <summary>
        /// URL de téléchargement du package du composant
        /// </summary>
        [JsonProperty("packageUrl")]
        public string PackageUrl { get; set; }
        
        /// <summary>
        /// Identifiant unique de l'opération d'installation (généré automatiquement si non fourni)
        /// </summary>
        [JsonProperty("installId")]
        public string InstallId { get; set; }
    }

    /// <summary>
    /// Représente le résultat d'une opération d'installation de composant
    /// </summary>
    public class InstallResponse
    {
        /// <summary>
        /// Indique si l'installation a réussi
        /// </summary>
        [JsonProperty("success")]
        public bool Success { get; set; }
        
        /// <summary>
        /// Identifiant du composant installé
        /// </summary>
        [JsonProperty("componentId")]
        public int ComponentId { get; set; }
        
        /// <summary>
        /// Version du composant installé
        /// </summary>
        [JsonProperty("version")]
        public string Version { get; set; }
        
        /// <summary>
        /// Identifiant unique de l'opération d'installation
        /// </summary>
        [JsonProperty("installId")]
        public string InstallId { get; set; }
        
        /// <summary>
        /// Chemin où le composant a été installé
        /// </summary>
        [JsonProperty("destinationPath")]
        public string DestinationPath { get; set; }
        
        /// <summary>
        /// Message d'erreur en cas d'échec
        /// </summary>
        [JsonProperty("error")]
        public string Error { get; set; }
        
        /// <summary>
        /// Journal détaillé de l'installation
        /// </summary>
        [JsonProperty("logs")]
        public List<LogEntry> Logs { get; set; } = new List<LogEntry>();
    }

    /// <summary>
    /// Représente une entrée du journal d'installation
    /// </summary>
    public class LogEntry
    {
        /// <summary>
        /// Niveau de l'entrée (INFO, WARNING, ERROR, SUCCESS)
        /// </summary>
        [JsonProperty("level")]
        public string Level { get; set; }
        
        /// <summary>
        /// Message de l'entrée
        /// </summary>
        [JsonProperty("message")]
        public string Message { get; set; }
    }
}