using System;
using System.IO;
using System.IO.Compression;
using System.Text.Json;
using System.Threading.Tasks;
using AvanteamMarketplace.Core.Services;
using Microsoft.Extensions.Logging;

namespace AvanteamMarketplace.Infrastructure.Services
{
    /// <summary>
    /// Implémentation du service de traitement des packages de composants
    /// </summary>
    public class ComponentPackageService : IComponentPackageService
    {
        private readonly ILogger<ComponentPackageService> _logger;
        private readonly string _packagesDirectory;
        private readonly string _baseUrl;
        
        public ComponentPackageService(
            ILogger<ComponentPackageService> logger,
            Microsoft.Extensions.Configuration.IConfiguration configuration)
        {
            _logger = logger;
            
            // Récupérer l'URL de base depuis la configuration
            _baseUrl = configuration["ApiBaseUrl"]?.Replace("/api", "") ?? 
                       "https://marketplace-dev.avanteam-online.com";
            
            if (_baseUrl.EndsWith("/"))
            {
                _baseUrl = _baseUrl.TrimEnd('/');
            }
            
            // Définir le répertoire de stockage des packages
            _packagesDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "packages");
            
            // S'assurer que le répertoire existe
            if (!Directory.Exists(_packagesDirectory))
            {
                Directory.CreateDirectory(_packagesDirectory);
            }
            
            _logger.LogInformation($"ComponentPackageService initialisé avec baseUrl: {_baseUrl}");
        }
        
