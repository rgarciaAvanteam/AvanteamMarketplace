using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization; // Ajouté pour la sérialisation JSON

namespace AvanteamMarketplace.LocalInstaller.Controllers
{
    /// <summary>
    /// Contrôleur fournissant les API d'installation et de désinstallation locale des composants
    /// </summary>
    [ApiController]
    [Route("")]
    [Produces("application/json")]
    public class InstallerController : ControllerBase
    {
        private readonly ILogger<InstallerController> _logger;
        private readonly string _rootPath;
        private readonly string _scriptsPath;
        private readonly string _logsPath;

        public InstallerController(ILogger<InstallerController> logger)
        {
            _logger = logger;
            
            // Déterminer les chemins
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            
            // Lire le chemin racine depuis appsettings.json ou depuis une variable d'environnement
            var config = new ConfigurationBuilder()
                .SetBasePath(baseDir)
                .AddJsonFile("appsettings.json", optional: true)
                .AddEnvironmentVariables()
                .Build();
            
            // Par défaut, utiliser le répertoire courant de l'API
            _rootPath = config["ProcessStudioRoot"] ?? baseDir;
            
            // Si une valeur est spécifiée mais qu'elle est relative, la convertir en chemin absolu
            if (!string.IsNullOrEmpty(_rootPath) && !Path.IsPathRooted(_rootPath))
            {
                if (baseDir.Contains("api-installer"))
                {
                    // On suppose que le chemin est relatif à la racine du site
                    var rootDir = Directory.GetParent(baseDir)?.FullName;
                    if (rootDir != null)
                    {
                        _rootPath = Path.Combine(Directory.GetParent(rootDir)?.FullName ?? rootDir, _rootPath);
                    }
                }
                else
                {
                    // Chemin relatif au répertoire de l'API
                    _rootPath = Path.Combine(baseDir, _rootPath);
                }
            }
            
            _logger.LogInformation($"Répertoire racine configuré: {_rootPath}");
            
            // Garder les chemins des scripts et logs dans le répertoire de l'API
            _scriptsPath = Path.Combine(baseDir, "scripts");
            _logsPath = Path.Combine(baseDir, "logs");
            
            // Créer les répertoires s'ils n'existent pas
            EnsureDirectoryExists(_scriptsPath);
            EnsureDirectoryExists(_logsPath);
            
            _logger.LogInformation($"API d'installation locale initialisée. Racine: {_rootPath}, Scripts: {_scriptsPath}, Logs: {_logsPath}");
        }

        /// <summary>
        /// Vérifie l'état de l'API d'installation locale
        /// </summary>
        /// <returns>Informations sur l'état de l'API, incluant les chemins configurés et les fonctionnalités disponibles</returns>
        /// <response code="200">API opérationnelle avec informations de configuration</response>
        [HttpGet("status")]
        public IActionResult GetStatus()
        {
            return Ok(new
            {
                Status = "API d'installation locale opérationnelle",
                RootPath = _rootPath,
                ScriptsPath = _scriptsPath,
                LogsPath = _logsPath,
                Timestamp = DateTime.Now,
                Features = new[] { "install", "uninstall" }
            });
        }

