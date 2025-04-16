using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using AvanteamMarketplace.Core.Services;
using AvanteamMarketplace.Core.ViewModels;
using Microsoft.Extensions.Logging;
using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using System.IO;
using AvanteamMarketplace.API.Authentication;
using Microsoft.Extensions.Configuration;

namespace AvanteamMarketplace.API.Controllers
{
    /// <summary>
    /// Contrôleur pour l'API client du Marketplace Avanteam
    /// </summary>
    /// <remarks>
    /// Ce contrôleur fournit l'ensemble des endpoints permettant aux applications clientes 
    /// (Process Studio) d'interagir avec le Marketplace, notamment pour :
    /// - Obtenir la liste des composants compatibles
    /// - Télécharger des composants
    /// - Installer des composants
    /// - Signaler l'installation d'un composant
    /// </remarks>
    [ApiController]
    [Route("api/marketplace")]
    [Authorize(AuthenticationSchemes = "ApiKey")]
    [Produces("application/json")]
    [Tags("Client API")]
    public class MarketplaceController : ControllerBase
    {
        private readonly IMarketplaceService _marketplaceService;
        private readonly IApiKeyValidator _apiKeyValidator;
        private readonly IProcessStudioVersionDetector _versionDetector;
        private readonly IComponentInstallerService _installerService;
        private readonly ILogger<MarketplaceController> _logger;
        private readonly IConfiguration _configuration;

        public MarketplaceController(
            IMarketplaceService marketplaceService,
            IApiKeyValidator apiKeyValidator,
            IProcessStudioVersionDetector versionDetector,
            IComponentInstallerService installerService,
            IConfiguration configuration,
            ILogger<MarketplaceController> logger)
        {
            _marketplaceService = marketplaceService;
            _apiKeyValidator = apiKeyValidator;
            _versionDetector = versionDetector;
            _installerService = installerService;
            _configuration = configuration;
            _logger = logger;
        }

