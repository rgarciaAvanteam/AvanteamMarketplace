using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using AvanteamMarketplace.Core.Services;
using AvanteamMarketplace.Core.ViewModels;
using Microsoft.Extensions.Logging;
using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using System.IO;

namespace AvanteamMarketplace.API.Controllers
{
    /// <summary>
    /// Contrôleur pour l'API d'administration du Marketplace
    /// </summary>
    /// <remarks>
    /// Ce contrôleur fournit les endpoints réservés aux administrateurs pour gérer le Marketplace :
    /// - Créer, modifier et supprimer des composants
    /// - Téléverser des packages de composants
    /// - Gérer les clés API
    /// - Synchroniser avec GitHub
    /// 
    /// **IMPORTANT** : Tous les endpoints nécessitent une clé API avec des droits d'administration.
    /// </remarks>
    [ApiController]
    [Route("api/management")]
    [Authorize(AuthenticationSchemes = "ApiKey", Roles = "Administrator")]
    [Produces("application/json")]
    [Tags("Administration API")]
    public class ComponentsManagementController : ControllerBase
    {
        private readonly IMarketplaceService _marketplaceService;
        private readonly IGitHubIntegrationService _githubService;
        private readonly IComponentPackageService _packageService;
        private readonly ILogger<ComponentsManagementController> _logger;

        public ComponentsManagementController(
            IMarketplaceService marketplaceService,
            IGitHubIntegrationService githubService,
            IComponentPackageService packageService,
            ILogger<ComponentsManagementController> logger)
        {
            _marketplaceService = marketplaceService;
            _githubService = githubService;
            _packageService = packageService;
            _logger = logger;
        }

