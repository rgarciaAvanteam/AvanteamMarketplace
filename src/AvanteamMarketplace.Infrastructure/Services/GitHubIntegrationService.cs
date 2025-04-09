using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using AvanteamMarketplace.Core.Services;
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
        private readonly string _tempDirectory;
        
        public GitHubIntegrationService(
            ILogger<GitHubIntegrationService> logger,
            HttpClient httpClient)
        {
            _logger = logger;
            _httpClient = httpClient;
            
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
                
                // Récupérer la liste des tags (versions)
                var tags = await GetRepositoryTagsAsync(owner, repo);
                
                // Parcourir les dossiers pour trouver les composants
                // Pour simplifier l'exemple, on considère que chaque composant est dans un dossier à la racine du dépôt
                var directories = await GetRepositoryDirectoriesAsync(owner, repo);
                
                foreach (var directory in directories)
                {
                    try
                    {
                        // Vérifier s'il s'agit d'un composant valide (contient un manifest.json)
                        var manifestContent = await GetManifestContentAsync($"https://github.com/{owner}/{repo}/tree/main/{directory}");
                        
                        if (!string.IsNullOrEmpty(manifestContent))
                        {
                            // Analyser le manifest pour déterminer s'il s'agit d'un nouveau composant ou d'une mise à jour
                            var manifest = JsonSerializer.Deserialize<JsonElement>(manifestContent);
                            string componentName = manifest.GetProperty("name").GetString();
                            
                            // Ici, vous implémenteriez la logique pour vérifier si le composant existe déjà
                            // et le mettre à jour dans la base de données
                            
                            // Pour cet exemple, on considère que c'est une mise à jour
                            result.UpdatedComponents.Add(componentName);
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
                
                // Construire l'URL de l'API GitHub pour le manifest.json
                string apiUrl = $"https://api.github.com/repos/{owner}/{repo}/contents/manifest.json";
                
                // Faire la requête à l'API GitHub
                var request = new HttpRequestMessage(HttpMethod.Get, apiUrl);
                request.Headers.Add("Accept", "application/vnd.github.v3+json");
                request.Headers.Add("User-Agent", "AvanteamMarketplace");
                
                var response = await _httpClient.SendAsync(request);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"Erreur lors de la récupération du manifest.json: {response.StatusCode}");
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
    }
}