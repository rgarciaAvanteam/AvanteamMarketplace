using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace AvanteamMarketplace.Core.ViewModels
{
    /// <summary>
    /// ViewModel pour la création d'un composant
    /// </summary>
    public class ComponentCreateViewModel
    {
        [Required(ErrorMessage = "Le nom technique est requis")]
        [StringLength(50, ErrorMessage = "Le nom technique ne doit pas dépasser 50 caractères")]
        [RegularExpression("^[a-z0-9-]+$", ErrorMessage = "Le nom technique doit contenir uniquement des lettres minuscules, des chiffres et des tirets")]
        public string Name { get; set; } = string.Empty;
        
        [Required(ErrorMessage = "Le nom d'affichage est requis")]
        [StringLength(100, ErrorMessage = "Le nom d'affichage ne doit pas dépasser 100 caractères")]
        public string DisplayName { get; set; } = string.Empty;
        
        [Required(ErrorMessage = "La description est requise")]
        [StringLength(500, ErrorMessage = "La description ne doit pas dépasser 500 caractères")]
        public string Description { get; set; } = string.Empty;
        
        [Required(ErrorMessage = "La version est requise")]
        [RegularExpression(@"^\d+\.\d+(\.\d+)?$", ErrorMessage = "La version doit être au format X.Y.Z")]
        public string Version { get; set; } = string.Empty;
        
        [Required(ErrorMessage = "La catégorie est requise")]
        public string Category { get; set; } = string.Empty;
        
        [StringLength(100, ErrorMessage = "Le nom de l'auteur ne doit pas dépasser 100 caractères")]
        public string Author { get; set; } = string.Empty;
        
        [Required(ErrorMessage = "La version minimale de la plateforme est requise")]
        [RegularExpression(@"^\d+\.\d+(\.\d+)?$", ErrorMessage = "La version minimale doit être au format X.Y.Z")]
        public string MinPlatformVersion { get; set; } = string.Empty;
        
        [RegularExpression(@"^\d+\.\d+(\.\d+)?$", ErrorMessage = "La version recommandée doit être au format X.Y.Z")]
        public string RecommendedPlatformVersion { get; set; } = string.Empty;
        
        [Url(ErrorMessage = "L'URL du dépôt doit être une URL valide")]
        public string RepositoryUrl { get; set; } = string.Empty;
        
        public bool RequiresRestart { get; set; }
        
        public string TargetPath { get; set; } = string.Empty;
        
        [Url(ErrorMessage = "L'URL du package doit être une URL valide")]
        public string PackageUrl { get; set; } = string.Empty;
        
        public string ReadmeContent { get; set; } = string.Empty;
        
        public List<string> Tags { get; set; } = new List<string>();
        
        public List<ComponentDependencyViewModel> Dependencies { get; set; } = new List<ComponentDependencyViewModel>();
    }
    
    /// <summary>
    /// ViewModel pour une dépendance de composant
    /// </summary>
    public class ComponentDependencyViewModel
    {
        [Required(ErrorMessage = "L'ID du composant est requis")]
        public int ComponentId { get; set; }
        
        [Required(ErrorMessage = "La version minimale est requise")]
        [RegularExpression(@"^\d+\.\d+(\.\d+)?$", ErrorMessage = "La version minimale doit être au format X.Y.Z")]
        public string MinVersion { get; set; } = string.Empty;
    }
}