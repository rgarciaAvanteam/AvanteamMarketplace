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

    public class InstallRequest
    {
        [JsonProperty("componentId")]
        public int ComponentId { get; set; }
        
        [JsonProperty("version")]
        public string Version { get; set; }
        
        [JsonProperty("packageUrl")]
        public string PackageUrl { get; set; }
        
        [JsonProperty("installId")]
        public string InstallId { get; set; }
    }

    public class InstallResponse
    {
        [JsonProperty("success")]
        public bool Success { get; set; }
        
        [JsonProperty("componentId")]
        public int ComponentId { get; set; }
        
        [JsonProperty("version")]
        public string Version { get; set; }
        
        [JsonProperty("installId")]
        public string InstallId { get; set; }
        
        [JsonProperty("destinationPath")]
        public string DestinationPath { get; set; }
        
        [JsonProperty("error")]
        public string Error { get; set; }
        
        [JsonProperty("logs")]
        public List<LogEntry> Logs { get; set; } = new List<LogEntry>();
    }

    public class LogEntry
    {
        [JsonProperty("level")]
        public string Level { get; set; }
        
        [JsonProperty("message")]
        public string Message { get; set; }
    }
}