        [HttpGet("components")]
        public async Task<ActionResult<ComponentsAdminViewModel>> GetAllComponents()
        {
            try
            {
                var components = await _marketplaceService.GetComponentsForAdminAsync();
                return Ok(components);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération de tous les composants");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération des composants" });
            }
        }

        [HttpGet("components/{componentId}")]
        public async Task<ActionResult<ComponentAdminDetailViewModel>> GetComponentAdminDetail(int componentId)
        {
            try
            {
                var component = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });
                    
                return Ok(component);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des détails d'administration du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération des détails" });
            }
        }

        [HttpPost("components")]
        public async Task<ActionResult<int>> CreateComponent([FromBody] ComponentCreateViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }
            
            try
            {
                var componentId = await _marketplaceService.CreateComponentAsync(model);
                return CreatedAtAction(nameof(GetComponentAdminDetail), new { componentId }, new { ComponentId = componentId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la création d'un composant");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la création du composant" });
            }
        }

        [HttpPut("components/{componentId}")]
        public async Task<ActionResult> UpdateComponent(int componentId, [FromBody] ComponentUpdateViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }
            
            try
            {
                var success = await _marketplaceService.UpdateComponentAsync(componentId, model);
                if (!success)
                    return NotFound(new { error = "Composant non trouvé" });
                    
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la mise à jour du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la mise à jour du composant" });
            }
        }

        /// <summary>
        /// Supprime un composant du Marketplace
        /// </summary>
        /// <param name="componentId">ID du composant à supprimer</param>
        /// <returns>Statut de la suppression</returns>
        /// <response code="204">Composant supprimé avec succès</response>
        /// <response code="400">Si le composant est installé sur des plateformes clientes</response>
        /// <response code="404">Si le composant n'existe pas</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        [HttpDelete("components/{componentId}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> DeleteComponent(int componentId)
        {
            try
            {
                var success = await _marketplaceService.DeleteComponentAsync(componentId);
                if (!success)
                    return NotFound(new { error = "Composant non trouvé" });
                    
                return NoContent();
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("installations actives"))
            {
                _logger.LogWarning($"Tentative de suppression du composant {componentId} qui a des installations actives");
                return BadRequest(new { 
                    error = "Le composant ne peut pas être supprimé car il est installé sur une ou plusieurs plateformes clientes. Désinstallez le composant de toutes les plateformes avant de le supprimer." 
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la suppression du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la suppression du composant" });
            }
        }
        
        /// <summary>
        /// Récupère l'icône d'un composant
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <returns>Fichier image SVG de l'icône</returns>
        /// <response code="200">Retourne l'icône</response>
        /// <response code="401">Si l'authentification a échoué ou si l'utilisateur n'est pas administrateur</response>
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
                var component = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
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
        
        [HttpPost("components/{componentId}/icon")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult> UploadComponentIcon(int componentId, IFormFile iconFile)
        {
            if (iconFile == null)
            {
                return BadRequest(new { error = "Aucun fichier d'icône n'a été fourni" });
            }
            
            // Vérifier que le fichier est bien une image SVG
            if (!iconFile.ContentType.Equals("image/svg+xml") && !Path.GetExtension(iconFile.FileName).Equals(".svg", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { error = "Le fichier doit être une image SVG" });
            }
            
            try
            {
                // Vérifier que le composant existe
                var component = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });
                
                // Créer le répertoire des images s'il n'existe pas
                string imagesDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "images");
                if (!Directory.Exists(imagesDirectory))
                {
                    Directory.CreateDirectory(imagesDirectory);
                }
                
                // Construire le chemin de destination
                string iconPath = Path.Combine(imagesDirectory, $"{component.Name}.svg");
                
                // Sauvegarder l'icône
                using (var fileStream = new FileStream(iconPath, FileMode.Create))
                {
                    await iconFile.CopyToAsync(fileStream);
                }
                
                return Ok(new { Success = true, IconUrl = $"/images/{component.Name}.svg" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors du téléversement de l'icône pour le composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors du téléversement de l'icône" });
            }
        }

        /// <summary>
        /// Téléverse un package de composant (fichier ZIP)
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <param name="packageFile">Fichier de package au format ZIP</param>
        /// <param name="version">Version du package (ex: 1.0.0) - si non spécifiée, utilise la version du manifest.json</param>
        /// <returns>Informations sur le package téléversé</returns>
        /// <response code="200">Téléversement réussi</response>
        /// <response code="400">Si le fichier est manquant ou invalide</response>
        /// <response code="401">Si l'authentification a échoué ou si l'utilisateur n'est pas administrateur</response>
        /// <response code="404">Si le composant n'existe pas</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        /// <remarks>
        /// Le package ZIP doit contenir au minimum :
        /// - Un répertoire src/ contenant les fichiers du composant
        /// - OU les fichiers du composant directement à la racine
        /// 
        /// Structure recommandée :
        /// ```
        /// component-name/
        ///   ├── manifest.json   # Métadonnées du composant
        ///   ├── README.md       # Documentation
        ///   ├── install.ps1     # Script d'installation personnalisé (optionnel)
        ///   └── src/            # Fichiers source du composant
        /// ```
        /// </remarks>
        [HttpPost("components/{componentId}/package")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult> UploadComponentPackage(int componentId, IFormFile packageFile, [FromQuery] string version)
        {
            if (packageFile == null)
            {
                return BadRequest(new { error = "Aucun fichier n'a été fourni" });
            }
            
            try
            {
                // Vérifier que le composant existe
                var component = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });
                
                // Sauvegarder le fichier
                var tempFilePath = Path.GetTempFileName();
                using (var stream = System.IO.File.Create(tempFilePath))
                {
                    await packageFile.CopyToAsync(stream);
                }
                
                // Traiter le package
                var result = await _packageService.ProcessComponentPackageAsync(componentId, tempFilePath, version);
                
                // Supprimer le fichier temporaire
                System.IO.File.Delete(tempFilePath);
                
                if (!result.Success)
                {
                    return BadRequest(new { error = result.ErrorMessage });
                }
                
                // Mettre à jour le composant avec l'URL du package et la version
                try 
                {
                    // Récupérer les détails actuels du composant
                    var componentDetails = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                    if (componentDetails != null)
                    {
                        // Créer le modèle de mise à jour
                        var updateModel = new ComponentUpdateViewModel
                        {
                            // Préserver toutes les valeurs existantes
                            DisplayName = componentDetails.DisplayName,
                            Description = componentDetails.Description,
                            Version = result.Version, // Mettre à jour avec la nouvelle version
                            Category = componentDetails.Category,
                            Author = componentDetails.Author,
                            MinPlatformVersion = componentDetails.MinPlatformVersion,
                            RecommendedPlatformVersion = componentDetails.RecommendedPlatformVersion,
                            RepositoryUrl = componentDetails.RepositoryUrl,
                            RequiresRestart = componentDetails.RequiresRestart,
                            TargetPath = componentDetails.TargetPath,
                            PackageUrl = result.PackageUrl, // Mettre à jour avec la nouvelle URL du package
                            ReadmeContent = componentDetails.ReadmeContent,
                            Tags = componentDetails.Tags,
                            Dependencies = componentDetails.Dependencies?.Select(d => new ComponentDependencyViewModel
                            {
                                ComponentId = d.DependencyId,
                                MinVersion = d.MinVersion
                            }).ToList()
                        };
                        
                        // Mettre à jour le composant
                        _logger.LogInformation($"Mise à jour du composant {componentId} avec PackageUrl={result.PackageUrl} et Version={result.Version}");
                        await _marketplaceService.UpdateComponentAsync(componentId, updateModel);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, $"Erreur lors de la mise à jour du composant {componentId} avec l'URL du package: {ex.Message}");
                    // Ne pas faire échouer l'opération complète si cette partie échoue
                }
                
                return Ok(new { Version = result.Version, PackageUrl = result.PackageUrl });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors du téléchargement du package pour le composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors du téléchargement du package" });
            }
        }

        /// <summary>
        /// Synchronise les composants depuis un dépôt GitHub
        /// </summary>
        /// <param name="repository">URL du dépôt GitHub à synchroniser (ex: https://github.com/avanteam/component-HishikawaDiagram)</param>
        /// <returns>Résultat de la synchronisation avec les composants créés, mis à jour et en échec</returns>
        /// <response code="200">Synchronisation réussie</response>
        /// <response code="401">Si l'authentification a échoué ou si l'utilisateur n'est pas administrateur</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        /// <remarks>
        /// Cet endpoint permet d'importer ou de mettre à jour des composants à partir d'un dépôt GitHub.
        /// Le dépôt doit contenir un fichier manifest.json à la racine qui décrit le composant.
        /// 
        /// Format du manifest.json attendu :
        /// ```json
        /// {
        ///   "name": "IshikawaDiagram",
        ///   "displayName": "Diagramme Ishikawa",
        ///   "version": "1.0.0",
        ///   "author": "Avanteam",
        ///   "description": "Description du composant",
        ///   "category": "Analyse",
        ///   "minPlatformVersion": "23.0.0",
        ///   "recommendedPlatformVersion": "23.0.0",
        ///   "repository": "https://github.com/avanteam/component-repository",
        ///   "tags": ["analyse", "qualité"]
        /// }
        /// ```
        /// </remarks>
        [HttpPost("github/sync")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> SynchronizeFromGitHub([FromQuery] string repository)
        {
            try
            {
                var result = await _githubService.SynchronizeComponentsFromGitHubAsync(repository);
                return Ok(new { 
                    NewComponents = result.NewComponents,
                    UpdatedComponents = result.UpdatedComponents,
                    FailedComponents = result.FailedComponents
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la synchronisation avec GitHub");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la synchronisation avec GitHub" });
            }
        }

        [HttpGet("apikeys")]
        public async Task<ActionResult> GetApiKeys()
        {
            try
            {
                var keys = await _marketplaceService.GetApiKeysAsync();
                return Ok(keys);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des clés API");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération des clés API" });
            }
        }

        /// <summary>
        /// Crée une nouvelle clé API
        /// </summary>
        /// <param name="model">Informations pour la création de la clé API</param>
        /// <returns>La nouvelle clé API générée</returns>
        /// <response code="200">Création réussie, retourne la clé API générée</response>
        /// <response code="400">Si le modèle est invalide</response>
        /// <response code="401">Si l'authentification a échoué ou si l'utilisateur n'est pas administrateur</response>
        /// <response code="500">Si une erreur serveur s'est produite</response>
        /// <remarks>
        /// Les clés API sont utilisées pour authentifier les requêtes au Marketplace.
        /// 
        /// Il existe deux types de clés API :
        /// - Clés client : utilisées par Process Studio pour accéder aux composants
        /// - Clés administrateur : utilisées pour gérer le Marketplace (créer/modifier/supprimer des composants)
        /// 
        /// Exemple de requête :
        /// ```json
        /// {
        ///   "clientId": "process-studio-client-001",
        ///   "isAdmin": true
        /// }
        /// ```
        /// 
        /// **IMPORTANT** : Sauvegardez la clé API générée, elle ne sera plus jamais affichée après cette opération.
        /// </remarks>
        [HttpPost("apikeys")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> CreateApiKey([FromBody] ApiKeyCreateViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }
            
            try
            {
                var apiKeyModel = new ApiKeyCreateViewModel 
                { 
                    ClientId = model.ClientId, 
                    IsAdmin = model.IsAdmin 
                };
                var apiKey = await _marketplaceService.CreateApiKeyAsync(apiKeyModel);
                return Ok(new { ApiKey = apiKey });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la création d'une clé API");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la création de la clé API" });
            }
        }

        [HttpDelete("apikeys/{apiKeyId}")]
        public async Task<ActionResult> DeleteApiKey(int apiKeyId)
        {
            try
            {
                var success = await _marketplaceService.DeleteApiKeyAsync(apiKeyId);
                if (!success)
                    return NotFound(new { error = "Clé API non trouvée" });
                    
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la suppression de la clé API {apiKeyId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la suppression de la clé API" });
            }
        }
    }
}