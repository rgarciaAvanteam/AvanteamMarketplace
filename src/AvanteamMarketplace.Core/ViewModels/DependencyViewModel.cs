namespace AvanteamMarketplace.Core.ViewModels
{
    /// <summary>
    /// ViewModel pour les dépendances d'un composant
    /// </summary>
    public class DependencyViewModel
    {
        public int DependencyId { get; set; }
        public string ComponentName { get; set; } = string.Empty;
        public string MinVersion { get; set; } = string.Empty;
        public string? MaxVersion { get; set; }
        public bool IsRequired { get; set; }
    }
}