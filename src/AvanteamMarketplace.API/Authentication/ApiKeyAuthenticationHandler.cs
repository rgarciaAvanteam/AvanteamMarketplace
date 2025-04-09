using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AvanteamMarketplace.API.Authentication
{
    public class ApiKeyAuthenticationHandler : AuthenticationHandler<ApiKeyAuthenticationOptions>
    {
        private const string ApiKeyHeaderName = "Authorization";
        private readonly IApiKeyValidator _apiKeyValidator;

        public ApiKeyAuthenticationHandler(
            IOptionsMonitor<ApiKeyAuthenticationOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder,
            ISystemClock clock,
            IApiKeyValidator apiKeyValidator)
            : base(options, logger, encoder, clock)
        {
            _apiKeyValidator = apiKeyValidator;
        }

        protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Request.Headers.TryGetValue(ApiKeyHeaderName, out var apiKeyHeaderValues))
            {
                return AuthenticateResult.NoResult();
            }

            var providedApiKey = apiKeyHeaderValues.ToString();

            // Format Bearer {api-key}
            if (providedApiKey.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                providedApiKey = providedApiKey.Substring(7).Trim();
            }

            if (string.IsNullOrEmpty(providedApiKey))
            {
                return AuthenticateResult.NoResult();
            }

            if (!await _apiKeyValidator.IsValidApiKeyAsync(providedApiKey))
            {
                return AuthenticateResult.Fail("Invalid API Key");
            }

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, "API User"),
                new Claim(ClaimTypes.NameIdentifier, providedApiKey)
            };

            // Ajouter un rôle administrateur si la clé est une clé admin
            if (await _apiKeyValidator.IsAdminApiKeyAsync(providedApiKey))
            {
                claims.Add(new Claim(ClaimTypes.Role, "Administrator"));
            }

            var identity = new ClaimsIdentity(claims, Options.AuthenticationType);
            var identities = new List<ClaimsIdentity> { identity };
            var principal = new ClaimsPrincipal(identities);
            var ticket = new AuthenticationTicket(principal, Options.Scheme);

            return AuthenticateResult.Success(ticket);
        }
    }

    public class ApiKeyAuthenticationOptions : AuthenticationSchemeOptions
    {
        public string AuthenticationType { get; set; } = "ApiKey";
        public string Scheme { get; set; } = "ApiKey";
    }
}