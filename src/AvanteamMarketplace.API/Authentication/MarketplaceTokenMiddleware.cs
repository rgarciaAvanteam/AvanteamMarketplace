using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace AvanteamMarketplace.API.Authentication
{
    /// <summary>
    /// Middleware pour valider les tokens Marketplace dans les requêtes
    /// </summary>
    public class MarketplaceTokenMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly IConfiguration _configuration;
        private readonly ILogger<MarketplaceTokenMiddleware> _logger;

        public MarketplaceTokenMiddleware(
            RequestDelegate next,
            IConfiguration configuration,
            ILogger<MarketplaceTokenMiddleware> logger)
        {
            _next = next;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                // Vérifier si le token Marketplace est présent
                if (context.Request.Headers.TryGetValue("X-Marketplace-Token", out var token))
                {
                    _logger.LogInformation("Token Marketplace détecté dans la requête");

                    try
                    {
                        // Configurer les paramètres de validation
                        var secretKeyString = _configuration["MarketplaceAuth:SecretKey"];
                        if (string.IsNullOrEmpty(secretKeyString))
                        {
                            _logger.LogWarning("Clé de signature non configurée pour valider le token");
                            await _next(context);
                            return;
                        }

                        var secretKeyBytes = Encoding.UTF8.GetBytes(secretKeyString);
                        var issuer = _configuration["MarketplaceAuth:Issuer"] ?? "AvanteamMarketplace";
                        var audience = _configuration["MarketplaceAuth:Audience"] ?? "MarketplaceClients";

                        var validationParameters = new TokenValidationParameters
                        {
                            ValidateIssuer = true,
                            ValidateAudience = true,
                            ValidateLifetime = true,
                            ValidateIssuerSigningKey = true,
                            ValidIssuer = issuer,
                            ValidAudience = audience,
                            IssuerSigningKey = new SymmetricSecurityKey(secretKeyBytes)
                        };

                        // Valider le token
                        var handler = new JwtSecurityTokenHandler();
                        var claimsPrincipal = handler.ValidateToken(token, validationParameters, out var validatedToken);

                        // Vérifier si l'utilisateur est un administrateur Avanteam
                        bool isAvanteamAdmin = claimsPrincipal.HasClaim(c => c.Type == "IsAvanteamAdmin" && c.Value == "true");

                        if (isAvanteamAdmin)
                        {
                            _logger.LogInformation("Token Marketplace valide avec droits d'administration");
                            
                            // Ajouter une claim personnalisée
                            var identity = (ClaimsIdentity)claimsPrincipal.Identity;
                            identity.AddClaim(new Claim(ClaimTypes.Role, "Administrator"));
                            
                            // Mettre à jour le User principal dans le contexte
                            context.User = claimsPrincipal;
                        }
                        else
                        {
                            _logger.LogInformation("Token Marketplace valide sans droits d'administration");
                        }
                    }
                    catch (Exception ex)
                    {
                        // Logger l'erreur mais continuer le traitement
                        // L'authentification par clé API pourrait encore réussir
                        _logger.LogWarning(ex, "Erreur lors de la validation du token Marketplace");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur non gérée dans le middleware MarketplaceToken");
            }

            // Continuer le pipeline
            await _next(context);
        }
    }

    // Extension pour ajouter facilement le middleware
    public static class MarketplaceTokenMiddlewareExtensions
    {
        public static IApplicationBuilder UseMarketplaceTokenValidation(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<MarketplaceTokenMiddleware>();
        }
    }
}