namespace AvanteamMarketplace.Core.Models
{
    /// <summary>
    /// Représente un tag associé à un composant
    /// </summary>
    public class ComponentTag
    {
        public int ComponentId { get; set; }
        public string Tag { get; set; } = string.Empty;
        
        // Navigation property
        public virtual Component Component { get; set; } = null!;
    }
}