        /// <summary>
        /// Installe un composant à partir d'une URL de package
        /// </summary>
        /// <param name="request">Informations du composant à installer, incluant l'ID du composant, la version, l'URL du package et un ID d'installation optionnel</param>
        /// <returns>Résultat de l'opération d'installation avec logs et chemin de destination</returns>
        /// <remarks>
        /// Exemple de requête:
        /// 
        ///     POST /install
        ///     {
        ///         "componentId": 123,
        ///         "version": "1.0.0",
        ///         "packageUrl": "https://example.com/packages/component-123-1.0.0.zip",
        ///         "installId": "install-20250416-abc123"
        ///     }
        /// 
        /// </remarks>
        /// <response code="200">Installation réussie ou échec avec informations détaillées</response>
        /// <response code="400">Requête invalide</response>
        /// <response code="500">Erreur serveur lors de l'installation</response>
        [HttpPost("install")]
        public async Task<IActionResult> InstallComponent([FromBody] InstallRequest request)
        {
            try
            {
                _logger.LogInformation($"Demande d'installation reçue pour le composant {request.ComponentId} v{request.Version}");
                
                if (string.IsNullOrEmpty(request.PackageUrl))
                {
                    _logger.LogWarning("URL du package manquante dans la demande d'installation");
                    return BadRequest(new { success = false, error = "L'URL du package est requise" });
                }
                
                // Vérifier si l'URL est la valeur factice "no-package"
                if (request.PackageUrl.Contains("avanteam-online.com/no-package"))
                {
                    _logger.LogInformation($"URL factice détectée pour le composant {request.ComponentId}, recherche d'un fichier local");
                    
                    // Déterminer le chemin du répertoire des packages
                    string packagesPath = null;
                    
                    // Essayer de trouver le chemin des packages à différents endroits
                    string[] potentialPackageDirs = new string[] 
                    {
                        // Chemins relatifs à l'application LocalInstaller
                        Path.Combine(_rootPath, "packages"),
                        Path.Combine(_rootPath, "wwwroot", "packages"),
                        Path.Combine(_rootPath, "api", "wwwroot", "packages"),
                        
                        // Chemins absolus pour l'environnement de production
                        @"I:\AVANTEAM\DEV\AvanteamMarketPlaceAPI\inetpub\wwwroot\packages",
                        @"I:\AVANTEAM\DEV\AvanteamMarketplace\wwwroot\packages"
                    };
                    
                    // Trouver le premier répertoire qui existe
                    foreach (var path in potentialPackageDirs)
                    {
                        if (Directory.Exists(path))
                        {
                            packagesPath = path;
                            _logger.LogInformation($"Répertoire des packages trouvé: {packagesPath}");
                            break;
                        }
                    }
                    
                    // Si un répertoire de packages a été trouvé
                    if (!string.IsNullOrEmpty(packagesPath))
                    {
                        try
                        {
                            // Rechercher tous les fichiers ZIP dans le répertoire
                            var zipFiles = Directory.GetFiles(packagesPath, "*.zip");
                            _logger.LogInformation($"Nombre de fichiers ZIP trouvés: {zipFiles.Length}");
                            
                            // Rechercher d'abord les fichiers qui contiennent l'ID du composant
                            var componentIdStr = request.ComponentId.ToString();
                            var componentFiles = zipFiles
                                .Where(f => Path.GetFileNameWithoutExtension(f).Contains(componentIdStr))
                                .OrderByDescending(f => System.IO.File.GetLastWriteTime(f))  // Prendre le plus récent en premier
                                .ToList();
                            
                            // Si des fichiers ont été trouvés avec l'ID
                            if (componentFiles.Any())
                            {
                                var localFilePath = componentFiles.First();
                                _logger.LogInformation($"Fichier trouvé pour le composant {request.ComponentId}: {localFilePath}");
                                request.PackageUrl = $"file://{localFilePath}";
                            }
                            // Sinon, rechercher par nom de composant pour ID spécifiques
                            else if (request.ComponentId == 14)  // HishikawaDiagram
                            {
                                var ishikawaFiles = zipFiles
                                    .Where(f => Path.GetFileNameWithoutExtension(f).Contains("Ishikawa") || 
                                               Path.GetFileNameWithoutExtension(f).Contains("ishikawa") ||
                                               Path.GetFileNameWithoutExtension(f).Contains("Hishikawa") ||
                                               Path.GetFileNameWithoutExtension(f).Contains("hishikawa"))
                                    .OrderByDescending(f => System.IO.File.GetLastWriteTime(f))
                                    .ToList();
                                
                                if (ishikawaFiles.Any())
                                {
                                    var localFile = ishikawaFiles.First();
                                    _logger.LogInformation($"Fichier Ishikawa trouvé: {localFile}");
                                    request.PackageUrl = $"file://{localFile}";
                                }
                                else
                                {
                                    // Fallback sur l'URL GitHub pour HishikawaDiagram
                                    _logger.LogInformation("Utilisation de l'URL GitHub pour HishikawaDiagram");
                                    request.PackageUrl = "https://github.com/avanteam/component-HishikawaDiagram/archive/refs/heads/main.zip";
                                }
                            }
                            // Si aucun fichier n'a été trouvé, garder l'URL factice (installation échouera probablement)
                            else
                            {
                                _logger.LogWarning($"Aucun fichier trouvé pour le composant {request.ComponentId}");
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, $"Erreur lors de la recherche du fichier pour le composant {request.ComponentId}");
                        }
                    }
                    else
                    {
                        _logger.LogWarning("Aucun répertoire de packages trouvé");
                    }
                }
                
                // Générer un ID d'installation unique si non fourni
                var installId = !string.IsNullOrEmpty(request.InstallId) 
                    ? request.InstallId 
                    : $"install-{Guid.NewGuid():N}";
                
                // Créer le fichier de log pour cette installation
                var logFilePath = Path.Combine(_logsPath, $"install-{request.ComponentId}-{request.Version}-{installId}.log");
                
                // Vérifier que le script d'installation existe
                var installScriptPath = Path.Combine(_scriptsPath, "install-component.ps1");
                if (!System.IO.File.Exists(installScriptPath))
                {
                    var errorMessage = $"Script d'installation non trouvé: {installScriptPath}";
                    _logger.LogError(errorMessage);
                    
                    // Écrire dans le log d'installation spécifique
                    AppendToLog(logFilePath, "ERROR", errorMessage);
                    
                    return NotFound(new
                    {
                        success = false,
                        error = errorMessage,
                        logs = new List<LogEntry>
                        {
                            new LogEntry { level = "ERROR", message = errorMessage }
                        }
                    });
                }
                
                // Préparer les arguments pour le script PowerShell
                var arguments = $"-ExecutionPolicy Bypass -NoProfile -File \"{installScriptPath}\" " +
                                $"-ComponentPackageUrl \"{request.PackageUrl}\" " +
                                $"-ComponentId \"{request.ComponentId}\" " +
                                $"-Version \"{request.Version}\" " +
                                $"-ProcessStudioRoot \"{_rootPath}\"";
                
                _logger.LogInformation($"Lancement de PowerShell avec arguments: {arguments}");
                AppendToLog(logFilePath, "INFO", $"Lancement de l'installation du composant {request.ComponentId} v{request.Version}");
                AppendToLog(logFilePath, "INFO", $"URL du package: {request.PackageUrl}");
                AppendToLog(logFilePath, "INFO", $"Répertoire racine: {_rootPath}");
                
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
                var error = new StringBuilder();
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
                            
                            // Ajouter aux logs avec détection du niveau
                            var logLevel = "INFO";
                            var outputLine = e.Data;
                            
                            // Nettoyer la ligne si nécessaire
                            if (string.IsNullOrEmpty(outputLine))
                            {
                                outputLine = "";
                            }

                            // Détection avancée du niveau et formatage
                            if (outputLine.Contains("[ERROR]") || outputLine.Contains("ERREUR"))
                            {
                                logLevel = "ERROR";
                                // Supprimer le préfixe [ERROR] s'il existe pour éviter les doublons
                                outputLine = outputLine.Replace("[ERROR] ", "").Replace("[ERROR]", "");
                            }
                            else if (outputLine.Contains("[WARNING]") || outputLine.Contains("AVERTISSEMENT"))
                            {
                                logLevel = "WARNING";
                                // Supprimer le préfixe [WARNING] s'il existe
                                outputLine = outputLine.Replace("[WARNING] ", "").Replace("[WARNING]", "");
                            }
                            else if (outputLine.Contains("[SUCCESS]"))
                            {
                                logLevel = "SUCCESS";
                                // Supprimer le préfixe [SUCCESS] s'il existe
                                outputLine = outputLine.Replace("[SUCCESS] ", "").Replace("[SUCCESS]", "");
                            }
                            else if (outputLine.Contains("[SCRIPT]"))
                            {
                                // Faire ressortir les logs des scripts post-installation
                                logLevel = "SCRIPT";
                                // Supprimer le préfixe [SCRIPT] s'il existe
                                outputLine = outputLine.Replace("[SCRIPT] ", "").Replace("[SCRIPT]", "");
                            }
                            
                            // Ajouter un contenu par défaut si le message est vide
                            if (string.IsNullOrWhiteSpace(outputLine))
                            {
                                outputLine = "Traitement en cours...";
                            }
                            
                            // Ajouter à la liste des logs pour la réponse
                            var logEntry = new LogEntry { level = logLevel, message = outputLine };
                            output.Add(logEntry);
                            
                            // Envoyer le log immédiatement au stream en temps réel
                            try {
                                // Ne pas envoyer de lignes vides au stream
                                if (!string.IsNullOrWhiteSpace(outputLine))
                                {
                                    _logger.LogDebug($"Envoi au stream: [{logLevel}] {outputLine}");
                                    
                                    // Utiliser le nouveau contrôleur de streaming pour envoyer les logs en temps réel
                                    InstallerStreamController.AddMessageToQueue(
                                        request.InstallId ?? installId,
                                        logLevel,
                                        outputLine
                                    );
                                }
                            }
                            catch (Exception ex) { 
                                _logger.LogWarning($"Erreur lors de l'envoi au stream: {ex.Message}");
                            }
                            
                            // Écrire dans le fichier de log
                            AppendToLog(logFilePath, logLevel, outputLine);
                            
                            // Extraire des informations importantes
                            if (e.Data.Contains("Chemin de destination complet:"))
                            {
                                var parts = e.Data.Split("Chemin de destination complet:");
                                if (parts.Length > 1)
                                {
                                    destinationPath = parts[1].Trim();
                                }
                            }
                            
                            // Détection spécifique des sections de script post-installation
                            if (e.Data.Contains("DÉBUT DU SCRIPT POST-INSTALLATION:") || 
                                e.Data.Contains("======================================================================"))
                            {
                                // Ajouter un marqueur spécial pour bien distinguer les sections de script
                                output.Add(new LogEntry { level = "SCRIPT_SECTION", message = e.Data });
                            }
                        }
                    };
                    
