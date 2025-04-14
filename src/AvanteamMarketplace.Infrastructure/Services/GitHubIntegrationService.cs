using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using AvanteamMarketplace.Core.Models;
using AvanteamMarketplace.Core.Services;
using AvanteamMarketplace.Core.ViewModels;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AvanteamMarketplace.Infrastructure.Services
{
    /// <summary>
    /// Implémentation du service d'intégration avec GitHub
    /// </summary>
    public class GitHubIntegrationService : IGitHubIntegrationService
    {
        private readonly ILogger<GitHubIntegrationService> _logger;
        private readonly HttpClient _httpClient;
        private readonly IMarketplaceService _marketplaceService;
        private readonly IComponentPackageService _packageService;
        private readonly string _tempDirectory;
        private readonly string _owner;
        private readonly string _componentsRepository;
        
        public GitHubIntegrationService(
            ILogger<GitHubIntegrationService> logger,
            HttpClient httpClient,
            IMarketplaceService marketplaceService,
            IComponentPackageService packageService,
            IConfiguration configuration)
        {
            _logger = logger;
            _httpClient = httpClient;
            _marketplaceService = marketplaceService;
            _packageService = packageService;
            
            // Récupérer les paramètres de configuration GitHub
            var githubConfig = configuration.GetSection("GitHub");
            _owner = githubConfig["Owner"] ?? "avanteam";
            _componentsRepository = githubConfig["ComponentsRepository"] ?? "components";
            
            // Configurer l'HttpClient pour GitHub
            string token = githubConfig["PersonalAccessToken"];
            if (!string.IsNullOrEmpty(token))
            {
                _httpClient.DefaultRequestHeaders.Add("Authorization", $"token {token}");
            }
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "AvanteamMarketplace");
            
            _logger.LogInformation($"Service GitHub initialisé - Owner: {_owner}, Repository: {_componentsRepository}");
            
            // Définir le répertoire temporaire pour les téléchargements
            _tempDirectory = Path.Combine(Path.GetTempPath(), "AvanteamMarketplace", "Github");
            
            // S'assurer que le répertoire existe
            if (!Directory.Exists(_tempDirectory))
            {
                Directory.CreateDirectory(_tempDirectory);
            }
        }
        
        /// <summary>
        /// Synchronise les composants à partir d'un dépôt GitHub
        /// </summary>
        public async Task<GitHubSyncResult> SynchronizeComponentsFromGitHubAsync(string repositoryUrl)
        {
            var result = new GitHubSyncResult();
            
            try
            {
                _logger.LogInformation($"Synchronisation des composants depuis {repositoryUrl}");
                
                // Extraire les informations du dépôt
                var (owner, repo) = ExtractRepositoryInfo(repositoryUrl);
                
                if (string.IsNullOrEmpty(owner) || string.IsNullOrEmpty(repo))
                {
                    result.FailedComponents.Add(repositoryUrl);
                    return result;
                }
                
                // Récupérer la liste des branches
                var branches = await GetRepositoryBranchesAsync(owner, repo);
                _logger.LogInformation($"Branches trouvées: {string.Join(", ", branches)}");
                
                // Récupérer la liste des tags (versions)
                var tags = await GetRepositoryTagsAsync(owner, repo);
                _logger.LogInformation($"Tags trouvés: {string.Join(", ", tags)}");
                
                // Parcourir les dossiers pour trouver les composants
                // Pour simplifier l'exemple, on considère que chaque composant est dans un dossier à la racine du dépôt
                var directories = await GetRepositoryDirectoriesAsync(owner, repo);
                _logger.LogInformation($"Répertoires trouvés: {string.Join(", ", directories)}");
                
                // Si aucun répertoire n'est trouvé, essayer de traiter le dépôt lui-même comme un composant
                if (directories.Count == 0 || (directories.Count == 1 && directories[0] == ".github"))
                {
                    _logger.LogInformation("Aucun répertoire de composant trouvé, traitement du dépôt comme composant");
                    try 
                    {
                        // Vérifier si le manifest.json existe à la racine
                        var manifestContent = await GetManifestContentAsync($"https://github.com/{owner}/{repo}");
                        
                        if (!string.IsNullOrEmpty(manifestContent))
                        {
                            // Analyser le manifest pour déterminer le nom du composant
                            var manifest = JsonSerializer.Deserialize<JsonElement>(manifestContent);
                            string componentName = manifest.GetProperty("name").GetString();
                            
                            _logger.LogInformation($"Composant trouvé à la racine: {componentName}");
                            
                            // Vérifier si le composant existe déjà
                            var existingComponent = await _marketplaceService.GetComponentByRepositoryUrlAsync(
                                $"https://github.com/{owner}/{repo}");
                            
                            if (existingComponent == null)
                            {
                                _logger.LogInformation($"Ajout du nouveau composant: {componentName}");
                                
                                // Créer le composant
                                var componentModel = CreateComponentFromManifest(manifest, repositoryUrl);
                                int componentId = await _marketplaceService.CreateComponentAsync(componentModel);
                                
                                // Télécharger et attacher le package
                                await CreateAndAttachPackageAsync(owner, repo, componentId, componentModel.Version);
                                
                                result.NewComponents.Add(componentName);
                            }
                            else
                            {
                                _logger.LogInformation($"Le composant existe déjà: {componentName}");
                                result.UpdatedComponents.Add($"{componentName} (existe déjà)");
                                
                                // Vérifier si on doit mettre à jour le package
                                if (existingComponent.Versions != null && existingComponent.Versions.Any())
                                {
                                    await CreateAndAttachPackageAsync(owner, repo, existingComponent.ComponentId, 
                                        existingComponent.Versions.FirstOrDefault(v => v.IsLatest)?.Version ?? existingComponent.Versions.First().Version);
                                }
                            }
                        }
                        else
                        {
                            _logger.LogWarning("Aucun manifest.json trouvé à la racine");
                            result.FailedComponents.Add(repositoryUrl);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Erreur lors de la synchronisation du dépôt racine: {ex.Message}");
                        result.FailedComponents.Add(repositoryUrl);
                    }
                    
                    return result;
                }
                
                foreach (var directory in directories)
                {
                    // Ignorer le répertoire .github qui contient les workflows GitHub Actions
                    if (directory == ".github")
                    {
                        continue;
                    }
                    
                    try
                    {
                        _logger.LogInformation($"Traitement du répertoire: {directory}");
                        
                        // Vérifier s'il s'agit d'un composant valide (contient un manifest.json)
                        var manifestContent = await GetManifestContentAsync($"https://github.com/{owner}/{repo}/tree/main/{directory}");
                        
                        if (!string.IsNullOrEmpty(manifestContent))
                        {
                            // Analyser le manifest pour déterminer le nom du composant
                            var manifest = JsonSerializer.Deserialize<JsonElement>(manifestContent);
                            string componentName = manifest.GetProperty("name").GetString();
                            
                            _logger.LogInformation($"Composant trouvé: {componentName}");
                            
                            // Vérifier si le composant existe déjà dans la base de données
                            var existingComponent = await _marketplaceService.GetComponentByRepositoryUrlAsync(
                                $"https://github.com/{owner}/{repo}/tree/main/{directory}");
                            
                            if (existingComponent == null)
                            {
                                _logger.LogInformation($"Ajout du nouveau composant: {componentName}");
                                
                                // Créer le composant
                                var componentModel = CreateComponentFromManifest(manifest, $"https://github.com/{owner}/{repo}/tree/main/{directory}");
                                int componentId = await _marketplaceService.CreateComponentAsync(componentModel);
                                
                                // Télécharger et attacher le package
                                await CreateAndAttachPackageAsync(owner, repo, componentId, componentModel.Version, directory);
                                
                                result.NewComponents.Add(componentName);
                            }
                            else
                            {
                                _logger.LogInformation($"Le composant existe déjà: {componentName}");
                                result.UpdatedComponents.Add($"{componentName} (existe déjà)");
                                
                                // Vérifier si on doit mettre à jour le package
                                if (existingComponent.Versions != null && existingComponent.Versions.Any())
                                {
                                    await CreateAndAttachPackageAsync(owner, repo, existingComponent.ComponentId, 
                                        existingComponent.Versions.FirstOrDefault(v => v.IsLatest)?.Version ?? existingComponent.Versions.First().Version,
                                        directory);
                                }
                            }
                        }
                        else
                        {
                            _logger.LogWarning($"Aucun manifest.json trouvé dans {directory}");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Erreur lors de la synchronisation du composant {directory}: {ex.Message}");
                        result.FailedComponents.Add(directory);
                    }
                }
                
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la synchronisation depuis {repositoryUrl}: {ex.Message}");
                result.FailedComponents.Add(repositoryUrl);
                return result;
            }
        }
        
        /// <summary>
        /// Récupère le contenu README d'un dépôt GitHub
        /// </summary>
        public async Task<string> GetReadmeContentAsync(string repositoryUrl)
        {
            try
            {
                _logger.LogInformation($"Récupération du README depuis {repositoryUrl}");
                
                // Extraire les informations du dépôt
                var (owner, repo) = ExtractRepositoryInfo(repositoryUrl);
                
                if (string.IsNullOrEmpty(owner) || string.IsNullOrEmpty(repo))
                {
                    return null;
                }
                
                // Construire l'URL de l'API GitHub pour le README
                string apiUrl = $"https://api.github.com/repos/{owner}/{repo}/readme";
                
                // Faire la requête à l'API GitHub
                var request = new HttpRequestMessage(HttpMethod.Get, apiUrl);
                request.Headers.Add("Accept", "application/vnd.github.v3+json");
                request.Headers.Add("User-Agent", "AvanteamMarketplace");
                
                var response = await _httpClient.SendAsync(request);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"Erreur lors de la récupération du README: {response.StatusCode}");
                    return null;
                }
                
                // Lire le contenu de la réponse
                var content = await response.Content.ReadAsStringAsync();
                var readmeInfo = JsonSerializer.Deserialize<JsonElement>(content);
                
                // Le contenu est encodé en base64
                string encodedContent = readmeInfo.GetProperty("content").GetString();
                
                // Décoder le contenu
                string decodedContent = System.Text.Encoding.UTF8.GetString(
                    Convert.FromBase64String(encodedContent.Replace("\n", ""))
                );
                
                return decodedContent;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération du README depuis {repositoryUrl}: {ex.Message}");
                return null;
            }
        }
        
        /// <summary>
        /// Récupère le fichier manifest.json d'un dépôt GitHub
        /// </summary>
        public async Task<string> GetManifestContentAsync(string repositoryUrl)
        {
            try
            {
                _logger.LogInformation($"Récupération du manifest.json depuis {repositoryUrl}");
                
                // Extraire les informations du dépôt
                var (owner, repo) = ExtractRepositoryInfo(repositoryUrl);
                
                if (string.IsNullOrEmpty(owner) || string.IsNullOrEmpty(repo))
                {
                    return null;
                }
                
                // Déterminer le chemin vers le manifest.json
                string path = "";
                if (repositoryUrl.Contains("/tree/main/"))
                {
                    // Si l'URL pointe vers un sous-répertoire
                    var match = Regex.Match(repositoryUrl, @"/tree/main/(.+)$");
                    if (match.Success)
                    {
                        path = match.Groups[1].Value;
                    }
                }
                
                // Construire l'URL de l'API GitHub pour le manifest.json
                string apiUrl = $"https://api.github.com/repos/{owner}/{repo}/contents/{path}{(path.Length > 0 && !path.EndsWith("/") ? "/" : "")}manifest.json";
                _logger.LogInformation($"URL de l'API pour manifest.json: {apiUrl}");
                
                // Faire la requête à l'API GitHub
                var request = new HttpRequestMessage(HttpMethod.Get, apiUrl);
                request.Headers.Add("Accept", "application/vnd.github.v3+json");
                request.Headers.Add("User-Agent", "AvanteamMarketplace");
                
                var response = await _httpClient.SendAsync(request);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"Erreur lors de la récupération du manifest.json: {response.StatusCode} - {await response.Content.ReadAsStringAsync()}");
                    return null;
                }
                
                // Lire le contenu de la réponse
                var content = await response.Content.ReadAsStringAsync();
                var manifestInfo = JsonSerializer.Deserialize<JsonElement>(content);
                
                // Le contenu est encodé en base64
                string encodedContent = manifestInfo.GetProperty("content").GetString();
                
                // Décoder le contenu
                string decodedContent = System.Text.Encoding.UTF8.GetString(
                    Convert.FromBase64String(encodedContent.Replace("\n", ""))
                );
                
                _logger.LogInformation($"Manifest.json récupéré avec succès: {decodedContent.Substring(0, Math.Min(100, decodedContent.Length))}...");
                return decodedContent;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération du manifest.json depuis {repositoryUrl}: {ex.Message}");
                return null;
            }
        }
        
        /// <summary>
        /// Télécharge un composant à partir d'un dépôt GitHub
        /// </summary>
        public async Task<string> DownloadComponentFromGitHubAsync(string repositoryUrl, string? version = null)
        {
            try
            {
                _logger.LogInformation($"Téléchargement du composant depuis {repositoryUrl} (version: {version ?? "latest"})");
                
                // Extraire les informations du dépôt
                var (owner, repo) = ExtractRepositoryInfo(repositoryUrl);
                
                if (string.IsNullOrEmpty(owner) || string.IsNullOrEmpty(repo))
                {
                    return null;
                }
                
                // Déterminer l'URL de téléchargement basée sur la version
                string downloadUrl;
                
                if (string.IsNullOrEmpty(version))
                {
                    // Télécharger la dernière version
                    downloadUrl = $"https://github.com/{owner}/{repo}/archive/refs/heads/main.zip";
                }
                else
                {
                    // Télécharger une version spécifique
                    downloadUrl = $"https://github.com/{owner}/{repo}/archive/refs/tags/{version}.zip";
                }
                
                // Télécharger le fichier ZIP
                var response = await _httpClient.GetAsync(downloadUrl);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"Erreur lors du téléchargement du composant: {response.StatusCode}");
                    return null;
                }
                
                // Créer un nom de fichier unique pour le téléchargement
                string fileName = $"{owner}-{repo}-{version ?? "latest"}-{DateTime.Now:yyyyMMddHHmmss}.zip";
                string filePath = Path.Combine(_tempDirectory, fileName);
                
                // Écrire le contenu dans un fichier temporaire
                using (var fileStream = File.Create(filePath))
                {
                    await response.Content.CopyToAsync(fileStream);
                }
                
                return filePath;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors du téléchargement du composant depuis {repositoryUrl}: {ex.Message}");
                return null;
            }
        }
        
        /// <summary>
        /// Extrait le propriétaire et le nom du dépôt à partir de l'URL GitHub
        /// </summary>
        /// <summary>
        /// Créer un modèle de composant à partir d'un manifest JSON
        /// </summary>
        private ComponentCreateViewModel CreateComponentFromManifest(JsonElement manifest, string repositoryUrl)
        {
            try
            {
                var model = new ComponentCreateViewModel
                {
                    Name = manifest.GetProperty("name").GetString(),
                    DisplayName = manifest.TryGetProperty("displayName", out var displayName) 
                        ? displayName.GetString() 
                        : manifest.GetProperty("name").GetString(),
                    Description = manifest.TryGetProperty("description", out var description)
                        ? description.GetString()
                        : "Composant importé depuis GitHub",
                    Version = manifest.TryGetProperty("version", out var version)
                        ? version.GetString()
                        : "1.0.0",
                    Category = manifest.TryGetProperty("category", out var category)
                        ? category.GetString()
                        : "Autre",
                    Author = manifest.TryGetProperty("author", out var author)
                        ? author.GetString()
                        : "Inconnu",
                    MinPlatformVersion = manifest.TryGetProperty("minPlatformVersion", out var minPlatformVersion)
                        ? minPlatformVersion.GetString()
                        : "23.0.0",
                    RepositoryUrl = repositoryUrl,
                    RequiresRestart = manifest.TryGetProperty("requiresRestart", out var requiresRestart)
                        && requiresRestart.ValueKind == JsonValueKind.True
                };

                // Ajouter des tags si disponibles
                if (manifest.TryGetProperty("tags", out var tagsElement) && tagsElement.ValueKind == JsonValueKind.Array)
                {
                    var tags = new List<string>();
                    foreach (var tag in tagsElement.EnumerateArray())
                    {
                        if (tag.ValueKind == JsonValueKind.String)
                        {
                            tags.Add(tag.GetString());
                        }
                    }
                    model.Tags = tags;
                }

                return model;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la création du modèle de composant à partir du manifest");
                
                // Créer un modèle minimal en cas d'erreur
                return new ComponentCreateViewModel
                {
                    Name = manifest.GetProperty("name").GetString(),
                    DisplayName = manifest.GetProperty("name").GetString(),
                    Description = "Composant importé depuis GitHub",
                    Version = "1.0.0",
                    Category = "Autre",
                    Author = "Inconnu",
                    MinPlatformVersion = "23.0.0",
                    RepositoryUrl = repositoryUrl
                };
            }
        }

        private (string owner, string repo) ExtractRepositoryInfo(string repositoryUrl)
        {
            try
            {
                // Expression régulière pour extraire le propriétaire et le nom du dépôt
                // Supporte plusieurs formats d'URL GitHub
                var regex = new Regex(@"github\.com[\/:](?<owner>[^\/]+)\/(?<repo>[^\/\.]+)");
                var match = regex.Match(repositoryUrl);
                
                if (match.Success)
                {
                    string owner = match.Groups["owner"].Value;
                    string repo = match.Groups["repo"].Value;
                    
                    return (owner, repo);
                }
                
                return (null, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de l'extraction des informations du dépôt {repositoryUrl}: {ex.Message}");
                return (null, null);
            }
        }
        
        /// <summary>
        /// Récupère la liste des branches d'un dépôt GitHub
        /// </summary>
        private async Task<List<string>> GetRepositoryBranchesAsync(string owner, string repo)
        {
            var branches = new List<string>();
            
            try
            {
                // Construire l'URL de l'API GitHub pour les branches
                string apiUrl = $"https://api.github.com/repos/{owner}/{repo}/branches";
                
                // Faire la requête à l'API GitHub
                var request = new HttpRequestMessage(HttpMethod.Get, apiUrl);
                request.Headers.Add("Accept", "application/vnd.github.v3+json");
                request.Headers.Add("User-Agent", "AvanteamMarketplace");
                
                var response = await _httpClient.SendAsync(request);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"Erreur lors de la récupération des branches: {response.StatusCode}");
                    return branches;
                }
                
                // Lire le contenu de la réponse
                var content = await response.Content.ReadAsStringAsync();
                var branchesInfo = JsonSerializer.Deserialize<JsonElement>(content);
                
                // Extraire les noms des branches
                foreach (var branch in branchesInfo.EnumerateArray())
                {
                    branches.Add(branch.GetProperty("name").GetString());
                }
                
                return branches;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des branches pour {owner}/{repo}: {ex.Message}");
                return branches;
            }
        }
        
        /// <summary>
        /// Récupère la liste des tags d'un dépôt GitHub
        /// </summary>
        private async Task<List<string>> GetRepositoryTagsAsync(string owner, string repo)
        {
            var tags = new List<string>();
            
            try
            {
                // Construire l'URL de l'API GitHub pour les tags
                string apiUrl = $"https://api.github.com/repos/{owner}/{repo}/tags";
                
                // Faire la requête à l'API GitHub
                var request = new HttpRequestMessage(HttpMethod.Get, apiUrl);
                request.Headers.Add("Accept", "application/vnd.github.v3+json");
                request.Headers.Add("User-Agent", "AvanteamMarketplace");
                
                var response = await _httpClient.SendAsync(request);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"Erreur lors de la récupération des tags: {response.StatusCode}");
                    return tags;
                }
                
                // Lire le contenu de la réponse
                var content = await response.Content.ReadAsStringAsync();
                var tagsInfo = JsonSerializer.Deserialize<JsonElement>(content);
                
                // Extraire les noms des tags
                foreach (var tag in tagsInfo.EnumerateArray())
                {
                    tags.Add(tag.GetProperty("name").GetString());
                }
                
                return tags;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des tags pour {owner}/{repo}: {ex.Message}");
                return tags;
            }
        }
        
        /// <summary>
        /// Récupère la liste des répertoires à la racine d'un dépôt GitHub
        /// </summary>
        private async Task<List<string>> GetRepositoryDirectoriesAsync(string owner, string repo)
        {
            var directories = new List<string>();
            
            try
            {
                // Construire l'URL de l'API GitHub pour les contenus du dépôt
                string apiUrl = $"https://api.github.com/repos/{owner}/{repo}/contents";
                
                // Faire la requête à l'API GitHub
                var request = new HttpRequestMessage(HttpMethod.Get, apiUrl);
                request.Headers.Add("Accept", "application/vnd.github.v3+json");
                request.Headers.Add("User-Agent", "AvanteamMarketplace");
                
                var response = await _httpClient.SendAsync(request);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"Erreur lors de la récupération des contenus du dépôt: {response.StatusCode}");
                    return directories;
                }
                
                // Lire le contenu de la réponse
                var content = await response.Content.ReadAsStringAsync();
                var contentsInfo = JsonSerializer.Deserialize<JsonElement>(content);
                
                // Extraire les noms des répertoires
                foreach (var item in contentsInfo.EnumerateArray())
                {
                    if (item.GetProperty("type").GetString() == "dir")
                    {
                        directories.Add(item.GetProperty("path").GetString());
                    }
                }
                
                return directories;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des répertoires pour {owner}/{repo}: {ex.Message}");
                return directories;
            }
        }
        
        /// <summary>
        /// Télécharge et attache un package à un composant
        /// </summary>
        private async Task<bool> CreateAndAttachPackageAsync(string owner, string repo, int componentId, string version, string subDirectory = null)
        {
            try
            {
                _logger.LogInformation($"Création et attachement du package pour le composant {componentId} (version {version})");
                
                // 1. Télécharger le dépôt
                string zipFilePath = await DownloadComponentFromGitHubAsync($"https://github.com/{owner}/{repo}", version);
                
                if (string.IsNullOrEmpty(zipFilePath) || !File.Exists(zipFilePath))
                {
                    _logger.LogError($"Échec du téléchargement du dépôt pour {owner}/{repo}");
                    return false;
                }
                
                // 2. Extraire le contenu dans un répertoire temporaire
                string extractPath = Path.Combine(_tempDirectory, $"{owner}-{repo}-{Guid.NewGuid()}");
                
                try
                {
                    // Créer le répertoire d'extraction s'il n'existe pas
                    if (!Directory.Exists(extractPath))
                    {
                        Directory.CreateDirectory(extractPath);
                    }
                    
                    // Extraire l'archive
                    ZipFile.ExtractToDirectory(zipFilePath, extractPath, true);
                    
                    // Déterminer le chemin vers le contenu du composant
                    string componentPath = extractPath;
                    
                    // Dans un dépôt GitHub, le contenu est généralement dans un sous-répertoire nommé {repo}-main ou {repo}-{branch}
                    var rootDirs = Directory.GetDirectories(extractPath);
                    if (rootDirs.Length > 0)
                    {
                        // Prendre le premier répertoire (généralement le seul)
                        componentPath = rootDirs[0];
                    }
                    
                    // Si le composant est dans un sous-répertoire du dépôt, naviguer vers ce sous-répertoire
                    if (!string.IsNullOrEmpty(subDirectory))
                    {
                        componentPath = Path.Combine(componentPath, subDirectory);
                        
                        // Vérifier que le répertoire existe
                        if (!Directory.Exists(componentPath))
                        {
                            _logger.LogError($"Le sous-répertoire {subDirectory} n'existe pas dans l'archive téléchargée");
                            return false;
                        }
                    }
                    
                    // 3. Créer un package ZIP à partir du répertoire
                    string packagePath = await _packageService.GenerateComponentPackageAsync(componentPath, $"component-{componentId}", version);
                    
                    if (string.IsNullOrEmpty(packagePath) || !File.Exists(packagePath))
                    {
                        _logger.LogError($"Échec de la création du package pour le composant {componentId}");
                        return false;
                    }
                    
                    // 4. Traiter le package et l'attacher au composant
                    var result = await _packageService.ProcessComponentPackageAsync(componentId, packagePath, version);
                    
                    if (!result.Success)
                    {
                        _logger.LogError($"Échec du traitement du package: {result.ErrorMessage}");
                        return false;
                    }
                    
                    // 5. Créer une version pour le composant si elle n'existe pas encore
                    var versions = await _marketplaceService.GetComponentVersionsAsync(componentId);
                    
                    if (!versions.Any(v => v.VersionNumber == version))
                    {
                        // Créer la version
                        await _marketplaceService.CreateComponentVersionAsync(componentId, new ComponentVersionCreateViewModel
                        {
                            Version = version,
                            ChangeLog = "Version importée depuis GitHub",
                            IsLatest = true,
                            PackageUrl = result.PackageUrl
                        });
                        
                        _logger.LogInformation($"Version {version} créée pour le composant {componentId}");
                    }
                    else
                    {
                        // Mettre à jour la version existante avec le nouveau package
                        var existingVersion = versions.First(v => v.VersionNumber == version);
                        await _marketplaceService.UpdateComponentVersionAsync(existingVersion.VersionId, new ComponentVersionCreateViewModel
                        {
                            Version = version,
                            ChangeLog = existingVersion.ChangeLog,
                            IsLatest = existingVersion.IsLatest,
                            PackageUrl = result.PackageUrl
                        });
                        
                        _logger.LogInformation($"Version {version} mise à jour pour le composant {componentId}");
                    }
                    
                    _logger.LogInformation($"Package créé et attaché avec succès pour le composant {componentId}");
                    return true;
                }
                finally
                {
                    // Nettoyer les fichiers temporaires
                    try
                    {
                        if (Directory.Exists(extractPath))
                        {
                            Directory.Delete(extractPath, true);
                        }
                        
                        if (File.Exists(zipFilePath))
                        {
                            File.Delete(zipFilePath);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Erreur lors du nettoyage des fichiers temporaires");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la création et de l'attachement du package pour le composant {componentId}: {ex.Message}");
                return false;
            }
        }
    }
}