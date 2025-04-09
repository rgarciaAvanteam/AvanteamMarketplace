using System;

namespace AvanteamMarketplace.Core.Models
{
    /// <summary>
    /// Représente une clé API pour l'authentification au marketplace
    /// </summary>
    public class ApiKey
    {
        public int ApiKeyId { get; set; }
        public string Key { get; set; } = string.Empty;
        public string ClientId { get; set; } = string.Empty;
        public bool IsAdmin { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedDate { get; set; }
        public DateTime? LastAccessDate { get; set; }
    }
}