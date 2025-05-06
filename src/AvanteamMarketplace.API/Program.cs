using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using AvanteamMarketplace.Core.Services;
using AvanteamMarketplace.Infrastructure.Data;
using AvanteamMarketplace.Infrastructure.Services;
using AvanteamMarketplace.API.Authentication;
using System.Text.Json.Serialization;
using System;
using System.IO;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Server.IIS;

// Désactiver complètement le chargement des StaticWebAssets
Environment.SetEnvironmentVariable("ASPNETCORE_HOSTINGSTARTUPASSEMBLIES", "");
Environment.SetEnvironmentVariable("ASPNETCORE_STATICWEBASSETSFILEPROVIDER_ENABLED", "false");
Environment.SetEnvironmentVariable("DOTNET_HOSTBUILDER__RELOADCONFIGONCHANGE", "false");
Environment.SetEnvironmentVariable("ASPNETCORE_STATICWEBASSETSLOADMODE", "Never");

// Définir des chemins par défaut
string currentDirectory = Directory.GetCurrentDirectory();
string defaultWwwrootPath = Path.Combine(currentDirectory, "wwwroot");

// Créer le builder avec des options explicites
var webApplicationOptions = new WebApplicationOptions
{
    Args = args,
    ContentRootPath = currentDirectory,
    WebRootPath = defaultWwwrootPath,
    ApplicationName = typeof(Program).Assembly.GetName().Name
};

var builder = WebApplication.CreateBuilder(webApplicationOptions);

// Configuration explicite de WebRootPath
builder.WebHost.UseWebRoot(defaultWwwrootPath);

// Désactiver explicitement les StaticWebAssets
builder.WebHost.ConfigureAppConfiguration((hostingContext, config) =>
{
    hostingContext.HostingEnvironment.WebRootPath = defaultWwwrootPath;
});

// Configuration de la base de données
builder.Services.AddDbContext<MarketplaceDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    options.UseSqlServer(connectionString);
});

// Configuration des services
builder.Services.AddHttpClient(); // Ajout de HttpClient
builder.Services.AddScoped<IMarketplaceService, MarketplaceService>();
builder.Services.AddScoped<IProcessStudioVersionDetector, ProcessStudioVersionDetector>();
builder.Services.AddScoped<IComponentPackageService, ComponentPackageService>();
builder.Services.AddScoped<IComponentInstallerService, ComponentInstallerService>();

// Activer la prise en charge de Razor Pages avec compilation runtime
builder.Services.AddRazorPages()
    .AddRazorRuntimeCompilation();

// Désactiver le cache des réponses
builder.Services.AddResponseCaching(options => options.MaximumBodySize = 0);

// Configurer la session pour l'authentification admin
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromHours(1);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

// Configuration de l'API
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        // Permettre des propriétés plus grandes pour les packages volumineux
        options.JsonSerializerOptions.DefaultBufferSize = 1024 * 1024 * 4; // 4 MB buffer
    })
    .ConfigureApiBehaviorOptions(options =>
    {
        // Désactiver la validation automatique du modèle qui peut causer problème avec le paramètre 'error'
        options.SuppressModelStateInvalidFilter = true;
    });

// Configurer les limites de taille pour les requêtes HTTP et formulaires
builder.Services.Configure<IISServerOptions>(options =>
{
    options.MaxRequestBodySize = int.MaxValue; // Illimité (limité par web.config)
});

builder.Services.Configure<FormOptions>(options =>
{
    options.ValueLengthLimit = int.MaxValue;
    options.MultipartBodyLengthLimit = long.MaxValue; // Définir une limite élevée pour les fichiers multipart
    options.MultipartHeadersLengthLimit = int.MaxValue;
    options.MultipartBodyLengthLimit = int.MaxValue; // Définir une limite élevée pour les fichiers multipart
    options.MultipartHeadersLengthLimit = int.MaxValue;
});

