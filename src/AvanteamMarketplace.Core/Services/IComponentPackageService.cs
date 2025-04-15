using System.Threading.Tasks;

namespace AvanteamMarketplace.Core.Services
{
    /// <summary>
    /// Interface pour la gestion des packages de composants
    /// </summary>
    public interface IComponentPackageService
    {
        /// <summary>
        /// Traite un package de composant téléchargé
        /// </summary>
        Task<ComponentPackageResult> ProcessComponentPackageAsync(int componentId, string packagePath, string? version = null);
        
        /// <summary>
        /// Valide un package de composant
        /// </summary>
        Task<ComponentPackageValidationResult> ValidateComponentPackageAsync(string packagePath);
        
        /// <summary>
        /// Génère un package de composant à partir d'un répertoire source
        /// </summary>
        Task<string> GenerateComponentPackageAsync(string sourcePath, string componentName, string version);
        
        /// <summary>
        /// Supprime les fichiers de package d'un composant et de ses versions
        /// </summary>
        /// <param name="componentName">Nom du composant</param>
        /// <param name="versions">Liste des versions à supprimer</param>
        /// <returns>Nombre de fichiers supprimés</returns>
        Task<int> DeleteComponentPackageFilesAsync(string componentName, IEnumerable<string> versions);
        
        /// <summary>
        /// Obtient l'URL de base pour les packages
        /// </summary>
        /// <returns>L'URL de base configurée</returns>
        string GetPackageBaseUrl();
    }
    
    /// <summary>
    /// Résultat du traitement d'un package de composant
    /// </summary>
    public class ComponentPackageResult
    {
        public bool Success { get; set; }
        public string Version { get; set; } = string.Empty;
        public string PackageUrl { get; set; } = string.Empty;
        public string ErrorMessage { get; set; } = string.Empty;
        public string TargetPath { get; set; } = string.Empty;
        public string MinPlatformVersion { get; set; } = string.Empty;
        public string RepositoryUrl { get; set; } = string.Empty;
    }
    
    /// <summary>
    /// Résultat de la validation d'un package de composant
    /// </summary>
    public class ComponentPackageValidationResult
    {
        public bool IsValid { get; set; }
        public string ComponentName { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
        public string ErrorMessage { get; set; } = string.Empty;
        public bool HasManifest { get; set; }
        public bool HasReadme { get; set; }
    }
}