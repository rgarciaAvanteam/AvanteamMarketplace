using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using AvanteamMarketplace.Infrastructure.Data;
using AvanteamMarketplace.Core.Models;

namespace AvanteamMarketplace.API.Authentication
{
    public class ApiKeyValidator : IApiKeyValidator
    {
        private readonly IConfiguration _configuration;
        private readonly MarketplaceDbContext _dbContext;

        public ApiKeyValidator(IConfiguration configuration, MarketplaceDbContext dbContext)
        {
            _configuration = configuration;
            _dbContext = dbContext;
        }

        public async Task<bool> IsValidApiKeyAsync(string apiKey)
        {
            // Vérifier les clés autorisées dans la configuration
            var allowedKeys = _configuration.GetSection("ApiKeys:AllowedKeys").Get<string[]>() ?? new string[0];
            if (allowedKeys.Contains(apiKey))
            {
                return true;
            }

            // Vérifier la clé admin
            var adminKey = _configuration["ApiKeys:AdminKey"];
            if (!string.IsNullOrEmpty(adminKey) && apiKey == adminKey)
            {
                return true;
            }

            // Vérifier les clés enregistrées dans la base de données
            return await _dbContext.ApiKeys.AnyAsync(k => k.Key == apiKey && k.IsActive);
        }

        public async Task<bool> IsAdminApiKeyAsync(string apiKey)
        {
            var adminKey = _configuration["ApiKeys:AdminKey"];
            if (!string.IsNullOrEmpty(adminKey) && apiKey == adminKey)
            {
                return true;
            }

            // Vérifier si la clé dans la base de données a des droits d'administration
            var keyEntity = await _dbContext.ApiKeys.FirstOrDefaultAsync(k => k.Key == apiKey && k.IsActive);
            return keyEntity?.AccessLevel == ApiKeyAccessLevel.UtilisateurAdmin || 
                   keyEntity?.AccessLevel == ApiKeyAccessLevel.UtilisateurLecture;
        }

        public async Task RegisterApiKeyAsync(string apiKey, string clientId, string baseUrl, string platformVersion = null)
        {
            var existingKey = await _dbContext.ApiKeys.FirstOrDefaultAsync(k => k.Key == apiKey);
            if (existingKey == null)
            {
                _dbContext.ApiKeys.Add(new ApiKey
                {
                    Key = apiKey,
                    ClientId = clientId,
                    BaseUrl = baseUrl,
                    PlatformVersion = platformVersion,
                    IsActive = true,
                    AccessLevel = ApiKeyAccessLevel.ApplicationWeb,
                    CreatedDate = System.DateTime.UtcNow
                });
                await _dbContext.SaveChangesAsync();
            }
            else if (existingKey.ClientId != clientId || existingKey.BaseUrl != baseUrl || 
                    (platformVersion != null && existingKey.PlatformVersion != platformVersion))
            {
                existingKey.ClientId = clientId;
                existingKey.BaseUrl = baseUrl;
                
                // Mettre à jour la version seulement si elle est fournie
                if (!string.IsNullOrEmpty(platformVersion))
                {
                    existingKey.PlatformVersion = platformVersion;
                }
                
                existingKey.LastAccessDate = System.DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();
            }
        }
    }
}