// Configuration de Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title = "Avanteam Marketplace API",
        Version = "v1",
        Description = "API pour la gestion et l'utilisation du Marketplace Avanteam destiné aux composants Process Studio",
        Contact = new()
        {
            Name = "Avanteam Support",
            Email = "support@avanteam.fr",
            Url = new Uri("https://www.avanteam.fr/contact")
        }
    });

    // Configuration sécurité
    c.AddSecurityDefinition("Bearer", new()
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Entrez votre clé d'API sous la forme: Bearer {clé API}. " +
                     "Les clés API peuvent être générées par un administrateur via l'endpoint /api/management/apikeys."
    });
    c.AddSecurityRequirement(new()
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new()
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });

    // Activation des annotations Swagger
    c.EnableAnnotations();

    // Inclusion des commentaires XML pour la documentation
    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        c.IncludeXmlComments(xmlPath);
    }

    // Documentation des modèles Core
    var coreXmlFile = "AvanteamMarketplace.Core.xml";
    var coreXmlPath = Path.Combine(AppContext.BaseDirectory, coreXmlFile);
    if (File.Exists(coreXmlPath))
    {
        c.IncludeXmlComments(coreXmlPath);
    }

    // Groupement des endpoints par tag
    c.TagActionsBy(api => {
        if (api.GroupName != null)
            return new[] { api.GroupName };

        if (api.ActionDescriptor.RouteValues.TryGetValue("controller", out var controller) && controller != null)
        {
            if (controller.Contains("Marketplace"))
                return new[] { "Client API" };
            else if (controller.Contains("Management"))
                return new[] { "Administration API" };
        }

        return new[] { "Autres" };
    });
    c.DocInclusionPredicate((name, api) => true);
});

// Configuration CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowProcessStudioOrigins", policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
        if (allowedOrigins != null && allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins)
                .SetIsOriginAllowedToAllowWildcardSubdomains()
                .AllowAnyMethod()
                .AllowAnyHeader()
                .WithExposedHeaders("Content-Disposition")
                .AllowCredentials();
        }
        else
        {
            // Fallback à la configuration précédente
            policy.AllowAnyOrigin()
                .AllowAnyMethod()
                .AllowAnyHeader()
                .WithExposedHeaders("Content-Disposition");
        }
    });
});

// Configuration des data protection (pour les cookies)
var dataProtectionBuilder = builder.Services.AddDataProtection();
// Si en production, créer un répertoire pour les clés
if (!builder.Environment.IsDevelopment())
{
    var keysDirectory = Path.Combine(builder.Environment.ContentRootPath, "keys");
    if (!Directory.Exists(keysDirectory))
    {
        Directory.CreateDirectory(keysDirectory);
    }
}

// Ajouter le service de cache mémoire pour la gestion des sessions d'authentification
builder.Services.AddMemoryCache();

// Configuration de l'authentification
builder.Services.AddAuthentication("ApiKey")
    .AddScheme<ApiKeyAuthenticationOptions, ApiKeyAuthenticationHandler>("ApiKey", options => { });
builder.Services.AddScoped<IApiKeyValidator, ApiKeyValidator>();

// Ajouter la configuration pour l'authentification Azure AD et Marketplace
builder.Services.Configure<TokenValidationParameters>(options => 
{
    var secretKeyString = builder.Configuration["MarketplaceAuth:SecretKey"];
    if (!string.IsNullOrEmpty(secretKeyString))
    {
        var secretKeyBytes = Encoding.UTF8.GetBytes(secretKeyString);
        var issuer = builder.Configuration["MarketplaceAuth:Issuer"] ?? "AvanteamMarketplace";
        var audience = builder.Configuration["MarketplaceAuth:Audience"] ?? "MarketplaceClients";
        
        options.ValidateIssuer = true;
        options.ValidateAudience = true;
        options.ValidateLifetime = true;
        options.ValidateIssuerSigningKey = true;
        options.ValidIssuer = issuer;
        options.ValidAudience = audience;
        options.IssuerSigningKey = new SymmetricSecurityKey(secretKeyBytes);
    }
});

var app = builder.Build();

// Mise à jour du chemin wwwroot après avoir lu la configuration
// Cela permet de spécifier un chemin dans appsettings.json
var customWebRootPath = app.Configuration["AppSettings:CustomWebRootPath"];
if (!string.IsNullOrEmpty(customWebRootPath) && Directory.Exists(customWebRootPath))
{
    // Utiliser le chemin personnalisé pour les fichiers statiques
    app.Logger.LogInformation($"Utilisation du chemin wwwroot personnalisé: {customWebRootPath}");
    app.Environment.WebRootPath = customWebRootPath;
}

