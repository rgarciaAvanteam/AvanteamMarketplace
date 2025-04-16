using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace AvanteamMarketplace.Core.ViewModels
{
    /// <summary>
    /// ViewModel pour la mise à jour d'un composant
    /// </summary>
    public class ComponentUpdateViewModel
    {
        [StringLength(100, ErrorMessage = "Le nom d'affichage ne doit pas dépasser 100 caractères")]
        public string DisplayName { get; set; } = string.Empty;
        
        [StringLength(500, ErrorMessage = "La description ne doit pas dépasser 500 caractères")]
        public string Description { get; set; } = string.Empty;
        
        [RegularExpression(@"^\d+\.\d+(\.\d+)?$", ErrorMessage = "La version doit être au format X.Y.Z")]
        public string Version { get; set; } = string.Empty;
        
        public string Category { get; set; } = string.Empty;
        
        [StringLength(100, ErrorMessage = "Le nom de l'auteur ne doit pas dépasser 100 caractères")]
        public string Author { get; set; } = string.Empty;
        
        [RegularExpression(@"^\d+\.\d+(\.\d+)?$", ErrorMessage = "La version minimale doit être au format X.Y.Z")]
        public string MinPlatformVersion { get; set; } = string.Empty;
        
        [RegularExpression(@"^\d+\.\d+(\.\d+)?$", ErrorMessage = "La version maximale doit être au format X.Y.Z")]
        public string MaxPlatformVersion { get; set; } = string.Empty;
        
        [RegularExpression(@"^\d+\.\d+(\.\d+)?$", ErrorMessage = "La version recommandée doit être au format X.Y.Z")]
        public string RecommendedPlatformVersion { get; set; } = string.Empty;
        
        [Url(ErrorMessage = "L'URL du dépôt doit être une URL valide")]
        public string RepositoryUrl { get; set; } = string.Empty;
        
        public bool? RequiresRestart { get; set; }
        
        public string TargetPath { get; set; } = string.Empty;
        
        [Url(ErrorMessage = "L'URL du package doit être une URL valide")]
        public string PackageUrl { get; set; } = string.Empty;
        
        public string ReadmeContent { get; set; } = string.Empty;
        
        public List<string> Tags { get; set; } = new List<string>();
        
        public List<ComponentDependencyViewModel> Dependencies { get; set; } = new List<ComponentDependencyViewModel>();
    }
}