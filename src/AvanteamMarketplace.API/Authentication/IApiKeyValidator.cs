using System.Threading.Tasks;

namespace AvanteamMarketplace.API.Authentication
{
    public interface IApiKeyValidator
    {
        Task<bool> IsValidApiKeyAsync(string apiKey);
        Task<bool> IsAdminApiKeyAsync(string apiKey);
        Task RegisterApiKeyAsync(string apiKey, string clientId, string baseUrl);
    }
}