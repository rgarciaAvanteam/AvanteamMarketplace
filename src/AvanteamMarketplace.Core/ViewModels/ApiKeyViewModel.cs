using System;
using System.ComponentModel.DataAnnotations;

namespace AvanteamMarketplace.Core.ViewModels
{
    /// <summary>
    /// ViewModel pour l'affichage des clés API
    /// </summary>
    public class ApiKeyViewModel
    {
        public int ApiKeyId { get; set; }
        public string Key { get; set; } = string.Empty;
        public string ClientId { get; set; } = string.Empty;
        public string BaseUrl { get; set; } = string.Empty;
        public string PlatformVersion { get; set; } = string.Empty;
        public bool IsAdmin { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedDate { get; set; }
        public DateTime? LastAccessDate { get; set; }
    }
    
    /// <summary>
    /// ViewModel pour la création d'une clé API
    /// </summary>
    public class ApiKeyCreateViewModel
    {
        [Required(ErrorMessage = "L'identifiant client est requis")]
        [StringLength(100, ErrorMessage = "L'identifiant client ne doit pas dépasser 100 caractères")]
        public string ClientId { get; set; } = string.Empty;
        
        [Required(ErrorMessage = "L'URL de base est requise")]
        [StringLength(255, ErrorMessage = "L'URL de base ne doit pas dépasser 255 caractères")]
        [Url(ErrorMessage = "L'URL de base doit être une URL valide")]
        public string BaseUrl { get; set; } = string.Empty;
        
        public bool IsAdmin { get; set; }
    }
}