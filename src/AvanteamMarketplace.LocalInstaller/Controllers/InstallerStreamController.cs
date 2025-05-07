using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace AvanteamMarketplace.LocalInstaller.Controllers
{
    /// <summary>
    /// Contrôleur qui fournit un streaming en temps réel des logs d'installation
    /// via Server-Sent Events (SSE)
    /// </summary>
    [ApiController]
    [Route("stream")]
    public class InstallerStreamController : ControllerBase
    {
        private readonly ILogger<InstallerStreamController> _logger;
        private static readonly Dictionary<string, List<LogMessage>> _messageQueues = new Dictionary<string, List<LogMessage>>();
        private static readonly object _lockObject = new object();

        public InstallerStreamController(ILogger<InstallerStreamController> logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// Point de terminaison SSE qui renvoie un flux en temps réel des logs pour un ID d'installation spécifique
        /// </summary>
        /// <param name="installId">ID unique de l'installation</param>
        /// <returns>Flux SSE des messages de log</returns>
        [HttpGet("{installId}")]
        public async Task GetLogStream(string installId, CancellationToken cancellationToken)
        {
            try
            {
                _logger.LogInformation($"Client connecté au flux de logs pour l'installation {installId}");
                
                // Vérifier si l'ID commence par 'uninstall-' ou 'install-'
                if (!installId.StartsWith("uninstall-") && !installId.StartsWith("install-"))
                {
                    _logger.LogWarning($"Format d'ID invalide: {installId}. Doit commencer par 'install-' ou 'uninstall-'");
                    // Ajouter un message à la queue pour indiquer l'erreur
                    AddMessageToQueue(installId, "ERROR", "Format d'ID invalide. L'opération peut ne pas fonctionner correctement.");
                }

                Response.Headers.Add("Content-Type", "text/event-stream");
                Response.Headers.Add("Cache-Control", "no-cache");
                Response.Headers.Add("Connection", "keep-alive");
                
                // En cas d'erreur CORS, ajouter des en-têtes pour permettre les requêtes Cross-Origin
                Response.Headers.Add("Access-Control-Allow-Origin", "*");
                Response.Headers.Add("Access-Control-Allow-Methods", "GET");
                Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

                // Garantir que le stream ID existe
                EnsureStreamExists(installId);

                // Ajouter un message de démarrage
                AddMessageToQueue(installId, "INFO", "Connexion au flux de logs établie");
                
                try
                {
                    // Envoyer les logs existants immédiatement
                    await SendExistingLogs(installId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Erreur lors de l'envoi des logs existants pour {installId}");
                    // Continuer malgré l'erreur - les nouveaux logs seront encore envoyés
                }

                int lastSentIndex = GetCurrentLogCount(installId);
                
                // Définir un temps maximum de connexion (10 minutes)
                var connectionTimeout = DateTime.Now.AddMinutes(10);
                
                // Envoyer un ping initial pour garder la connexion active
                await SendPing();
                
                while (!cancellationToken.IsCancellationRequested && DateTime.Now < connectionTimeout)
                {
                    try
                    {
                        // Vérifier s'il y a de nouveaux messages
                        int currentCount = GetCurrentLogCount(installId);
                        
                        if (currentCount > lastSentIndex)
                        {
                            // Envoyer les nouveaux messages
                            await SendLogsFromIndex(installId, lastSentIndex);
                            lastSentIndex = currentCount;
                        }
                        
                        // Envoyer un ping toutes les 15 secondes pour maintenir la connexion active
                        if (DateTime.Now.Second % 15 == 0)
                        {
                            await SendPing();
                            _logger.LogDebug($"Ping envoyé pour maintenir la connexion {installId} active");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Erreur dans la boucle de streaming pour {installId}");
                        // Attendre un peu plus longtemps en cas d'erreur
                        await Task.Delay(500, cancellationToken);
                    }

                    // Attendre un peu avant la prochaine vérification
                    await Task.Delay(100, cancellationToken);
                }
                
                // Envoyer un message de fermeture
                if (!cancellationToken.IsCancellationRequested)
                {
                    await SendCloseMessage("Fin de la connexion (timeout après 10 minutes)");
                }
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation($"Connexion au flux terminée par le client pour {installId}");
                // Normal lors de la fermeture de la connexion par le client
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur non gérée dans le flux SSE pour {installId}");
                try
                {
                    // Envoyer un message d'erreur au client si possible
                    AddMessageToQueue(installId, "ERROR", $"Erreur interne du serveur: {ex.Message}");
                    await SendCloseMessage("Erreur interne du serveur");
                }
                catch
                {
                    // Ignorer les erreurs supplémentaires lors de la tentative d'envoi du message d'erreur
                }
            }
        }
        
        /// <summary>
        /// Envoie un événement ping pour maintenir la connexion active
        /// </summary>
        private async Task SendPing()
        {
            try
            {
                // Ajouter un identifiant unique au ping pour éviter la mise en cache
                var pingId = Guid.NewGuid().ToString("N").Substring(0, 8);
                var pingData = $"event: ping\nid: {pingId}\ndata: {DateTime.Now:yyyy-MM-dd HH:mm:ss}\n\n";
                var buffer = Encoding.UTF8.GetBytes(pingData);
                await Response.Body.WriteAsync(buffer, 0, buffer.Length);
                await Response.Body.FlushAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Erreur lors de l'envoi du ping SSE");
            }
        }
        
        /// <summary>
        /// Envoie un message de fermeture au client
        /// </summary>
        private async Task SendCloseMessage(string reason)
        {
            try
            {
                var closeData = $"event: close\ndata: {reason}\n\n";
                var buffer = Encoding.UTF8.GetBytes(closeData);
                await Response.Body.WriteAsync(buffer, 0, buffer.Length);
                await Response.Body.FlushAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Erreur lors de l'envoi du message de fermeture SSE");
            }
        }

        /// <summary>
        /// Méthode API pour ajouter un message au flux
        /// </summary>
        [HttpPost("log")]
        public IActionResult AddLogMessage([FromBody] LogStreamRequest request)
        {
            if (string.IsNullOrEmpty(request.InstallId) || request.Message == null)
            {
                return BadRequest("InstallId et Message sont requis");
            }

            // Ajouter le message à la file d'attente
            AddMessageToQueue(request.InstallId, request.Message.Level, request.Message.Text);
            
            return Ok();
        }

        private void EnsureStreamExists(string streamId)
        {
            lock (_lockObject)
            {
                if (!_messageQueues.ContainsKey(streamId))
                {
                    _messageQueues[streamId] = new List<LogMessage>();
                }
            }
        }

        private int GetCurrentLogCount(string streamId)
        {
            lock (_lockObject)
            {
                if (_messageQueues.TryGetValue(streamId, out var queue))
                {
                    return queue.Count;
                }
                return 0;
            }
        }

        public static void AddMessageToQueue(string streamId, string level, string message)
        {
            // Ne pas ajouter de messages vides
            if (string.IsNullOrWhiteSpace(message))
            {
                return;
            }

            // Supprimer le préfixe de timestamp si présent
            if (message.Length > 20 && message.StartsWith("[") && message.Substring(0, 20).Contains("]"))
            {
                // Format probable [XX:XX:XX]
                int closeBracketPos = message.IndexOf(']');
                if (closeBracketPos > 0 && closeBracketPos < 20)
                {
                    message = message.Substring(closeBracketPos + 1).Trim();
                }
            }

            // Supprimer les préfixes de niveau si présents (pour éviter la duplication)
            string[] levelPrefixes = new[] { "[INFO]", "[ERROR]", "[WARNING]", "[SUCCESS]", "[SCRIPT]" };
            foreach (var prefix in levelPrefixes)
            {
                if (message.StartsWith(prefix))
                {
                    message = message.Substring(prefix.Length).Trim();
                    break;
                }
            }

            // Si le message est toujours vide après nettoyage, ne pas l'ajouter
            if (string.IsNullOrWhiteSpace(message))
            {
                return;
            }

            lock (_lockObject)
            {
                if (!_messageQueues.ContainsKey(streamId))
                {
                    _messageQueues[streamId] = new List<LogMessage>();
                }

                _messageQueues[streamId].Add(new LogMessage
                {
                    Level = level,
                    Text = message,
                    Timestamp = DateTime.Now
                });
            }
        }

        private async Task SendExistingLogs(string streamId)
        {
            List<LogMessage> messages;
            
            lock (_lockObject)
            {
                if (!_messageQueues.TryGetValue(streamId, out var queue))
                {
                    return;
                }
                
                messages = new List<LogMessage>(queue);
            }
            
            foreach (var message in messages)
            {
                await SendSseEvent(message);
            }
        }

        private async Task SendLogsFromIndex(string streamId, int fromIndex)
        {
            List<LogMessage> messages;
            
            lock (_lockObject)
            {
                if (!_messageQueues.TryGetValue(streamId, out var queue) || fromIndex >= queue.Count)
                {
                    return;
                }
                
                messages = queue.GetRange(fromIndex, queue.Count - fromIndex);
            }
            
            foreach (var message in messages)
            {
                await SendSseEvent(message);
            }
        }

        private async Task SendSseEvent(LogMessage message)
        {
            var data = System.Text.Json.JsonSerializer.Serialize(message);
            var buffer = Encoding.UTF8.GetBytes($"event: log\ndata: {data}\n\n");
            await Response.Body.WriteAsync(buffer, 0, buffer.Length);
            await Response.Body.FlushAsync();
        }
    }

    public class LogMessage
    {
        public string Level { get; set; }
        public string Text { get; set; }
        public DateTime Timestamp { get; set; }
    }

    public class LogStreamRequest
    {
        public string InstallId { get; set; }
        public LogMessageRequest Message { get; set; }
    }

    public class LogMessageRequest
    {
        public string Level { get; set; }
        public string Text { get; set; }
    }
}