        /// <summary>
        /// Traite un package de composant téléchargé
        /// </summary>
        public async Task<ComponentPackageResult> ProcessComponentPackageAsync(int componentId, string packagePath, string? version = null)
        {
            try
            {
                _logger.LogInformation($"Traitement du package pour le composant {componentId}");
                
                // Valider le package
                var validationResult = await ValidateComponentPackageAsync(packagePath);
                
                if (!validationResult.IsValid)
                {
                    return new ComponentPackageResult
                    {
                        Success = false,
                        ErrorMessage = validationResult.ErrorMessage
                    };
                }
                
                // Utiliser la version du package si non spécifiée
                if (string.IsNullOrEmpty(version))
                {
                    version = validationResult.Version;
                }
                
                // Copier le package dans le répertoire des packages
                string fileName = $"{validationResult.ComponentName}-{version}.zip";
                string destinationPath = Path.Combine(_packagesDirectory, fileName);
                
                File.Copy(packagePath, destinationPath, true);
                
                // Extraire l'icône si présente
                ExtractIconFromPackage(packagePath, validationResult.ComponentName);
                
                // Construire l'URL d'accès au package (URL complète)
                string packageUrl = $"{_baseUrl}/packages/{fileName}";
                
                _logger.LogInformation($"URL du package générée: {packageUrl}");
                
                return new ComponentPackageResult
                {
                    Success = true,
                    Version = version,
                    PackageUrl = packageUrl
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors du traitement du package pour le composant {componentId}: {ex.Message}");
                
                return new ComponentPackageResult
                {
                    Success = false,
                    ErrorMessage = $"Erreur lors du traitement du package: {ex.Message}"
                };
            }
        }
        
        /// <summary>
        /// Valide un package de composant
        /// </summary>
        public async Task<ComponentPackageValidationResult> ValidateComponentPackageAsync(string packagePath)
        {
            try
            {
                _logger.LogInformation($"Validation du package {packagePath}");
                
                if (!File.Exists(packagePath))
                {
                    return new ComponentPackageValidationResult
                    {
                        IsValid = false,
                        ErrorMessage = "Le fichier du package n'existe pas"
                    };
                }
                
                // Vérifier que le fichier est un ZIP valide
                if (!IsValidZipFile(packagePath))
                {
                    return new ComponentPackageValidationResult
                    {
                        IsValid = false,
                        ErrorMessage = "Le fichier n'est pas un package ZIP valide"
                    };
                }
                
                // Analyser le contenu du package
                bool hasManifest = false;
                bool hasReadme = false;
                string componentName = "";
                string version = "";
                
                using (var archive = ZipFile.OpenRead(packagePath))
                {
                    foreach (var entry in archive.Entries)
                    {
                        // Vérifier la présence du manifest.json
                        if (entry.FullName.Equals("manifest.json", StringComparison.OrdinalIgnoreCase))
                        {
                            hasManifest = true;
                            
                            // Lire le manifest pour extraire les informations
                            using (var stream = entry.Open())
                            using (var reader = new StreamReader(stream))
                            {
                                string json = await reader.ReadToEndAsync();
                                var manifest = JsonSerializer.Deserialize<System.Text.Json.JsonElement>(json);
                                
                                if (manifest.ValueKind == JsonValueKind.Object)
                                {
                                    if (manifest.TryGetProperty("name", out System.Text.Json.JsonElement nameProperty))
                                    {
                                        componentName = nameProperty.GetString() ?? "";
                                    }
                                    
                                    if (manifest.TryGetProperty("version", out System.Text.Json.JsonElement versionProperty))
                                    {
                                        version = versionProperty.GetString() ?? "";
                                    }
                                }
                            }
                        }
                        
                        // Vérifier la présence d'un README
                        if (entry.FullName.Equals("README.md", StringComparison.OrdinalIgnoreCase) ||
                            entry.FullName.Equals("readme.md", StringComparison.OrdinalIgnoreCase))
                        {
                            hasReadme = true;
                        }
                    }
                }
                
                // Vérifier les résultats
                if (!hasManifest)
                {
                    return new ComponentPackageValidationResult
                    {
                        IsValid = false,
                        HasManifest = false,
                        HasReadme = hasReadme,
                        ErrorMessage = "Le package ne contient pas de fichier manifest.json"
                    };
                }
                
                if (string.IsNullOrEmpty(componentName) || string.IsNullOrEmpty(version))
                {
                    return new ComponentPackageValidationResult
                    {
                        IsValid = false,
                        HasManifest = true,
                        HasReadme = hasReadme,
                        ErrorMessage = "Le manifest.json ne contient pas toutes les informations requises (nom, version)"
                    };
                }
                
                return new ComponentPackageValidationResult
                {
                    IsValid = true,
                    ComponentName = componentName,
                    Version = version,
                    HasManifest = true,
                    HasReadme = hasReadme
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la validation du package {packagePath}: {ex.Message}");
                
                return new ComponentPackageValidationResult
                {
                    IsValid = false,
                    ErrorMessage = $"Erreur lors de la validation du package: {ex.Message}"
                };
            }
        }
        
        /// <summary>
        /// Génère un package de composant à partir d'un répertoire source
        /// </summary>
        public async Task<string> GenerateComponentPackageAsync(string sourcePath, string componentName, string version)
        {
            try
            {
                _logger.LogInformation($"Génération du package pour {componentName} v{version}");
                
                if (!Directory.Exists(sourcePath))
                {
                    throw new DirectoryNotFoundException($"Le répertoire source '{sourcePath}' n'existe pas");
                }
                
                // Créer un nom de fichier pour le package
                string fileName = $"{componentName}-{version}.zip";
                string packagePath = Path.Combine(_packagesDirectory, fileName);
                
                // Créer l'archive ZIP
                if (File.Exists(packagePath))
                {
                    File.Delete(packagePath);
                }
                
                ZipFile.CreateFromDirectory(sourcePath, packagePath, CompressionLevel.Optimal, false);
                
                return packagePath;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la génération du package pour {componentName} v{version}: {ex.Message}");
                throw;
            }
        }
        
        /// <summary>
        /// Vérifie si un fichier est un ZIP valide
        /// </summary>
        private bool IsValidZipFile(string filePath)
        {
            try
            {
                using (var archive = ZipFile.OpenRead(filePath))
                {
                    // Si on peut ouvrir l'archive, elle est valide
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }
        
        /// <summary>
        /// Extrait l'icône d'un package et la sauvegarde dans le répertoire des images
        /// </summary>
        private void ExtractIconFromPackage(string packagePath, string componentName)
        {
            try
            {
                // Définir le répertoire des images
                string imagesDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "images");
                
                // S'assurer que le répertoire existe
                if (!Directory.Exists(imagesDirectory))
                {
                    Directory.CreateDirectory(imagesDirectory);
                }
                
                using (var archive = ZipFile.OpenRead(packagePath))
                {
                    // Rechercher l'icône dans le package
                    var iconEntry = archive.GetEntry("images/icon.svg");
                    
                    // Si l'icône est trouvée, l'extraire
                    if (iconEntry != null)
                    {
                        _logger.LogInformation($"Icône trouvée pour le composant {componentName}, extraction en cours...");
                        
                        // Sauvegarder l'icône avec le nom technique du composant
                        string iconPath = Path.Combine(imagesDirectory, $"{componentName}.svg");
                        using (var entryStream = iconEntry.Open())
                        using (var fileStream = new FileStream(iconPath, FileMode.Create))
                        {
                            entryStream.CopyTo(fileStream);
                        }
                        _logger.LogInformation($"Icône extraite avec succès pour le composant {componentName}");
                        
                        // Extraire également l'icône en utilisant les tags comme noms de fichiers
                        // Le client Process Studio recherche les icônes par tag plutôt que par nom technique
                        try
                        {
                            var manifestEntry = archive.GetEntry("manifest.json");
                            if (manifestEntry != null)
                            {
                                using (var stream = manifestEntry.Open())
                                using (var reader = new StreamReader(stream))
                                {
                                    string json = reader.ReadToEnd();
                                    var manifest = JsonSerializer.Deserialize<System.Text.Json.JsonElement>(json);
                                    
                                    if (manifest.ValueKind == JsonValueKind.Object && 
                                        manifest.TryGetProperty("tags", out System.Text.Json.JsonElement tagsProperty) && 
                                        tagsProperty.ValueKind == JsonValueKind.Array)
                                    {
                                        // Pour chaque tag, créer une copie de l'icône
                                        foreach (var tag in tagsProperty.EnumerateArray())
                                        {
                                            string? tagName = tag.GetString();
                                            if (!string.IsNullOrEmpty(tagName))
                                            {
                                                string tagIconPath = Path.Combine(imagesDirectory, $"{tagName}.svg");
                                                using (var entryStream = iconEntry.Open())
                                                using (var fileStream = new FileStream(tagIconPath, FileMode.Create))
                                                {
                                                    entryStream.CopyTo(fileStream);
                                                }
                                                _logger.LogInformation($"Copie de l'icône créée pour le tag {tagName}");
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        catch (Exception tagEx)
                        {
                            _logger.LogWarning(tagEx, $"Échec de la création d'icônes pour les tags: {tagEx.Message}");
                        }
                    }
                    else
                    {
                        _logger.LogWarning($"Aucune icône (images/icon.svg) trouvée pour le composant {componentName}");
                    }
                }
            }
            catch (Exception ex)
            {
                // Ne pas faire échouer l'ensemble du processus si l'extraction de l'icône échoue
                _logger.LogError(ex, $"Erreur lors de l'extraction de l'icône pour le composant {componentName}: {ex.Message}");
            }
        }
    }
}