                    process.ErrorDataReceived += (sender, e) =>
                    {
                        if (e.Data != null)
                        {
                            _logger.LogError($"[PS-ERR] {e.Data}");
                            error.AppendLine(e.Data);
                            
                            // Ajouter à la liste des logs pour la réponse
                            output.Add(new LogEntry { level = "ERROR", message = e.Data });
                            
                            // Écrire dans le fichier de log
                            AppendToLog(logFilePath, "ERROR", e.Data);
                        }
                    };
                    
                    _logger.LogInformation("Démarrage du processus PowerShell");
                    process.Start();
                    process.BeginOutputReadLine();
                    process.BeginErrorReadLine();
                    
                    // Attendre la fin du processus (avec timeout de 10 minutes)
                    var cancellationToken = new CancellationTokenSource(TimeSpan.FromMinutes(10)).Token;
                    var processCompletionTask = process.WaitForExitAsync(cancellationToken);
                    
                    try
                    {
                        await processCompletionTask;
                    }
                    catch (OperationCanceledException)
                    {
                        // Si le processus n'a pas terminé dans le temps imparti, le tuer
                        try
                        {
                            process.Kill();
                            var timeoutError = "L'installation a été annulée car elle a dépassé le délai maximal (10 minutes)";
                            _logger.LogError(timeoutError);
                            AppendToLog(logFilePath, "ERROR", timeoutError);
                            output.Add(new LogEntry { level = "ERROR", message = timeoutError });
                            error.AppendLine(timeoutError);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Erreur lors de la tentative d'arrêt du processus après timeout");
                        }
                    }
                    
                    
                    var success = process.ExitCode == 0 && error.Length == 0;
                    
