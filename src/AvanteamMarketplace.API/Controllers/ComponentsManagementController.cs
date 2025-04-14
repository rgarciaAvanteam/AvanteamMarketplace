using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using AvanteamMarketplace.Core.Services;
using AvanteamMarketplace.Core.ViewModels;
using Microsoft.Extensions.Logging;
using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using System.IO;
using System.Collections.Generic;
using System.Linq;

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

        #region Components Management Endpoints

        /// <summary>
        /// Récupère tous les composants pour l'administration
        /// </summary>
        /// <returns>Liste des composants pour l'administration</returns>
        [HttpGet("components")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<ComponentsAdminViewModel>> GetComponentsForAdmin()
        {
            try
            {
                var components = await _marketplaceService.GetComponentsForAdminAsync();
                return Ok(components);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des composants pour l'administration");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération des composants", details = ex.Message });
            }
        }

        /// <summary>
        /// Récupère les détails d'un composant pour l'administration
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <returns>Détails du composant</returns>
        [HttpGet("components/{componentId}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
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
                _logger.LogError(ex, $"Erreur lors de la récupération des détails du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération des détails du composant", details = ex.Message });
            }
        }

        /// <summary>
        /// Crée un nouveau composant
        /// </summary>
        /// <param name="model">Données du composant à créer</param>
        /// <returns>ID du composant créé et statut de la création</returns>
        [HttpPost("components")]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> CreateComponent([FromBody] ComponentCreateViewModel model)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var componentId = await _marketplaceService.CreateComponentAsync(model);
                return CreatedAtAction(nameof(GetComponentAdminDetail), new { componentId }, new { componentId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la création du composant");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la création du composant", details = ex.Message });
            }
        }

        /// <summary>
        /// Met à jour un composant existant
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <param name="model">Données de mise à jour</param>
        /// <returns>Statut de la mise à jour</returns>
        [HttpPut("components/{componentId}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> UpdateComponent(int componentId, [FromBody] ComponentUpdateViewModel model)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                // Vérifier que le composant existe
                var component = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });

                var success = await _marketplaceService.UpdateComponentAsync(componentId, model);
                if (!success)
                    return NotFound(new { error = "Composant non trouvé ou impossible à mettre à jour" });

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la mise à jour du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la mise à jour du composant", details = ex.Message });
            }
        }

        /// <summary>
        /// Supprime un composant
        /// </summary>
        /// <param name="componentId">ID du composant à supprimer</param>
        /// <returns>Statut de la suppression</returns>
        [HttpDelete("components/{componentId}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> DeleteComponent(int componentId)
        {
            try
            {
                // Vérifier que le composant existe
                var component = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });

                var success = await _marketplaceService.DeleteComponentAsync(componentId);
                if (!success)
                    return NotFound(new { error = "Composant non trouvé ou impossible à supprimer" });

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la suppression du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la suppression du composant", details = ex.Message });
            }
        }

        /// <summary>
        /// Téléverse un package pour un composant
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <param name="packageFile">Fichier du package</param>
        /// <param name="version">Version du package (optionnel)</param>
        /// <returns>Résultat du téléversement</returns>
        [HttpPost("components/{componentId}/package")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> UploadComponentPackage(int componentId, IFormFile packageFile, [FromQuery] string? version = null)
        {
            try
            {
                if (packageFile == null || packageFile.Length == 0)
                {
                    return BadRequest(new { error = "Aucun fichier n'a été téléversé" });
                }

                // Vérifier que le composant existe
                var component = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });

                // Chemin temporaire pour enregistrer le fichier
                var tempFilePath = Path.GetTempFileName();
                try
                {
                    using (var stream = new FileStream(tempFilePath, FileMode.Create))
                    {
                        await packageFile.CopyToAsync(stream);
                    }

                    // Valider le package
                    var validationResult = await _packageService.ValidateComponentPackageAsync(tempFilePath);
                    if (!validationResult.IsValid)
                    {
                        return BadRequest(new { error = "Le package n'est pas valide", details = validationResult.ErrorMessage });
                    }

                    // Traiter le package
                    var packageResult = await _packageService.ProcessComponentPackageAsync(componentId, tempFilePath, version);
                    
                    if (!packageResult.Success)
                    {
                        return BadRequest(new { error = "Échec du traitement du package", details = packageResult.ErrorMessage });
                    }
                    
                    // Récupérer les détails du composant pour obtenir toutes ses versions
                    var componentDetails = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                    if (componentDetails == null)
                    {
                        return NotFound(new { error = "Composant non trouvé" });
                    }
                    
                    // Mettre à jour le composant principal avec l'URL générée
                    var updateModel = new ComponentUpdateViewModel
                    {
                        PackageUrl = packageResult.PackageUrl
                    };
                    
                    var success = await _marketplaceService.UpdateComponentAsync(componentId, updateModel);
                    if (!success)
                    {
                        return StatusCode(500, new { error = "Le package a été traité mais l'URL n'a pas pu être enregistrée dans la base de données" });
                    }
                    
                    // Mettre à jour également toutes les versions marquées comme "latest"
                    if (componentDetails != null && componentDetails.Versions != null)
                    {
                        foreach (var v in componentDetails.Versions.Where(v => v.IsLatest))
                        {
                            var versionUpdateModel = new ComponentVersionCreateViewModel
                            {
                                Version = v.VersionNumber,
                                ChangeLog = v.ChangeLog ?? "",
                                MinPlatformVersion = v.MinPlatformVersion ?? "",
                                IsLatest = true,
                                PackageUrl = packageResult.PackageUrl
                            };
                            
                            await _marketplaceService.UpdateComponentVersionAsync(v.VersionId, versionUpdateModel);
                        }
                    }
                    
                    return Ok(new { 
                        success = true, 
                        message = "Package téléversé avec succès et URL mise à jour dans le composant et ses versions", 
                        packageUrl = packageResult.PackageUrl 
                    });
                }
                finally
                {
                    // Supprimer le fichier temporaire
                    if (System.IO.File.Exists(tempFilePath))
                    {
                        System.IO.File.Delete(tempFilePath);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors du téléversement du package pour le composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors du téléversement du package", details = ex.Message });
            }
        }

        /// <summary>
        /// Téléverse une icône pour un composant
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <param name="iconFile">Fichier de l'icône (SVG)</param>
        /// <returns>Résultat du téléversement</returns>
        [HttpPost("components/{componentId}/icon")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> UploadComponentIcon(int componentId, IFormFile iconFile)
        {
            try
            {
                if (iconFile == null || iconFile.Length == 0)
                {
                    return BadRequest(new { error = "Aucun fichier n'a été téléversé" });
                }

                // Vérifier le type de fichier (SVG uniquement)
                var extension = Path.GetExtension(iconFile.FileName).ToLowerInvariant();
                if (extension != ".svg" && iconFile.ContentType != "image/svg+xml")
                {
                    return BadRequest(new { error = "Le fichier doit être au format SVG" });
                }

                // Vérifier que le composant existe
                var component = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });

                // TODO: Implémenter la logique de sauvegarde de l'icône
                // Pour l'instant, nous simulons une opération réussie

                return Ok(new { success = true, message = "Icône téléversée avec succès" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors du téléversement de l'icône pour le composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors du téléversement de l'icône", details = ex.Message });
            }
        }

        /// <summary>
        /// Récupère l'icône d'un composant
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <returns>Fichier de l'icône</returns>
        [HttpGet("components/{componentId}/icon")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> GetComponentIcon(int componentId)
        {
            try
            {
                // Vérifier que le composant existe
                var component = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });

                // TODO: Implémenter la logique de récupération de l'icône
                // Pour l'instant, nous retournons une icône par défaut

                var defaultIconPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "images", "default-component.svg");
                if (System.IO.File.Exists(defaultIconPath))
                {
                    return PhysicalFile(defaultIconPath, "image/svg+xml");
                }
                else
                {
                    return NotFound(new { error = "Icône non trouvée" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération de l'icône du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération de l'icône", details = ex.Message });
            }
        }

        #endregion

        #region Versions Management Endpoints

        /// <summary>
        /// Récupère toutes les versions d'un composant
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <returns>Liste des versions du composant</returns>
        [HttpGet("components/{componentId}/versions")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<List<VersionViewModel>>> GetComponentVersions(int componentId)
        {
            try
            {
                // Vérifier que le composant existe
                var component = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });

                var versions = await _marketplaceService.GetComponentVersionsAsync(componentId);
                return Ok(versions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des versions du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération des versions", details = ex.Message });
            }
        }

        /// <summary>
        /// Récupère les détails d'une version spécifique
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <param name="versionId">ID de la version</param>
        /// <returns>Détails de la version</returns>
        [HttpGet("components/{componentId}/versions/{versionId}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<VersionViewModel>> GetComponentVersion(int componentId, int versionId)
        {
            try
            {
                // Vérifier que le composant existe
                var component = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });

                var version = await _marketplaceService.GetComponentVersionAsync(versionId);
                if (version == null)
                    return NotFound(new { error = "Version non trouvée" });

                return Ok(version);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des détails de la version {versionId} du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération des détails de la version", details = ex.Message });
            }
        }

        /// <summary>
        /// Crée une nouvelle version pour un composant
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <param name="model">Données de la version</param>
        /// <returns>ID de la version créée</returns>
        [HttpPost("components/{componentId}/versions")]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> CreateComponentVersion(int componentId, [FromBody] ComponentVersionCreateViewModel model)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                // Vérifier que le composant existe
                var component = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });

                var versionId = await _marketplaceService.CreateComponentVersionAsync(componentId, model);
                return CreatedAtAction(nameof(GetComponentVersion), new { componentId, versionId }, new { versionId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la création d'une version pour le composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la création de la version", details = ex.Message });
            }
        }

        /// <summary>
        /// Crée une nouvelle version avec un package pour un composant
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <param name="packageFile">Fichier du package</param>
        /// <param name="version">Version</param>
        /// <param name="changeLog">Notes de version</param>
        /// <param name="minPlatformVersion">Version minimale de la plateforme</param>
        /// <param name="isLatest">Définir comme version actuelle</param>
        /// <returns>ID de la version créée</returns>
        [HttpPost("components/{componentId}/versions/with-package")]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> CreateComponentVersionWithPackage(
            int componentId, 
            IFormFile packageFile,
            [FromForm] string version,
            [FromForm] string? changeLog = null,
            [FromForm] string? minPlatformVersion = null,
            [FromForm] bool isLatest = true)
        {
            try
            {
                if (packageFile == null || packageFile.Length == 0)
                {
                    return BadRequest(new { error = "Aucun fichier n'a été téléversé" });
                }

                // Vérifier que le composant existe
                var component = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });

                // Chemin temporaire pour enregistrer le fichier
                var tempFilePath = Path.GetTempFileName();
                try
                {
                    using (var stream = new FileStream(tempFilePath, FileMode.Create))
                    {
                        await packageFile.CopyToAsync(stream);
                    }

                    // Valider le package
                    var validationResult = await _packageService.ValidateComponentPackageAsync(tempFilePath);
                    if (!validationResult.IsValid)
                    {
                        return BadRequest(new { error = "Le package n'est pas valide", details = validationResult.ErrorMessage });
                    }

                    // Traiter le package d'abord pour obtenir l'URL
                    var packageResult = await _packageService.ProcessComponentPackageAsync(componentId, tempFilePath, version);
                    
                    if (!packageResult.Success)
                    {
                        return BadRequest(new { error = "Échec du traitement du package", details = packageResult.ErrorMessage });
                    }
                    
                    // Créer la version avec l'URL du package générée
                    var model = new ComponentVersionCreateViewModel
                    {
                        Version = version,
                        ChangeLog = changeLog ?? "",
                        MinPlatformVersion = minPlatformVersion ?? "",
                        IsLatest = isLatest,
                        PackageUrl = packageResult.PackageUrl // Assigner l'URL du package obtenue
                    };
                    
                    // Créer la version avec les informations complètes
                    var versionId = await _marketplaceService.CreateComponentVersionAsync(componentId, model);

                    return CreatedAtAction(nameof(GetComponentVersion), new { componentId, versionId }, new { versionId, version = packageResult });
                }
                finally
                {
                    // Supprimer le fichier temporaire
                    if (System.IO.File.Exists(tempFilePath))
                    {
                        System.IO.File.Delete(tempFilePath);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la création d'une version avec package pour le composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la création de la version avec package", details = ex.Message });
            }
        }

        /// <summary>
        /// Ajoute ou met à jour le package d'une version
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <param name="versionId">ID de la version</param>
        /// <param name="packageFile">Fichier du package</param>
        /// <returns>Résultat de la mise à jour</returns>
        [HttpPost("components/{componentId}/versions/{versionId}/package")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> UpdateVersionPackage(
            int componentId,
            int versionId,
            IFormFile packageFile)
        {
            try 
            {
                if (packageFile == null || packageFile.Length == 0)
                {
                    return BadRequest(new { error = "Aucun fichier n'a été téléversé" });
                }

                // Vérifier que le composant existe
                var component = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });
                
                // Vérifier que la version existe
                var version = await _marketplaceService.GetComponentVersionAsync(versionId);
                if (version == null)
                    return NotFound(new { error = "Version non trouvée" });
                
                // Chemin temporaire pour enregistrer le fichier
                var tempFilePath = Path.GetTempFileName();
                try
                {
                    using (var stream = new FileStream(tempFilePath, FileMode.Create))
                    {
                        await packageFile.CopyToAsync(stream);
                    }

                    // Valider le package
                    var validationResult = await _packageService.ValidateComponentPackageAsync(tempFilePath);
                    if (!validationResult.IsValid)
                    {
                        return BadRequest(new { error = "Le package n'est pas valide", details = validationResult.ErrorMessage });
                    }

                    // Traiter le package pour obtenir l'URL
                    var packageResult = await _packageService.ProcessComponentPackageAsync(componentId, tempFilePath, version.VersionNumber);
                    
                    if (!packageResult.Success)
                    {
                        return BadRequest(new { error = "Échec du traitement du package", details = packageResult.ErrorMessage });
                    }
                    
                    // Mettre à jour la version avec l'URL du package
                    var model = new ComponentVersionCreateViewModel
                    {
                        Version = version.VersionNumber,
                        ChangeLog = version.ChangeLog ?? "",
                        MinPlatformVersion = version.MinPlatformVersion ?? "",
                        IsLatest = version.IsLatest,
                        PackageUrl = packageResult.PackageUrl // Mettre à jour avec l'URL générée
                    };
                    
                    var success = await _marketplaceService.UpdateComponentVersionAsync(versionId, model);
                    if (!success)
                        return NotFound(new { error = "Version non trouvée ou impossible à mettre à jour" });
                    
                    // Mettre à jour aussi la version principale si c'est la version actuelle
                    if (version.IsLatest)
                    {
                        // Mettre à jour le composant principal avec la nouvelle URL du package
                        var updateModel = new ComponentUpdateViewModel
                        {
                            PackageUrl = packageResult.PackageUrl
                        };
                        
                        await _marketplaceService.UpdateComponentAsync(componentId, updateModel);
                    }
                    
                    return Ok(new { 
                        success = true,
                        message = "Package mis à jour avec succès",
                        packageUrl = packageResult.PackageUrl
                    });
                }
                finally
                {
                    // Supprimer le fichier temporaire
                    if (System.IO.File.Exists(tempFilePath))
                    {
                        System.IO.File.Delete(tempFilePath);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la mise à jour du package pour la version {versionId} du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la mise à jour du package", details = ex.Message });
            }
        }

        /// <summary>
        /// Met à jour une version existante
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <param name="versionId">ID de la version</param>
        /// <param name="model">Données de mise à jour</param>
        /// <returns>Statut de la mise à jour</returns>
        [HttpPut("components/{componentId}/versions/{versionId}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> UpdateComponentVersion(int componentId, int versionId, [FromBody] ComponentVersionCreateViewModel model)
        {
            try
            {
                // Vérifier si c'est une demande de "suppression logique" (désactivation)
                if (model != null && model.Version != null && model.Version.StartsWith("Désactivé_"))
                {
                    _logger.LogInformation($"Demande de suppression logique de la version {versionId} du composant {componentId}");
                    
                    // Vérifier que la version existe
                    var versionToDelete = await _marketplaceService.GetComponentVersionAsync(versionId);
                    if (versionToDelete == null)
                        return NotFound(new { error = "Version non trouvée" });
                    
                    // Empêcher la suppression de la version actuelle
                    if (versionToDelete.IsLatest)
                        return BadRequest(new { error = "Impossible de supprimer la version actuelle du composant. Veuillez définir une autre version comme actuelle avant de supprimer celle-ci." });
                }

                if (!ModelState.IsValid)
                {
                    _logger.LogWarning($"Validation du modèle a échoué: {string.Join(", ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage))}");
                    return BadRequest(ModelState);
                }
                
                // Valider les données reçues
                if (string.IsNullOrEmpty(model.Version))
                {
                    _logger.LogWarning($"La propriété Version est vide ou manquante: {System.Text.Json.JsonSerializer.Serialize(model)}");
                    return BadRequest(new { error = "Le numéro de version est requis" });
                }
                
                // Journaliser les données reçues pour le débogage
                _logger.LogInformation($"Mise à jour de version - données reçues: {System.Text.Json.JsonSerializer.Serialize(model)}");
                
                // Vérifier que le composant existe
                var component = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });
                
                // Vérifier que la version existe
                var version = await _marketplaceService.GetComponentVersionAsync(versionId);
                if (version == null)
                    return NotFound(new { error = "Version non trouvée" });
                
                var success = await _marketplaceService.UpdateComponentVersionAsync(versionId, model);
                if (!success)
                    return NotFound(new { error = "Version non trouvée ou impossible à mettre à jour" });
                
                // Journaliser le succès
                _logger.LogInformation($"Version mise à jour avec succès: componentId={componentId}, versionId={versionId}, version={model.Version}");
                
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la mise à jour de la version {versionId} du composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la mise à jour de la version", details = ex.Message });
            }
        }

        /// <summary>
        /// Définit une version comme version actuelle d'un composant
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <param name="versionId">ID de la version</param>
        /// <returns>Statut de la mise à jour</returns>
        [HttpPost("components/{componentId}/versions/{versionId}/setLatest")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> SetLatestVersion(int componentId, int versionId)
        {
            try
            {
                // Vérifier que le composant existe
                var component = await _marketplaceService.GetComponentAdminDetailAsync(componentId);
                if (component == null)
                    return NotFound(new { error = "Composant non trouvé" });

                // Vérifier que la version existe
                var version = await _marketplaceService.GetComponentVersionAsync(versionId);
                if (version == null)
                    return NotFound(new { error = "Version non trouvée" });

                var success = await _marketplaceService.SetLatestVersionAsync(componentId, versionId);
                if (!success)
                    return NotFound(new { error = "Version non trouvée ou impossible à définir comme actuelle" });

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la définition de la version {versionId} comme actuelle pour le composant {componentId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la définition de la version comme actuelle", details = ex.Message });
            }
        }

        #endregion

        #region API Keys Management Endpoints

        /// <summary>
        /// Récupère toutes les clés API
        /// </summary>
        /// <returns>Liste des clés API</returns>
        [HttpGet("apikeys")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<List<ApiKeyViewModel>>> GetApiKeys()
        {
            try
            {
                var apiKeys = await _marketplaceService.GetApiKeysAsync();
                return Ok(apiKeys);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des clés API");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la récupération des clés API", details = ex.Message });
            }
        }

        /// <summary>
        /// Crée une nouvelle clé API
        /// </summary>
        /// <param name="model">Données de la clé API</param>
        /// <returns>Clé API créée</returns>
        [HttpPost("apikeys")]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<ApiKeyViewModel>> CreateApiKey([FromBody] ApiKeyCreateViewModel model)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var apiKey = await _marketplaceService.CreateApiKeyAsync(model);
                return CreatedAtAction(nameof(GetApiKeys), null, apiKey);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la création de la clé API");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la création de la clé API", details = ex.Message });
            }
        }

        /// <summary>
        /// Supprime une clé API
        /// </summary>
        /// <param name="apiKeyId">ID de la clé API</param>
        /// <returns>Statut de la suppression</returns>
        [HttpDelete("apikeys/{apiKeyId}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> DeleteApiKey(int apiKeyId)
        {
            try
            {
                var success = await _marketplaceService.DeleteApiKeyAsync(apiKeyId);
                if (!success)
                    return NotFound(new { error = "Clé API non trouvée ou impossible à supprimer" });

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la suppression de la clé API {apiKeyId}");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la suppression de la clé API", details = ex.Message });
            }
        }

        #endregion

        #region GitHub Integration Endpoints

        /// <summary>
        /// Synchronise les composants depuis un dépôt GitHub
        /// </summary>
        /// <param name="repository">URL du dépôt GitHub</param>
        /// <returns>Résultats de la synchronisation</returns>
        [HttpPost("github/sync")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> SynchronizeFromGitHub([FromQuery] string repository)
        {
            try
            {
                if (string.IsNullOrEmpty(repository))
                {
                    return BadRequest(new { error = "L'URL du dépôt est requise" });
                }

                var syncResult = await _githubService.SynchronizeComponentsFromGitHubAsync(repository);
                
                // Formater la réponse en utilisant les champs de GitHubSyncResult
                var result = new 
                {
                    newComponents = syncResult.NewComponents,
                    updatedComponents = syncResult.UpdatedComponents,
                    failedComponents = syncResult.FailedComponents
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la synchronisation depuis GitHub");
                return StatusCode(500, new { error = "Une erreur est survenue lors de la synchronisation depuis GitHub", details = ex.Message });
            }
        }

        #endregion
    }
}