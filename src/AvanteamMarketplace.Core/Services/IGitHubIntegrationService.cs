using System.Threading.Tasks;
using System.Collections.Generic;

namespace AvanteamMarketplace.Core.Services
{
    /// <summary>
    /// Interface pour l'intégration avec GitHub
    /// </summary>
    public interface IGitHubIntegrationService
    {
        /// <summary>
        /// Synchronise les composants à partir d'un dépôt GitHub
        /// </summary>
        Task<GitHubSyncResult> SynchronizeComponentsFromGitHubAsync(string repositoryUrl);
        
        /// <summary>
        /// Récupère le contenu README d'un dépôt GitHub
        /// </summary>
        Task<string> GetReadmeContentAsync(string repositoryUrl);
        
        /// <summary>
        /// Récupère le fichier manifest.json d'un dépôt GitHub
        /// </summary>
        Task<string> GetManifestContentAsync(string repositoryUrl);
        
        /// <summary>
        /// Télécharge un composant à partir d'un dépôt GitHub
        /// </summary>
        Task<string> DownloadComponentFromGitHubAsync(string repositoryUrl, string? version = null);
    }
    
    /// <summary>
    /// Résultat de la synchronisation avec GitHub
    /// </summary>
    public class GitHubSyncResult
    {
        public List<string> NewComponents { get; set; } = new List<string>();
        public List<string> UpdatedComponents { get; set; } = new List<string>();
        public List<string> FailedComponents { get; set; } = new List<string>();
    }
}