                    _logger.LogInformation($"Installation terminée avec code: {process.ExitCode}, Succès: {success}");
                    AppendToLog(logFilePath, success ? "SUCCESS" : "ERROR", $"Installation terminée avec code: {process.ExitCode}, Succès: {success}");
                    
                    if (success)
                    {
                        AppendToLog(logFilePath, "SUCCESS", "Installation réussie!");
                    }
                    else
                    {
                        AppendToLog(logFilePath, "ERROR", $"Échec de l'installation: {error}");
                    }
                    
                    // Préparer la réponse
                    // IMPORTANT: Nous utilisons un sérialiseur personnalisé pour assurer la compatibilité camelCase avec JavaScript
                    var serializerSettings = new JsonSerializerSettings 
                    {
                        ContractResolver = new CamelCasePropertyNamesContractResolver(),
                        Formatting = Formatting.Indented
                    };
                    
                    // Traitement additionnel des logs pour assurer qu'ils sont visibles dans l'UI
                    // Utilisation de camelCase pour les propriétés JSON
                    var processedLogs = output.Select(log => new LogEntry 
                    { 
                        level = log.level, // Utiliser explicitement la casse camelCase
                        message = log.message
                    }).ToList();
                    
                    // Ajouter un log de diagnostic
                    processedLogs.Add(new LogEntry 
                    { 
                        level = "SCRIPT", 
                        message = "-- Log de diagnostic: " + processedLogs.Count + " logs générés --" 
                    });
                    
