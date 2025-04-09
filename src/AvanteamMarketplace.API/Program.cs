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

var builder = WebApplication.CreateBuilder(args);

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
builder.Services.AddScoped<IGitHubIntegrationService, GitHubIntegrationService>();
builder.Services.AddScoped<IComponentInstallerService, ComponentInstallerService>();

// Activer la prise en charge de Razor Pages
builder.Services.AddRazorPages();

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
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.Preserve;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

// Configuration de Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { 
        Title = "Avanteam Marketplace API", 
        Version = "v1",
        Description = "API pour la gestion et l'utilisation du Marketplace Avanteam destiné aux composants Process Studio",
        Contact = new() {
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

// Configuration de l'authentification par clé API
builder.Services.AddAuthentication("ApiKey")
    .AddScheme<ApiKeyAuthenticationOptions, ApiKeyAuthenticationHandler>("ApiKey", options => { });
builder.Services.AddScoped<IApiKeyValidator, ApiKeyValidator>();

var app = builder.Build();

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
app.UseStaticFiles();
app.UseCors("AllowProcessStudioOrigins");

// Activer la session pour l'administration
app.UseSession();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapRazorPages();

// Seed de la base de données si nécessaire
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var dbContext = services.GetRequiredService<MarketplaceDbContext>();
    dbContext.Database.Migrate();
    
    // Seed de données initiales
    DbInitializer.Initialize(dbContext);
}

app.Run();