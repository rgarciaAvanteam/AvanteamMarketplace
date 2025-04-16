using System;

namespace AvanteamMarketplace.Core.ViewModels
{
    /// <summary>
    /// ViewModel pour la création d'une nouvelle version d'un composant
    /// </summary>
    public class ComponentVersionCreateViewModel
    {
        /// <summary>
        /// Numéro de version (format X.Y.Z)
        /// </summary>
        public string Version { get; set; } = string.Empty;
        
        /// <summary>
        /// Notes de version / Changelog
        /// </summary>
        public string ChangeLog { get; set; } = string.Empty;
        
        /// <summary>
        /// Version minimale de la plateforme requise pour cette version
        /// </summary>
        public string MinPlatformVersion { get; set; } = string.Empty;
        
        /// <summary>
        /// Version maximale de la plateforme supportée par cette version
        /// </summary>
        public string MaxPlatformVersion { get; set; } = string.Empty;
        
        /// <summary>
        /// URL du package (si différente de l'URL de base du composant)
        /// </summary>
        public string PackageUrl { get; set; } = string.Empty;
        
        /// <summary>
        /// Contenu du package au format base64 (si fourni directement)
        /// </summary>
        public string PackageBase64 { get; set; } = string.Empty;
        
        /// <summary>
        /// Indique si cette version devrait être définie comme la dernière version
        /// </summary>
        public bool IsLatest { get; set; } = true;
    }
}