                    var result = new 
                    {
                        success = success, // Utiliser explicitement la casse camelCase
                        componentId = request.ComponentId,
                        version = request.Version,
                        installId = installId,
                        logs = processedLogs, // Utiliser logs traités
                        destinationPath = destinationPath,
                        logFile = logFilePath
                    };
                    
                    // Journalisation détaillée pour le débogage 
                    _logger.LogInformation($"Nombre de logs capturés: {processedLogs.Count}");
                    _logger.LogInformation($"Types de logs: {string.Join(", ", processedLogs.Select(l => l.level).Distinct().ToArray())}");
                    
                    // Journaliser un exemple de log
                    if (processedLogs.Any())
                    {
                        _logger.LogInformation($"Exemple de log: Level={processedLogs[0].level}, Message={processedLogs[0].message.Substring(0, Math.Min(50, processedLogs[0].message.Length))}...");
                    }
                    
                    // Cette partie est modifiée pour utiliser un objet dynamique (le compilateur ne connaît pas la propriété error)
                    if (!success)
                    {
                        // Stocker l'erreur dans le dictionnaire
                        var resultDict = new Dictionary<string, object>(result.GetType()
                            .GetProperties()
                            .ToDictionary(p => p.Name, p => p.GetValue(result, null)));
                        
                        resultDict["error"] = error.Length > 0 ? error.ToString() : "Une erreur est survenue lors de l'installation";
                        
                        // Sérialiser manuellement avec les bons paramètres
                        var json = JsonConvert.SerializeObject(resultDict, serializerSettings);
                        return Content(json, "application/json");
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
                        new LogEntry { level = "ERROR", message = $"Exception: {ex.Message}" }
                    }
                });
            }
        }
        
        /// <summary>
        /// Désinstalle un composant présent sur le serveur Process Studio
        /// </summary>
        /// <param name="request">Informations du composant à désinstaller, incluant l'ID du composant, l'option force et un ID de désinstallation optionnel</param>
        /// <returns>Résultat de l'opération de désinstallation avec logs et chemin de sauvegarde</returns>
        /// <remarks>
        /// Exemple de requête:
        /// 
        ///     POST /uninstall
        ///     {
        ///         "componentId": 123,
        ///         "force": false,
        ///         "uninstallId": "uninstall-20250416-abc123"
        ///     }
        /// 
        /// </remarks>
        /// <response code="200">Désinstallation réussie ou échec avec informations détaillées</response>
        /// <response code="400">Requête invalide</response>
        /// <response code="500">Erreur serveur lors de la désinstallation</response>
        [HttpPost("uninstall")]
        public async Task<IActionResult> UninstallComponent([FromBody] UninstallRequest request)
        {
            try
            {
                _logger.LogInformation($"Demande de désinstallation reçue pour le composant {request.ComponentId}");
                
                // Générer un ID de désinstallation unique si non fourni
                var uninstallId = !string.IsNullOrEmpty(request.UninstallId) 
                    ? request.UninstallId 
                    : $"uninstall-{Guid.NewGuid():N}";
                
                // Créer le fichier de log pour cette désinstallation
                var logFilePath = Path.Combine(_logsPath, $"uninstall-{request.ComponentId}-{uninstallId}.log");
                
                // Vérifier que le script de désinstallation existe
                var uninstallScriptPath = Path.Combine(_scriptsPath, "uninstall-component.ps1");
                if (!System.IO.File.Exists(uninstallScriptPath))
                {
                    var errorMessage = $"Script de désinstallation non trouvé: {uninstallScriptPath}";
                    _logger.LogError(errorMessage);
                    
                    // Écrire dans le log de désinstallation spécifique
                    AppendToLog(logFilePath, "ERROR", errorMessage);
                    
                    return NotFound(new
                    {
                        success = false,
                        error = errorMessage,
                        logs = new List<LogEntry>
                        {
                            new LogEntry { level = "ERROR", message = errorMessage }
                        }
                    });
                }
                
                // Préparer les arguments pour le script PowerShell
                var arguments = $"-ExecutionPolicy Bypass -NoProfile -File \"{uninstallScriptPath}\" " +
                               $"-ComponentId \"{request.ComponentId}\" " +
                               $"-ProcessStudioRoot \"{_rootPath}\"";
                
                // Ajouter le paramètre Force si nécessaire
                if (request.Force)
                {
                    arguments += " -Force";
                }
                
                _logger.LogInformation($"Lancement de PowerShell avec arguments: {arguments}");
                AppendToLog(logFilePath, "INFO", $"Lancement de la désinstallation du composant {request.ComponentId}");
                AppendToLog(logFilePath, "INFO", $"Répertoire racine: {_rootPath}");
                
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
                var error = new StringBuilder();
                var backupPath = "";
                
                // Exécuter le script PowerShell
                using (var process = new Process())
                {
                    process.StartInfo = startInfo;
                    
                    process.OutputDataReceived += (sender, e) =>
                    {
                        if (e.Data != null)
                        {
                            _logger.LogInformation($"[PS] {e.Data}");
                            
                            // Ajouter aux logs avec détection du niveau
                            var logLevel = "INFO";
                            var outputLine = e.Data;
                            
                            // Nettoyer la ligne si nécessaire
                            if (string.IsNullOrEmpty(outputLine))
                            {
                                outputLine = "";
                            }

                            // Détection avancée du niveau et formatage
                            if (outputLine.Contains("[ERROR]") || outputLine.Contains("ERREUR"))
                            {
                                logLevel = "ERROR";
                                // Supprimer le préfixe [ERROR] s'il existe pour éviter les doublons
                                outputLine = outputLine.Replace("[ERROR] ", "").Replace("[ERROR]", "");
                            }
                            else if (outputLine.Contains("[WARNING]") || outputLine.Contains("AVERTISSEMENT"))
                            {
                                logLevel = "WARNING";
                                // Supprimer le préfixe [WARNING] s'il existe
                                outputLine = outputLine.Replace("[WARNING] ", "").Replace("[WARNING]", "");
                            }
                            else if (outputLine.Contains("[SUCCESS]"))
                            {
                                logLevel = "SUCCESS";
                                // Supprimer le préfixe [SUCCESS] s'il existe
                                outputLine = outputLine.Replace("[SUCCESS] ", "").Replace("[SUCCESS]", "");
                            }
                            else if (outputLine.Contains("[SCRIPT]"))
                            {
                                // Faire ressortir les logs des scripts post-installation
                                logLevel = "SCRIPT";
                                // Supprimer le préfixe [SCRIPT] s'il existe
                                outputLine = outputLine.Replace("[SCRIPT] ", "").Replace("[SCRIPT]", "");
                            }
                            
                            // Ajouter un contenu par défaut si le message est vide
                            if (string.IsNullOrWhiteSpace(outputLine))
                            {
                                outputLine = "Traitement en cours...";
                            }
                            
                            // Ajouter à la liste des logs pour la réponse
                            output.Add(new LogEntry { level = logLevel, message = outputLine });
                            
                            // Écrire dans le fichier de log
                            AppendToLog(logFilePath, logLevel, outputLine);
                            
                            // Extraire des informations importantes
                            if (e.Data.Contains("Création d'une sauvegarde dans:"))
                            {
                                var parts = e.Data.Split("Création d'une sauvegarde dans:");
                                if (parts.Length > 1)
                                {
                                    backupPath = parts[1].Trim();
                                }
                            }
                            
                            // Détection spécifique des sections de script post-uninstallation
                            if (e.Data.Contains("DÉBUT DU SCRIPT POST-DÉSINSTALLATION:") || 
                                e.Data.Contains("======================================================================"))
                            {
                                // Ajouter un marqueur spécial pour bien distinguer les sections de script
                                output.Add(new LogEntry { level = "SCRIPT_SECTION", message = e.Data });
                            }
                        }
                    };
                    
                    process.ErrorDataReceived += (sender, e) =>
                    {
                        if (e.Data != null)
                        {
                            _logger.LogError($"[PS-ERR] {e.Data}");
                            error.AppendLine(e.Data);
                            
                            // Ajouter à la liste des logs pour la réponse
                            output.Add(new LogEntry { level = "ERROR", message = e.Data });
                            
                            // Écrire dans le fichier de log
                            AppendToLog(logFilePath, "ERROR", e.Data);
                        }
                    };
                    
                    _logger.LogInformation("Démarrage du processus PowerShell");
                    process.Start();
                    process.BeginOutputReadLine();
                    process.BeginErrorReadLine();
                    
                    // Attendre la fin du processus (avec timeout de 5 minutes)
                    var cancellationToken = new CancellationTokenSource(TimeSpan.FromMinutes(5)).Token;
                    var processCompletionTask = process.WaitForExitAsync(cancellationToken);
                    
                    try
                    {
                        await processCompletionTask;
                    }
                    catch (OperationCanceledException)
                    {
                        // Si le processus n'a pas terminé dans le temps imparti, le tuer
                        try
                        {
                            process.Kill();
                            var timeoutError = "La désinstallation a été annulée car elle a dépassé le délai maximal (5 minutes)";
                            _logger.LogError(timeoutError);
                            AppendToLog(logFilePath, "ERROR", timeoutError);
                            output.Add(new LogEntry { level = "ERROR", message = timeoutError });
                            error.AppendLine(timeoutError);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Erreur lors de la tentative d'arrêt du processus après timeout");
                        }
                    }
                    
                    var success = process.ExitCode == 0 && error.Length == 0;
                    
                    _logger.LogInformation($"Désinstallation terminée avec code: {process.ExitCode}, Succès: {success}");
                    AppendToLog(logFilePath, success ? "SUCCESS" : "ERROR", $"Désinstallation terminée avec code: {process.ExitCode}, Succès: {success}");
                    
                    if (success)
                    {
                        AppendToLog(logFilePath, "SUCCESS", "Désinstallation réussie!");
                    }
                    else
                    {
                        AppendToLog(logFilePath, "ERROR", $"Échec de la désinstallation: {error}");
                    }
                    
                    // Préparer la réponse
                    var result = new UninstallResponse
                    {
                        Success = success,
                        ComponentId = request.ComponentId,
                        UninstallId = uninstallId,
                        Logs = output,
                        BackupPath = backupPath,
                        LogFile = logFilePath
                    };
                    
                    if (!success)
                    {
                        result.Error = error.Length > 0 ? error.ToString() : "Une erreur est survenue lors de la désinstallation";
                    }
                    
                    return Ok(result);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Exception lors de la désinstallation du composant {request.ComponentId}");
                
                return StatusCode(500, new
                {
                    success = false,
                    error = $"Erreur serveur: {ex.Message}",
                    logs = new List<LogEntry>
                    {
                        new LogEntry { level = "ERROR", message = $"Exception: {ex.Message}" }
                    }
                });
            }
        }
        
        private void EnsureDirectoryExists(string directory)
        {
            if (!Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
                _logger.LogInformation($"Répertoire créé: {directory}");
            }
        }
        
        private void AppendToLog(string logFilePath, string level, string message)
        {
            try
            {
                // Créer le répertoire parent si nécessaire
                var logDir = Path.GetDirectoryName(logFilePath);
                if (!Directory.Exists(logDir))
                {
                    Directory.CreateDirectory(logDir);
                }
                
                // Ajouter l'entrée au log
                var logEntry = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [{level}] {message}{Environment.NewLine}";
                System.IO.File.AppendAllText(logFilePath, logEntry);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de l'écriture dans le fichier de log {logFilePath}");
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
        
        [JsonProperty("logFile")]
        public string LogFile { get; set; }
    }
    
    public class UninstallRequest
    {
        [JsonProperty("componentId")]
        public int ComponentId { get; set; }
        
        [JsonProperty("force")]
        public bool Force { get; set; }
        
        [JsonProperty("uninstallId")]
        public string UninstallId { get; set; }
    }
    
    public class UninstallResponse
    {
        [JsonProperty("success")]
        public bool Success { get; set; }
        
        [JsonProperty("componentId")]
        public int ComponentId { get; set; }
        
        [JsonProperty("uninstallId")]
        public string UninstallId { get; set; }
        
        [JsonProperty("backupPath")]
        public string BackupPath { get; set; }
        
        [JsonProperty("error")]
        public string Error { get; set; }
        
        [JsonProperty("logs")]
        public List<LogEntry> Logs { get; set; } = new List<LogEntry>();
        
        [JsonProperty("logFile")]
        public string LogFile { get; set; }
    }

    public class LogEntry
    {
        // Changement de la casse des propriétés pour utiliser le style camelCase de JavaScript
        // [JsonProperty] n'est plus nécessaire car nous utilisons CamelCasePropertyNamesContractResolver
        public string level { get; set; }
        
        public string message { get; set; }
        
        /// <summary>
        /// Retourne true si ce log est une sortie de script post-installation
        /// </summary>
        public bool isScriptOutput => level == "SCRIPT";
        
        /// <summary>
        /// Constructeur par défaut
        /// </summary>
        public LogEntry() { }
        
        /// <summary>
        /// Crée une entrée de log avec le niveau et message spécifiés
        /// </summary>
        public LogEntry(string level, string message)
        {
            this.level = level;
            this.message = message;
        }
    }
}