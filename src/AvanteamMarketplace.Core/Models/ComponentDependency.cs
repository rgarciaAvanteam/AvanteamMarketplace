namespace AvanteamMarketplace.Core.Models
{
    /// <summary>
    /// Représente une dépendance entre composants
    /// </summary>
    public class ComponentDependency
    {
        public int ComponentId { get; set; }
        public int DependsOnComponentId { get; set; }
        public string MinVersion { get; set; } = string.Empty;
        public string? MaxVersion { get; set; }
        public bool IsRequired { get; set; }
        
        // Navigation properties
        public virtual Component Component { get; set; } = null!;
        public virtual Component DependsOnComponent { get; set; } = null!;
    }
}