        /// <summary>
        /// Récupère les composants compatibles avec la version de la plateforme du client
        /// </summary>
        /// <param name="clientId">Identifiant unique du client Process Studio (généralement le GUID d'installation)</param>
        /// <param name="version">Version de la plateforme Process Studio du client (format X.Y.Z)</param>
        /// <returns>Liste des composants compatibles avec la version spécifiée</returns>
        /// <response code="200">Retourne la liste des composants compatibles</response>
        /// <response code="400">Si la version n'est pas spécifiée</response>
        /// <response code="401">Si l'authentification a échoué</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        [HttpGet("components/compatible")]
        [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ComponentsViewModel))]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<ComponentsViewModel>> GetCompatibleComponents(
            [FromQuery] string clientId,
            [FromQuery] string version)
        {
            try
            {
                _logger.LogInformation($"Récupération des composants compatibles pour le client {clientId} avec la version {version}");
                
                if (string.IsNullOrEmpty(version))
                {
                    return BadRequest("La version de la plateforme est requise");
                }
                
                // Enregistrer la clé API si elle n'existe pas déjà
                if (!string.IsNullOrEmpty(clientId))
                {
                    var apiKey = HttpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                    if (!string.IsNullOrEmpty(apiKey))
                    {
                        // Récupérer l'URL de base à partir de l'en-tête Referer ou une valeur par défaut
                        string baseUrl = Request.Headers["Referer"].ToString();
                        if (string.IsNullOrEmpty(baseUrl))
                        {
                            // Utiliser l'origine comme fallback
                            baseUrl = Request.Headers["Origin"].ToString();
                        }
                        
                        await _apiKeyValidator.RegisterApiKeyAsync(apiKey, clientId, baseUrl);
                    }
                }
                
                var result = await _marketplaceService.GetCompatibleComponentsAsync(clientId, version);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des composants compatibles pour le client {clientId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération des composants" });
            }
        }

        /// <summary>
        /// Récupère les mises à jour disponibles pour les composants du client
        /// </summary>
        /// <param name="clientId">Identifiant unique du client Process Studio</param>
        /// <param name="version">Version de la plateforme Process Studio du client</param>
        /// <returns>Liste des composants avec des mises à jour disponibles</returns>
        /// <response code="200">Retourne la liste des mises à jour disponibles</response>
        /// <response code="400">Si la version n'est pas spécifiée</response>
        /// <response code="401">Si l'authentification a échoué</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        /// <remarks>
        /// Cet endpoint compare les versions installées par le client avec les dernières versions
        /// disponibles dans le Marketplace et retourne uniquement les composants ayant des mises à jour.
        /// </remarks>
        [HttpGet("components/updates")]
        [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ComponentsViewModel))]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<ComponentsViewModel>> GetUpdatedComponents(
            [FromQuery] string clientId,
            [FromQuery] string version)
        {
            try
            {
                _logger.LogInformation($"Récupération des mises à jour pour le client {clientId} avec la version {version}");
                
                if (string.IsNullOrEmpty(version))
                {
                    return BadRequest("La version de la plateforme est requise");
                }
                
                var result = await _marketplaceService.GetUpdatesForClientAsync(clientId, version);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des mises à jour pour le client {clientId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération des mises à jour" });
            }
        }

        /// <summary>
        /// Récupère les composants qui nécessitent une version plus récente de la plateforme
        /// </summary>
        /// <param name="clientId">Identifiant unique du client Process Studio</param>
        /// <param name="version">Version de la plateforme Process Studio du client</param>
        /// <returns>Liste des composants qui nécessitent une version plus récente</returns>
        /// <response code="200">Retourne la liste des composants futurs</response>
        /// <response code="400">Si la version n'est pas spécifiée</response>
        /// <response code="401">Si l'authentification a échoué</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        /// <remarks>
        /// Cette méthode retourne les composants dont la version minimale requise est supérieure
        /// à la version actuelle du client. Cela permet d'informer les utilisateurs des
        /// composants qu'ils pourront installer après une mise à jour de Process Studio.
        /// </remarks>
        [HttpGet("components/future")]
        [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ComponentsViewModel))]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<ComponentsViewModel>> GetFutureComponents(
            [FromQuery] string clientId,
            [FromQuery] string version)
        {
            try
            {
                _logger.LogInformation($"Récupération des composants futurs pour le client {clientId} avec la version {version}");
                
                if (string.IsNullOrEmpty(version))
                {
                    return BadRequest("La version de la plateforme est requise");
                }
                
                var result = await _marketplaceService.GetFutureComponentsAsync(clientId, version);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des composants futurs pour le client {clientId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération des composants" });
            }
        }

        /// <summary>
        /// Récupère les détails d'un composant spécifique
        /// </summary>
        /// <param name="componentId">ID du composant à récupérer</param>
        /// <returns>Détails du composant</returns>
        /// <response code="200">Retourne les détails du composant</response>
        /// <response code="401">Si l'authentification a échoué</response>
        /// <response code="404">Si le composant n'existe pas</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        [HttpGet("components/{componentId}")]
        [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ComponentDetailViewModel))]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<ComponentDetailViewModel>> GetComponentDetail(int componentId)
        {
            try
            {
                _logger.LogInformation($"Récupération des détails du composant {componentId}");
                
                var component = await _marketplaceService.GetComponentDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });
                    
                return Ok(component);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des détails du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération des détails du composant" });
            }
        }
        
        /// <summary>
        /// Vérifie si une mise à jour est disponible pour un composant installé
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <param name="clientId">Identifiant du client</param>
        /// <param name="installedVersion">Version actuellement installée</param>
        /// <param name="platformVersion">Version de Process Studio du client</param>
        /// <returns>Informations sur la mise à jour disponible</returns>
        [HttpGet("components/{componentId}/update-check")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<ComponentUpdateInfo>> CheckForUpdate(
            int componentId, 
            [FromQuery] string clientId, 
            [FromQuery] string installedVersion, 
            [FromQuery] string platformVersion)
        {
            try
            {
                if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(installedVersion) || string.IsNullOrEmpty(platformVersion))
                {
                    return BadRequest(new { error = "Les paramètres clientId, installedVersion et platformVersion sont obligatoires" });
                }
                
                var updateInfo = await _marketplaceService.CheckForUpdateAsync(componentId, clientId, installedVersion, platformVersion);
                
                if (updateInfo == null)
                {
                    return NotFound(new { message = "Aucune mise à jour disponible" });
                }
                
                return Ok(updateInfo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la vérification des mises à jour pour le composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la vérification des mises à jour" });
            }
        }

        /// <summary>
        /// Récupère le fichier README d'un composant au format HTML
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <returns>Contenu HTML du README du composant</returns>
        /// <response code="200">Retourne le contenu HTML du README</response>
        /// <response code="401">Si l'authentification a échoué</response>
        /// <response code="404">Si le composant ou le README n'existe pas</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        /// <remarks>
        /// Cette méthode retourne la documentation du composant au format HTML,
        /// générée à partir du fichier README.md du composant.
        /// </remarks>
        [HttpGet("components/{componentId}/readme")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<string>> GetComponentReadme(int componentId)
        {
            try
            {
                _logger.LogInformation($"Récupération du README du composant {componentId}");
                
                var readme = await _marketplaceService.GetComponentReadmeAsync(componentId);
                if (readme == null)
                    return NotFound(new { error = "README non trouvé" });
                    
                return Ok(new { ReadmeHtml = readme });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération du README du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération du README" });
            }
        }
        
        /// <summary>
        /// Récupère l'icône d'un composant
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <returns>Fichier image SVG de l'icône du composant</returns>
        /// <response code="200">Retourne l'icône du composant</response>
        /// <response code="404">Si le composant ou l'icône n'existe pas</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        [HttpGet("components/{componentId}/icon")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> GetComponentIcon(int componentId)
        {
            try
            {
                _logger.LogInformation($"Récupération de l'icône du composant {componentId}");
                
                // Récupérer le nom du composant pour construire le chemin vers l'icône
                var component = await _marketplaceService.GetComponentDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });
                
                // Construire le chemin de l'icône
                string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "images", $"{component.Name}.svg");
                
                // Vérifier si l'icône existe, sinon utiliser l'icône par défaut
                if (!System.IO.File.Exists(iconPath))
                {
                    _logger.LogWarning($"Icône non trouvée pour le composant {componentId} ({component.Name}), utilisation de l'icône par défaut");
                    
                    // Chemin vers l'icône par défaut
                    string defaultIconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "images", "default-component.svg");
                    
                    // Vérifier si l'icône par défaut existe
                    if (!System.IO.File.Exists(defaultIconPath))
                    {
                        _logger.LogError("L'icône par défaut n'existe pas non plus");
                        return NotFound(new { error = "Icône non trouvée" });
                    }
                    
                    // Retourner l'icône par défaut
                    var defaultFileStream = new FileStream(defaultIconPath, FileMode.Open, FileAccess.Read);
                    return File(defaultFileStream, "image/svg+xml");
                }
                
                // Retourner l'icône du composant
                var fileStream = new FileStream(iconPath, FileMode.Open, FileAccess.Read);
                return File(fileStream, "image/svg+xml");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération de l'icône du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération de l'icône" });
            }
        }
        
        /// <summary>
        /// Récupère l'icône d'un composant par son tag
        /// </summary>
        /// <param name="tag">Tag du composant</param>
        /// <returns>Fichier image SVG de l'icône</returns>
        /// <response code="200">Retourne l'icône associée au tag</response>
        /// <response code="404">Si l'icône n'existe pas pour ce tag</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        [HttpGet("icons/tag/{tag}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public ActionResult GetIconByTag(string tag)
        {
            try
            {
                _logger.LogInformation($"Récupération de l'icône pour le tag {tag}");
                
                // Construire le chemin de l'icône
                string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "images", $"{tag}.svg");
                
                // Vérifier si l'icône existe
                if (!System.IO.File.Exists(iconPath))
                {
                    _logger.LogWarning($"Icône non trouvée pour le tag {tag}");
                    return NotFound(new { error = "Icône non trouvée pour ce tag" });
                }
                
                // Retourner l'icône
                var fileStream = new FileStream(iconPath, FileMode.Open, FileAccess.Read);
                return File(fileStream, "image/svg+xml");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération de l'icône pour le tag {tag}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération de l'icône" });
            }
        }

        /// <summary>
        /// Télécharge un composant du marketplace
        /// </summary>
        /// <param name="componentId">ID du composant à télécharger</param>
        /// <param name="clientId">Identifiant unique du client Process Studio</param>
        /// <param name="version">Version spécifique du composant à télécharger (optionnel, sinon la dernière version est utilisée)</param>
        /// <returns>Fichier ZIP du composant ou URL de téléchargement</returns>
        /// <response code="200">Téléchargement réussi - retourne soit le fichier, soit une URL</response>
        /// <response code="400">Si l'identifiant client n'est pas spécifié</response>
        /// <response code="401">Si l'authentification a échoué</response>
        /// <response code="404">Si le composant ou la version n'existe pas</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        /// <remarks>
        /// Cet endpoint peut retourner :
        /// - Un fichier physique directement (Content-Type: application/zip)
        /// - Ou un objet JSON avec une URL de téléchargement : { "DownloadUrl": "..." }
        /// 
        /// Le comportement dépend de la configuration du composant.
        /// Les téléchargements sont enregistrés pour les statistiques.
        /// </remarks>
        [HttpPost("components/{componentId}/download")]
        [Produces("application/json", "application/zip")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> DownloadComponent(
            int componentId, 
            [FromQuery] string clientId, 
            [FromQuery] string version,
            [FromQuery] bool urlOnly = false)
        {
            try
            {
                _logger.LogInformation($"Téléchargement du composant {componentId} (version: {version}) par le client {clientId}");
                
                if (string.IsNullOrEmpty(clientId))
                {
                    return BadRequest(new { error = "L'identifiant du client est requis" });
                }
                
                var downloadResult = await _marketplaceService.GetComponentDownloadInfoAsync(componentId, version);
                if (downloadResult == null)
                    return NotFound(new { error = "Composant non trouvé" });
                
                // Vérifier que l'URL de téléchargement existe et est accessible
                if (!string.IsNullOrEmpty(downloadResult.DownloadUrl) && downloadResult.DownloadUrl.StartsWith("http"))
                {
                    bool isAccessible = await TestUrlAccessibleAsync(downloadResult.DownloadUrl);
                    if (!isAccessible)
                    {
                        _logger.LogWarning($"L'URL de téléchargement n'est pas accessible: {downloadResult.DownloadUrl}");
                        
                        // Tenter d'obtenir une URL alternative à partir des versions disponibles
                        var alternativeUrl = await FindAlternativePackageUrlAsync(componentId);
                        if (!string.IsNullOrEmpty(alternativeUrl))
                        {
                            _logger.LogInformation($"URL alternative trouvée: {alternativeUrl}");
                            downloadResult.DownloadUrl = alternativeUrl;
                        }
                        else
                        {
                            return BadRequest(new { error = $"L'URL de téléchargement n'est pas accessible: {downloadResult.DownloadUrl}" });
                        }
                    }
                }
                
                // Enregistrer le téléchargement
                await _marketplaceService.LogComponentDownloadAsync(componentId, clientId, version ?? downloadResult.Version);
                
                // Priorité au fichier physique local
                string packagePath = null;
                
                // Vérifier si nous avons un fichier local via FilePath
                if (!string.IsNullOrEmpty(downloadResult.FilePath) && System.IO.File.Exists(downloadResult.FilePath))
                {
                    packagePath = downloadResult.FilePath;
                    _logger.LogInformation($"Utilisation du chemin de fichier direct: {packagePath}");
                }
                // Sinon, essayer de trouver le fichier à partir de DownloadUrl s'il s'agit d'une URL locale et valide
                else if (!string.IsNullOrEmpty(downloadResult.DownloadUrl))
                {
                    // Vérifier si c'est une URL relative au site (commençant par '/packages/')
                    string relativeUrl = downloadResult.DownloadUrl;
                    
                    // Extraire le chemin relatif de l'URL complète si nécessaire
                    if (relativeUrl.Contains("/packages/"))
                    {
                        relativeUrl = relativeUrl.Substring(relativeUrl.IndexOf("/packages/"));
                    }
                    
                    if (relativeUrl.StartsWith("/packages/"))
                    {
                        string fileName = Path.GetFileName(relativeUrl);
                        string packagesDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "packages");
                        packagePath = Path.Combine(packagesDir, fileName);
                        
                        _logger.LogInformation($"URL convertie en chemin local: {packagePath}");
                    }
                    else if (downloadResult.DownloadUrl.StartsWith("http"))
                    {
                        // C'est une URL externe, la retourner telle quelle
                        _logger.LogInformation($"URL externe détectée, transmission au client: {downloadResult.DownloadUrl}");
                        return Ok(new { DownloadUrl = downloadResult.DownloadUrl });
                    }
                }
                
                // Si toujours pas de chemin, essayer de le déduire du nom du composant et de la version
                if (packagePath == null || !System.IO.File.Exists(packagePath))
                {
                    try
                    {
                        var component = await _marketplaceService.GetComponentDetailAsync(componentId);
                        if (component != null)
                        {
                            string packageVersion = version ?? component.Version;
                            string expectedFileName = $"{component.Name}-{packageVersion}.zip";
                            string packagesDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "packages");
                            packagePath = Path.Combine(packagesDir, expectedFileName);
                            
                            _logger.LogInformation($"Tentative avec le chemin déduit: {packagePath}");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Erreur lors de la tentative de déduire le chemin du package");
                    }
                }
                
                // Retourner le fichier ou l'URL selon le paramètre urlOnly
                if (packagePath != null && System.IO.File.Exists(packagePath))
                {
                    var fileName = Path.GetFileName(packagePath);
                    
                    // Si le client demande uniquement l'URL (utile pour Swagger ou les applications qui préfèrent une URL)
                    if (urlOnly)
                    {
                        // Construire une URL temporaire directe
                        string baseUrl = _configuration["ApiBaseUrl"]?.Replace("/api", "") ?? 
                                       "https://marketplace-dev.avanteam-online.com";
                        
                        if (baseUrl.EndsWith("/"))
                        {
                            baseUrl = baseUrl.TrimEnd('/');
                        }
                        
                        string packageUrl = $"{baseUrl}/packages/{fileName}";
                        _logger.LogInformation($"Retour de l'URL du package (mode urlOnly): {packageUrl}");
                        return Ok(new { DownloadUrl = packageUrl });
                    }
                    else
                    {
                        // Sinon, retourner directement le fichier
                        var contentType = "application/zip";
                        
                        _logger.LogInformation($"Envoi du fichier ZIP: {packagePath}");
                        return PhysicalFile(
                            packagePath,
                            contentType,
                            fileName
                        );
                    }
                }
                
                return NotFound(new { error = "Fichier de composant non disponible" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors du téléchargement du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors du téléchargement du composant" });
            }
        }
        
        /// <summary>
        /// Installe ou met à jour un composant pour un client
        /// </summary>
        /// <param name="componentId">ID du composant à installer</param>
        /// <param name="clientId">Identifiant du client</param>
        /// <param name="version">Version à installer (optionnel)</param>
        /// <param name="installRequest">Données d'installation (optionnel)</param>
        /// <returns>Succès ou échec de l'installation</returns>
        /// <response code="200">Installation réussie</response>
        /// <response code="400">Si l'identifiant client n'est pas spécifié</response>
        /// <response code="404">Si le composant n'existe pas</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        [HttpPost("components/{componentId}/install")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> InstallComponent(
            int componentId, 
            [FromQuery] string clientId, 
            [FromQuery] string version,
            [FromBody] InstallationResultViewModel? installRequest = null)
        {
            try
            {
                _logger.LogInformation($"Installation du composant {componentId} (version: {version}) par le client {clientId}");
                
                if (string.IsNullOrEmpty(clientId))
                {
                    return BadRequest(new { error = "L'identifiant du client est requis" });
                }
                
                // Enregistrer l'installation
                await _marketplaceService.LogComponentInstallationAsync(componentId, clientId, version);
                
                // Journaliser les détails de l'installation si disponibles
                if (installRequest != null)
                {
                    string logInfo = $"Résultats d'installation pour le composant {componentId}:";
                    logInfo += $"\n- Success: {installRequest.Success}";
                    logInfo += $"\n- Install ID: {installRequest.InstallId}";
                    logInfo += $"\n- Destination: {installRequest.DestinationPath}";
                    
                    if (!string.IsNullOrEmpty(installRequest.LogFile))
                    {
                        logInfo += $"\n- Log: {installRequest.LogFile}";
                    }
                    
                    if (!string.IsNullOrEmpty(installRequest.Error))
                    {
                        logInfo += $"\n- Erreur: {installRequest.Error}";
                        _logger.LogWarning(logInfo);
                    }
                    else
                    {
                        _logger.LogInformation(logInfo);
                    }
                }
                
                return Ok(new { Success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de l'installation du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de l'installation du composant" });
            }
        }
        
        /// <summary>
        /// Désinstalle un composant pour un client
        /// </summary>
        /// <param name="componentId">ID du composant à désinstaller</param>
        /// <param name="clientId">Identifiant du client</param>
        /// <returns>Succès ou échec de la désinstallation</returns>
        /// <response code="200">Désinstallation réussie</response>
        /// <response code="400">Si l'identifiant client n'est pas spécifié</response>
        /// <response code="404">Si le composant n'est pas installé ou n'existe pas</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        [HttpPost("components/{componentId}/uninstall")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> UninstallComponent(
            int componentId,
            [FromQuery] string clientId)
        {
            try
            {
                _logger.LogInformation($"Désinstallation du composant {componentId} par le client {clientId}");
                
                if (string.IsNullOrEmpty(clientId))
                {
                    return BadRequest(new { error = "L'identifiant du client est requis" });
                }
                
                var result = await _marketplaceService.UninstallComponentAsync(componentId, clientId);
                
                if (!result)
                {
                    return NotFound(new { error = "Le composant n'est pas installé ou n'existe pas" });
                }
                
                return Ok(new { Success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la désinstallation du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la désinstallation du composant" });
            }
        }
        
        /// <summary>
        /// Exécute l'installation automatique d'un composant sur le serveur Process Studio
        /// </summary>
        /// <param name="componentId">ID du composant à installer</param>
        /// <param name="clientId">Identifiant du client</param>
        /// <param name="version">Version du composant (optionnel)</param>
        /// <returns>Résultat de l'installation</returns>
        /// <response code="200">Installation exécutée avec succès</response>
        /// <response code="400">Si l'identifiant client n'est pas spécifié</response>
        /// <response code="404">Si le composant n'existe pas</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        [HttpPost("components/{componentId}/execute-install")]
        [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(InstallationResultViewModel))]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<InstallationResultViewModel>> ExecuteInstallComponent(
            int componentId,
            [FromQuery] string clientId,
            [FromQuery] string version)
        {
            try
            {
                _logger.LogInformation($"Exécution de l'installation automatique du composant {componentId} v{version} pour le client {clientId}");
                
                if (string.IsNullOrEmpty(clientId))
                {
                    return BadRequest(new { error = "L'identifiant du client est requis" });
                }
                
                // Récupérer les informations de téléchargement du composant
                var downloadInfo = await _marketplaceService.GetComponentDownloadInfoAsync(componentId, version);
                if (downloadInfo == null)
                {
                    return NotFound(new { error = "Composant non trouvé" });
                }

                // Déterminer le répertoire racine de Process Studio
                // Pour un serveur web ASP.NET, nous utilisons le chemin d'installation configuré
                string processStudioRoot = _configuration["Installation:ProcessStudioRoot"];
                if (string.IsNullOrEmpty(processStudioRoot))
                {
                    // Utiliser le répertoire racine de l'application web
                    processStudioRoot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..");
                    _logger.LogInformation($"Répertoire racine non configuré, utilisation de : {processStudioRoot}");
                }
                
                // Construire l'URL pour télécharger directement depuis l'endpoint de téléchargement
                string packageVersion = version ?? downloadInfo.Version;
                string apiBaseUrl = _configuration["ApiBaseUrl"] ?? "https://marketplace-dev.avanteam-online.com/api";
                
                if (apiBaseUrl.EndsWith("/"))
                {
                    apiBaseUrl = apiBaseUrl.TrimEnd('/');
                }
                
                // Utiliser l'endpoint de téléchargement directement
                string downloadUrl = $"{apiBaseUrl}/marketplace/components/{componentId}/download?clientId={Uri.EscapeDataString(clientId)}&urlOnly=true";
                
                if (!string.IsNullOrEmpty(packageVersion))
                {
                    downloadUrl += $"&version={Uri.EscapeDataString(packageVersion)}";
                }
                
                _logger.LogInformation($"URL de téléchargement directe construite: {downloadUrl}");
                
                // Vérifier que le fichier existe
                var component = await _marketplaceService.GetComponentDetailAsync(componentId);
                if (component == null)
                {
                    return NotFound(new { error = "Composant non trouvé" });
                }
                
                string expectedFileName = $"{component.Name}-{packageVersion}.zip";
                string packagesDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "packages");
                string packagePath = Path.Combine(packagesDir, expectedFileName);
                
                if (!System.IO.File.Exists(packagePath))
                {
                    _logger.LogWarning($"Le fichier de package n'existe pas: {packagePath}");
                    return NotFound(new { error = "Fichier de package non trouvé" });
                }
                
                // Exécuter le script d'installation
                var result = await _installerService.InstallComponentAsync(
                    componentId, 
                    version ?? downloadInfo.Version, 
                    downloadUrl, 
                    processStudioRoot);
                
                if (result.Success)
                {
                    // Enregistrer l'installation dans la base de données
                    await _marketplaceService.LogComponentInstallationAsync(componentId, clientId, version ?? downloadInfo.Version);
                    
                    _logger.LogInformation($"Installation du composant {componentId} réussie: {result.DestinationPath}");
                }
                else
                {
                    _logger.LogWarning($"Échec de l'installation du composant {componentId}: {result.Error}");
                }
                
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de l'exécution de l'installation du composant {componentId}");
                return StatusCode(500, new { error = $"Une erreur est survenue lors de l'installation: {ex.Message}" });
            }
        }
        
        /// <summary>
        /// Récupère les logs d'une installation
        /// </summary>
        /// <param name="installId">ID de l'installation</param>
        /// <returns>Contenu des logs d'installation</returns>
        /// <response code="200">Logs récupérés avec succès</response>
        /// <response code="404">Si les logs n'existent pas</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        [HttpGet("installations/{installId}/logs")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> GetInstallationLogs(string installId)
        {
            try
            {
                _logger.LogInformation($"Récupération des logs pour l'installation {installId}");
                
                var logs = await _installerService.GetInstallationLogsAsync(installId);
                
                if (string.IsNullOrEmpty(logs) || logs.Contains("non trouvé"))
                {
                    return NotFound(new { error = "Logs d'installation non trouvés" });
                }
                
                return Ok(new { Logs = logs });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des logs pour l'installation {installId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération des logs" });
            }
        }
        
        /// <summary>
        /// Télécharge le script d'installation client pour l'exécution locale
        /// </summary>
        /// <remarks>
        /// Ce endpoint permet de télécharger un script PowerShell qui servira de
        /// lanceur pour l'installation locale du composant sur la machine cliente.
        /// </remarks>
        /// <response code="200">Retourne le script PowerShell</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        [HttpGet("install-script")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public ActionResult GetInstallScript()
        {
            try
            {
                _logger.LogInformation("Téléchargement du script d'installation client");
                
                var scriptPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "scripts", "install-component-launcher.ps1");
                
                if (!System.IO.File.Exists(scriptPath))
                {
                    _logger.LogError($"Script d'installation non trouvé: {scriptPath}");
                    return StatusCode(500, new { error = "Script d'installation non disponible" });
                }
                
                return PhysicalFile(scriptPath, "application/octet-stream", "install-component.ps1");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération du script d'installation");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération du script d'installation" });
            }
        }
        
        /// <summary>
        /// Teste si une URL est accessible
        /// </summary>
        private async Task<bool> TestUrlAccessibleAsync(string url)
        {
            try
            {
                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(5);
                
                // Utiliser HEAD pour ne pas télécharger le contenu complet
                var request = new HttpRequestMessage(HttpMethod.Head, url);
                var response = await httpClient.SendAsync(request);
                
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Erreur lors du test de l'URL {url}: {ex.Message}");
                return false;
            }
        }
        
        /// <summary>
        /// Recherche une URL de package alternative parmi toutes les versions disponibles du composant
        /// </summary>
        private async Task<string> FindAlternativePackageUrlAsync(int componentId)
        {
            try
            {
                // Récupérer toutes les versions du composant
                var versions = await _marketplaceService.GetComponentVersionsAsync(componentId);
                if (versions == null || !versions.Any())
                    return null;
                
                // Tester chaque URL de version en commençant par la plus récente
                foreach (var version in versions.OrderByDescending(v => v.ReleaseDate))
                {
                    if (!string.IsNullOrEmpty(version.DownloadUrl) && 
                        version.DownloadUrl.StartsWith("http") &&
                        await TestUrlAccessibleAsync(version.DownloadUrl))
                    {
                        return version.DownloadUrl;
                    }
                }
                
                // Si non trouvé dans les versions, vérifier si le composant a une URL GitHub utilisable
                var component = await _marketplaceService.GetComponentDetailAsync(componentId);
                if (component != null && !string.IsNullOrEmpty(component.RepositoryUrl) && 
                    component.RepositoryUrl.Contains("github.com"))
                {
                    // Essayer les branches possibles
                    string repoUrl = component.RepositoryUrl
                        .Replace("https://github.com/", "")
                        .Replace("http://github.com/", "")
                        .Replace("github.com:", "")
                        .Replace("github.com/", "")
                        .TrimEnd('/');
                    
                    var branchUrls = new[]
                    {
                        $"https://github.com/{repoUrl}/archive/refs/heads/main.zip",
                        $"https://github.com/{repoUrl}/archive/refs/heads/master.zip",
                        $"https://github.com/{repoUrl}/archive/refs/tags/v{component.Version}.zip",
                        $"https://github.com/{repoUrl}/archive/refs/tags/{component.Version}.zip"
                    };
                    
                    foreach (var url in branchUrls)
                    {
                        if (await TestUrlAccessibleAsync(url))
                        {
                            return url;
                        }
                    }
                }
                
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la recherche d'une URL alternative pour le composant {componentId}");
                return null;
            }
        }
    }
}