// Forcer le mode production si configuré dans appsettings.json
var configuredEnvironment = app.Configuration["Environment"];
if (!string.IsNullOrEmpty(configuredEnvironment) && configuredEnvironment.Equals("Production", StringComparison.OrdinalIgnoreCase))
{
    app.Logger.LogInformation("Forcing Production environment based on configuration");
    var env = app.Services.GetRequiredService<IHostEnvironment>();
    ((IHostEnvironment)env).EnvironmentName = Environments.Production;
}

// Middleware
if (app.Environment.IsDevelopment())
{
    app.Logger.LogInformation("Running in Development mode");
    app.UseDeveloperExceptionPage();

    // Log détaillé des chemins en mode développement
    app.Logger.LogInformation($"ContentRootPath: {app.Environment.ContentRootPath}");
    app.Logger.LogInformation($"WebRootPath: {app.Environment.WebRootPath}");
    app.Logger.LogInformation($"Current Directory: {Directory.GetCurrentDirectory()}");
}
else
{
    app.Logger.LogInformation("Running in Production mode");
    // En production, ajouter le middleware de gestion des exceptions
    app.UseExceptionHandler("/error");
    app.UseHsts();
}

// Swagger est disponible dans tous les environnements, mais avec des restrictions en production
app.UseSwagger(c => {
    c.SerializeAsV2 = false; // Utiliser la v3 de OpenAPI
});

app.UseSwaggerUI(c => {
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Avanteam Marketplace API v1");

    // Ajouter des options supplémentaires pour le débogage
    c.DisplayRequestDuration();
    c.DocExpansion(Swashbuckle.AspNetCore.SwaggerUI.DocExpansion.None);
    c.DefaultModelsExpandDepth(-1); // Cache les schémas des modèles par défaut

    // En production, limiter l'accès à Swagger
    if (!app.Environment.IsDevelopment())
    {
        c.RoutePrefix = "swagger"; // Permet toujours d'accéder à Swagger mais sur un chemin spécifique
        c.EnableFilter(); // Active le filtre pour masquer les opérations sensibles
    }
});

app.UseHttpsRedirection();

// Configuration des fichiers statiques avec gestion d'erreur
try
{
    var effectiveWebRootPath = app.Environment.WebRootPath;
    app.Logger.LogInformation($"Configuration des fichiers statiques avec le chemin: {effectiveWebRootPath}");

    var fileProvider = new PhysicalFileProvider(effectiveWebRootPath);
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = fileProvider,
        RequestPath = "",
        OnPrepareResponse = ctx =>
        {
            // Désactiver le cache pour tous les fichiers statiques
            ctx.Context.Response.Headers.Append("Cache-Control", "no-cache, no-store, must-revalidate");
            ctx.Context.Response.Headers.Append("Pragma", "no-cache");
            ctx.Context.Response.Headers.Append("Expires", "0");
        }
    });
}
catch (Exception ex)
{
    app.Logger.LogError($"Erreur lors de la configuration des fichiers statiques: {ex.Message}");
    // L'application continuera de fonctionner, mais sans servir de fichiers statiques
}

app.UseCors("AllowProcessStudioOrigins");

// Activer la session pour l'administration
app.UseSession();

// Activer le middleware de validation des tokens Marketplace
app.UseMarketplaceTokenValidation();

app.UseAuthentication();
app.UseAuthorization();

// Mapper les routes avec une structure claire
// 1. Les pages Razor
app.MapRazorPages();
// 2. Les contrôleurs d'API
app.MapControllers();

// Seed de la base de données si nécessaire
try
{
    using (var scope = app.Services.CreateScope())
    {
        var services = scope.ServiceProvider;
        var dbContext = services.GetRequiredService<MarketplaceDbContext>();
        dbContext.Database.Migrate();

        // Seed de données initiales
        DbInitializer.Initialize(dbContext);
    }
}
catch (Exception ex)
{
    app.Logger.LogError($"Erreur lors de l'initialisation de la base de données: {ex.Message}");
    // Ne pas arrêter l'application
}

app.Run();