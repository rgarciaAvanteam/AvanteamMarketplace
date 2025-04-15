using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using AvanteamMarketplace.Core.Services;
using AvanteamMarketplace.Core.ViewModels;
using Microsoft.Extensions.Logging;
using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using System.IO;
using System.IO.Compression;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using AvanteamMarketplace.Infrastructure.Data;

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
        private readonly MarketplaceDbContext _context;
        
        // Méthode utilitaire pour extraire les tags d'un manifest
        private string[] GetTagsFromManifest(JsonElement manifest)
        {
            if (manifest.TryGetProperty("tags", out var tagsElement) && tagsElement.ValueKind == JsonValueKind.Array)
            {
                var tags = new List<string>();
                foreach (var tag in tagsElement.EnumerateArray())
                {
                    if (tag.ValueKind == JsonValueKind.String)
                    {
                        tags.Add(tag.GetString() ?? "");
                    }
                }
                return tags.Where(t => !string.IsNullOrEmpty(t)).ToArray();
            }
            return Array.Empty<string>();
        }

        public ComponentsManagementController(
            IMarketplaceService marketplaceService,
            IGitHubIntegrationService githubService,
            IComponentPackageService packageService,
            MarketplaceDbContext context,
            ILogger<ComponentsManagementController> logger)
        {
            _marketplaceService = marketplaceService;
            _githubService = githubService;
            _packageService = packageService;
            _context = context;
            _logger = logger;
        }

        #region Components Management Endpoints

        /// <summary>
        /// Extrait les métadonnées d'un manifest.json contenu dans un fichier ZIP
        /// </summary>
        /// <param name="packageFile">Le fichier ZIP à analyser</param>
        /// <returns>Les métadonnées extraites du manifest.json</returns>
        [HttpPost("components/extract-manifest")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> ExtractManifestFromPackage(IFormFile packageFile)
        {
            try
            {
                if (packageFile == null || packageFile.Length == 0)
                {
                    return BadRequest(new { error = "Aucun fichier n'a été téléversé" });
                }

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

                    // Extraire le contenu du manifest
                    string? manifestContent = null;
                    string? readmeContent = null;
                    
                    using (var archive = ZipFile.OpenRead(tempFilePath))
                    {
                        // Rechercher manifest.json à la racine ou dans un sous-dossier de premier niveau
                        var manifestEntry = archive.Entries.FirstOrDefault(e => 
                            e.FullName.Equals("manifest.json", StringComparison.OrdinalIgnoreCase) ||
                            e.FullName.EndsWith("/manifest.json", StringComparison.OrdinalIgnoreCase));
                        
                        if (manifestEntry != null)
                        {
                            using (var stream = manifestEntry.Open())
                            using (var reader = new StreamReader(stream))
                            {
                                manifestContent = await reader.ReadToEndAsync();
                            }
                        }
                        
                        // Rechercher README.md à la racine ou dans un sous-dossier de premier niveau
                        var readmeEntry = archive.Entries.FirstOrDefault(e => 
                            e.FullName.Equals("README.md", StringComparison.OrdinalIgnoreCase) ||
                            e.FullName.Equals("readme.md", StringComparison.OrdinalIgnoreCase) ||
                            e.FullName.EndsWith("/README.md", StringComparison.OrdinalIgnoreCase) ||
                            e.FullName.EndsWith("/readme.md", StringComparison.OrdinalIgnoreCase));
                        
                        if (readmeEntry != null)
                        {
                            using (var stream = readmeEntry.Open())
                            using (var reader = new StreamReader(stream))
                            {
                                readmeContent = await reader.ReadToEndAsync();
                            }
                        }
                    }

                    if (string.IsNullOrEmpty(manifestContent))
                    {
                        return BadRequest(new { error = "Le package ne contient pas de fichier manifest.json" });
                    }

                    // Parser le manifest
                    var manifest = JsonSerializer.Deserialize<JsonElement>(manifestContent);
                    
                    // Vérifier si l'URL du dépôt est présente
                    string repoUrl = "";
                    if (manifest.TryGetProperty("repositoryUrl", out var repositoryUrl) && !string.IsNullOrEmpty(repositoryUrl.GetString()))
                    {
                        repoUrl = repositoryUrl.GetString();
                        _logger.LogInformation($"URL du dépôt trouvée dans le manifest: {repoUrl}");
                    }
                    else if (manifest.TryGetProperty("repository", out var repository))
                    {
                        // Certains manifests peuvent utiliser "repository" au lieu de "repositoryUrl"
                        if (repository.ValueKind == JsonValueKind.String && !string.IsNullOrEmpty(repository.GetString()))
                        {
                            repoUrl = repository.GetString();
                            _logger.LogInformation($"URL du dépôt trouvée dans le champ repository: {repoUrl}");
                        }
                        else if (repository.ValueKind == JsonValueKind.Object)
                        {
                            // Format npm-style avec repository.url
                            if (repository.TryGetProperty("url", out var repoUrlProperty) && !string.IsNullOrEmpty(repoUrlProperty.GetString()))
                            {
                                repoUrl = repoUrlProperty.GetString();
                                _logger.LogInformation($"URL du dépôt trouvée dans repository.url: {repoUrl}");
                            }
                        }
                    }

                    // Extraire le targetPath
                    string targetPath = "";
                    if (manifest.TryGetProperty("installation", out var installation) && installation.ValueKind == JsonValueKind.Object)
                    {
                        if (installation.TryGetProperty("targetPath", out var targetPathProperty) && !string.IsNullOrEmpty(targetPathProperty.GetString()))
                        {
                            targetPath = targetPathProperty.GetString();
                            _logger.LogInformation($"Target path trouvé dans le manifest: {targetPath}");
                        }
                    }
                    
                    // Extraire le nom et la version
                    string componentName = manifest.TryGetProperty("name", out var nameProperty) ? nameProperty.GetString() : "";
                    string componentVersion = manifest.TryGetProperty("version", out var versionProperty) ? versionProperty.GetString() : "";
                    
                    // Générer une URL de package à partir du nom et de la version
                    string packageUrl = "";
                    if (!string.IsNullOrEmpty(componentName) && !string.IsNullOrEmpty(componentVersion))
                    {
                        string fileName = $"{componentName}-{componentVersion}.zip";
                        
                        // Utiliser l'URL de base complète depuis la configuration si disponible
                        var baseUrl = _packageService.GetPackageBaseUrl();
                        if (!string.IsNullOrEmpty(baseUrl))
                        {
                            // Utiliser la base URL du service
                            packageUrl = $"{baseUrl}/packages/{fileName}";
                        }
                        else
                        {
                            // Fallback: Utiliser l'URL de la requête actuelle
                            packageUrl = $"{Request.Scheme}://{Request.Host}/packages/{fileName}";
                        }
                        
                        _logger.LogInformation($"Package URL générée: {packageUrl}");
                    }
                    
                    // Créer un objet de réponse avec les informations extraites
                    var componentData = new
                    {
                        name = componentName,
                        displayName = manifest.TryGetProperty("displayName", out var displayName) ? displayName.GetString() : "",
                        description = manifest.TryGetProperty("description", out var description) ? description.GetString() : "",
                        version = componentVersion,
                        category = manifest.TryGetProperty("category", out var category) ? category.GetString() : "",
                        author = manifest.TryGetProperty("author", out var author) ? author.GetString() : "Avanteam",
                        minPlatformVersion = manifest.TryGetProperty("minPlatformVersion", out var minPlatformVersion) ? minPlatformVersion.GetString() : "",
                        requiresRestart = manifest.TryGetProperty("requiresRestart", out var requiresRestart) && requiresRestart.ValueKind == JsonValueKind.True,
                        repositoryUrl = repoUrl,
                        targetPath = targetPath,
                        packageUrl = packageUrl,  // Cette URL est utilisée côté client
                        tags = GetTagsFromManifest(manifest),
                        readmeContent = readmeContent
                    };
                    
                    // Générer un identifiant unique pour le fichier temporaire
                    string packageKey = Guid.NewGuid().ToString();
                    
                    // Créer le répertoire des packages s'il n'existe pas
                    string packageDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "packages");
                    if (!Directory.Exists(packageDirectory))
                    {
                        Directory.CreateDirectory(packageDirectory);
                    }
                    
                    // Copier immédiatement le fichier dans le répertoire des packages pour que l'URL soit valide
                    if (!string.IsNullOrEmpty(componentName) && !string.IsNullOrEmpty(componentVersion) && !string.IsNullOrEmpty(packageUrl))
                    {
                        string fileName = $"{componentName}-{componentVersion}.zip";
                        string destinationPath = Path.Combine(packageDirectory, fileName);
                        
                        try
                        {
                            // Faire une copie immédiate du fichier pour assurer que l'URL sera valide
                            System.IO.File.Copy(tempFilePath, destinationPath, true);
                            _logger.LogInformation($"Fichier copié avec succès vers {destinationPath}");
                            
                            // Vérifier si le fichier a bien été copié
                            if (System.IO.File.Exists(destinationPath))
                            {
                                var fileInfo = new FileInfo(destinationPath);
                                _logger.LogInformation($"Le fichier existe bien à {destinationPath}, taille: {fileInfo.Length} bytes");
                                
                                // Vérifier que l'URL est toujours valide
                                _logger.LogCritical($"URL du package avant l'envoi au frontend: [{packageUrl}]");
                            }
                            else
                            {
                                _logger.LogWarning($"Le fichier NE SEMBLE PAS AVOIR ÉTÉ COPIÉ à {destinationPath}");
                            }
                        }
                        catch (Exception copyEx)
                        {
                            _logger.LogWarning($"Impossible de copier le fichier vers {destinationPath}: {copyEx.Message}");
                        }
                    }
                    else
                    {
                        _logger.LogWarning($"Impossible de copier le fichier - informations manquantes: componentName={componentName}, componentVersion={componentVersion}, packageUrl={packageUrl}");
                    }
                    
                    // Stocker le chemin du fichier temporaire en session (pour une utilisation ultérieure)
                    HttpContext.Session.SetString($"TempPackage_{packageKey}", tempFilePath);
                    
                    return Ok(new { 
                        componentData = componentData,
                        packageKey = packageKey
                    });
                }
                catch (Exception ex)
                {
                    // Supprimer le fichier temporaire en cas d'erreur
                    if (System.IO.File.Exists(tempFilePath))
                    {
                        System.IO.File.Delete(tempFilePath);
                    }
                    
                    _logger.LogError(ex, "Erreur lors de l'extraction du manifest du package");
                    return StatusCode(500, new { error = "Une erreur est survenue lors de l'extraction du manifest", details = ex.Message });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de l'extraction du manifest du package");
                return StatusCode(500, new { error = "Une erreur est survenue lors de l'extraction du manifest", details = ex.Message });
            }
        }
        
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
        /// <param name="packageKey">Clé du package temporaire (optionnel)</param>
        /// <returns>ID du composant créé et statut de la création</returns>
        [HttpPost("components")]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> CreateComponent([FromBody] ComponentCreateViewModel model, [FromQuery] string? packageKey = null)
        {
            try
            {
                // Log de débogage pour voir ce qui est reçu
                _logger.LogInformation($"Création de composant - Modèle reçu: PackageUrl={model.PackageUrl}, TargetPath={model.TargetPath}, Name={model.Name}, Version={model.Version}");
                
                if (!ModelState.IsValid)
                {
                    _logger.LogWarning("Validation du modèle échouée");
                    return BadRequest(ModelState);
                }

                var componentId = await _marketplaceService.CreateComponentAsync(model);
                
                // Vérifier immédiatement si le composant a été correctement créé avec le PackageUrl
                var componentAfterCreation = await _context.Components.FindAsync(componentId);
                if (componentAfterCreation != null && string.IsNullOrEmpty(componentAfterCreation.PackageUrl) && !string.IsNullOrEmpty(model.PackageUrl))
                {
                    _logger.LogCritical($"CORRECTION IMMÉDIATE - Le composant {componentId} a été créé sans PackageUrl, tentative de correction directe");
                    
                    // Mise à jour d'urgence directe
                    componentAfterCreation.PackageUrl = model.PackageUrl;
                    await _context.SaveChangesAsync();
                    
                    _logger.LogCritical($"CORRECTION IMMÉDIATE - PackageUrl défini à [{componentAfterCreation.PackageUrl}]");
                    
                    // Double vérification avec requête SQL directe
                    await _context.Database.ExecuteSqlRawAsync(
                        "UPDATE Components SET PackageUrl = {0} WHERE ComponentId = {1}",
                        model.PackageUrl, componentId);
                        
                    _logger.LogCritical($"CORRECTION IMMÉDIATE - Mise à jour SQL exécutée");
                }
                
                // Si un package a été fourni, le traiter après la création du composant
                if (!string.IsNullOrEmpty(packageKey))
                {
                    try
                    {
                        // Récupérer le chemin du fichier temporaire depuis la session
                        var tempFilePath = HttpContext.Session.GetString($"TempPackage_{packageKey}");
                        
                        if (!string.IsNullOrEmpty(tempFilePath) && System.IO.File.Exists(tempFilePath))
                        {
                            // Traiter le package
                            var packageResult = await _packageService.ProcessComponentPackageAsync(componentId, tempFilePath, model.Version);
                            
                            if (packageResult.Success)
                            {
                                // Mettre à jour le composant avec les informations extraites du package
                                var updateModel = new ComponentUpdateViewModel
                                {
                                    PackageUrl = packageResult.PackageUrl,
                                    RepositoryUrl = !string.IsNullOrEmpty(packageResult.RepositoryUrl) ? packageResult.RepositoryUrl : model.RepositoryUrl,
                                    TargetPath = !string.IsNullOrEmpty(packageResult.TargetPath) ? packageResult.TargetPath : model.TargetPath,
                                    MinPlatformVersion = !string.IsNullOrEmpty(packageResult.MinPlatformVersion) ? packageResult.MinPlatformVersion : model.MinPlatformVersion
                                };
                                
                                var updateSuccess = await _marketplaceService.UpdateComponentAsync(componentId, updateModel);
                                
                                if (updateSuccess)
                                {
                                    _logger.LogInformation($"Package traité avec succès pour le nouveau composant {componentId}");
                                }
                                else
                                {
                                    _logger.LogWarning($"Mise à jour des informations de package échouée pour le composant {componentId}");
                                    
                                    // Tentative de correction directe
                                    if (!string.IsNullOrEmpty(packageResult.PackageUrl))
                                    {
                                        _logger.LogCritical($"Tentative de correction directe du PackageUrl pour le composant {componentId}");
                                        await _context.Database.ExecuteSqlRawAsync(
                                            "UPDATE Components SET PackageUrl = {0} WHERE ComponentId = {1}",
                                            packageResult.PackageUrl, componentId);
                                    }
                                }
                            }
                            else
                            {
                                _logger.LogWarning($"Échec du traitement du package pour le nouveau composant {componentId}: {packageResult.ErrorMessage}");
                            }
                            
                            // Le fichier a été traité par ProcessComponentPackageAsync qui l'a déjà copié dans le répertoire des packages
                            // On peut donc supprimer le fichier temporaire
                            try {
                                if (System.IO.File.Exists(tempFilePath)) {
                                    System.IO.File.Delete(tempFilePath);
                                }
                            }
                            catch (Exception deleteEx) {
                                _logger.LogWarning($"Impossible de supprimer le fichier temporaire: {deleteEx.Message}");
                            }
                            
                            // Nettoyer la session
                            HttpContext.Session.Remove($"TempPackage_{packageKey}");
                        }
                        else
                        {
                            _logger.LogWarning($"Fichier temporaire introuvable pour la clé {packageKey}");
                        }
                    }
                    catch (Exception packageEx)
                    {
                        _logger.LogError(packageEx, $"Erreur lors du traitement du package pour le nouveau composant {componentId}");
                        // Ne pas faire échouer la création du composant si le traitement du package échoue
                    }
                }
                // Si aucun package n'est fourni mais qu'on a un packageUrl dans le modèle (provenant du manifest),
                // nous devons copier le fichier temporaire analysé vers le répertoire des packages
                else if (!string.IsNullOrEmpty(model.PackageUrl) && model.PackageUrl != "https://avanteam-online.com/no-package")
                {
                    try
                    {
                        _logger.LogInformation($"PackageUrl fourni dans le modèle: {model.PackageUrl}");
                        
                        // Extraire le nom du fichier de l'URL
                        string fileName = Path.GetFileName(new Uri(model.PackageUrl).AbsolutePath);
                        
                        if (!string.IsNullOrEmpty(fileName))
                        {
                            // Chemin de destination du fichier
                            string packageDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "packages");
                            
                            // S'assurer que le répertoire existe
                            if (!Directory.Exists(packageDirectory))
                            {
                                Directory.CreateDirectory(packageDirectory);
                            }
                            
                            // Chemin complet du fichier de destination
                            string destinationPath = Path.Combine(packageDirectory, fileName);
                            
                            // Parcourir toutes les clés de session et chercher des fichiers temporaires
                            var tempKeys = new List<string>();
                            foreach (var key in HttpContext.Session.Keys)
                            {
                                if (key.StartsWith("TempPackage_"))
                                {
                                    tempKeys.Add(key);
                                }
                            }
                            
                            bool packageSaved = false;
                            foreach (var key in tempKeys)
                            {
                                var tempFilePath = HttpContext.Session.GetString(key);
                                
                                if (!string.IsNullOrEmpty(tempFilePath) && System.IO.File.Exists(tempFilePath))
                                {
                                    _logger.LogInformation($"Copie du fichier temporaire {tempFilePath} vers {destinationPath}");
                                    
                                    // Copier le fichier temporaire vers le répertoire des packages
                                    System.IO.File.Copy(tempFilePath, destinationPath, true);
                                    
                                    // Supprimer le fichier temporaire
                                    System.IO.File.Delete(tempFilePath);
                                    
                                    // Nettoyer la session
                                    HttpContext.Session.Remove(key);
                                    
                                    _logger.LogInformation($"Fichier package sauvegardé avec succès pour le composant {componentId}");
                                    packageSaved = true;
                                    break;
                                }
                            }
                            
                            if (!packageSaved)
                            {
                                _logger.LogWarning($"Aucun fichier temporaire trouvé pour créer le package {fileName}");
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Erreur lors de la sauvegarde du fichier package pour le composant {componentId}");
                    }
                }
                
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
                    
                    // Créer la version avec l'URL du package générée et les informations extraites
                    var model = new ComponentVersionCreateViewModel
                    {
                        Version = version,
                        ChangeLog = changeLog ?? "",
                        MinPlatformVersion = !string.IsNullOrEmpty(packageResult.MinPlatformVersion) ? packageResult.MinPlatformVersion : (minPlatformVersion ?? ""),
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