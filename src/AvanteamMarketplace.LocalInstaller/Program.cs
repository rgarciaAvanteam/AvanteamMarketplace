using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.Server.IIS;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.OpenApi.Models;
using System;
using System.IO;
using System.Linq;
using System.Reflection;

var builder = WebApplication.CreateBuilder(args);

// Ajouter la configuration depuis appsettings.json
builder.Configuration.AddJsonFile("appsettings.json", optional: true, reloadOnChange: true);

// Configurer le logging
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();
builder.Logging.AddFile(Path.Combine(Directory.GetCurrentDirectory(), "logs"));

// Ajouter les services
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = null;
    options.JsonSerializerOptions.WriteIndented = true;
});

// Permettre la lecture multiple du body des requêtes
builder.Services.Configure<IISServerOptions>(options =>
{
    options.AllowSynchronousIO = true;
});

// Ajouter Swagger pour la documentation d'API
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "API d'Installation Locale Marketplace",
        Version = "v1",
        Description = "API locale pour l'installation et la désinstallation des composants du Marketplace Avanteam",
        Contact = new OpenApiContact
        {
            Name = "Avanteam Support",
            Email = "support@avanteam.fr"
        }
    });
    
        // Inclure les commentaires XML pour la documentation Swagger
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        c.IncludeXmlComments(xmlPath);
    }
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("ProcessStudioPolicy", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Ajouter la prise en charge des Server-Sent Events (SSE)
builder.Services.AddResponseCompression(options =>
{
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(
        new[] { "text/event-stream" });
});

var app = builder.Build();

// Configurer le routing
app.UseRouting();

// Configuration de l'application
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/Error");
}

// Activer la compression de réponse
app.UseResponseCompression();

// Activer Swagger
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    // Utiliser un chemin relatif pour que ça fonctionne dans le contexte IIS actuel
    c.SwaggerEndpoint("../swagger/v1/swagger.json", "API d'Installation Locale v1");
    c.RoutePrefix = "swagger";
});

app.UseCors("ProcessStudioPolicy");

app.UseEndpoints(endpoints =>
{
    endpoints.MapControllers();
});

app.Run();

// Extension pour ajouter le file logging
public static class FileLoggerExtensions
{
    public static ILoggingBuilder AddFile(this ILoggingBuilder builder, string logDirectory)
    {
        if (!Directory.Exists(logDirectory))
        {
            Directory.CreateDirectory(logDirectory);
        }
        
        builder.Services.AddSingleton<ILoggerProvider, FileLoggerProvider>(sp =>
        {
            return new FileLoggerProvider(logDirectory);
        });
        
        return builder;
    }
}

// Classe pour gérer le file logging
public class FileLoggerProvider : ILoggerProvider
{
    private readonly string _logDirectory;
    private readonly object _lock = new object();
    
    public FileLoggerProvider(string logDirectory)
    {
        _logDirectory = logDirectory;
    }
    
    public ILogger CreateLogger(string categoryName)
    {
        return new FileLogger(_logDirectory, categoryName);
    }
    
    public void Dispose() { }
    
    private class FileLogger : ILogger
    {
        private readonly string _logDirectory;
        private readonly string _categoryName;
        
        public FileLogger(string logDirectory, string categoryName)
        {
            _logDirectory = logDirectory;
            _categoryName = categoryName;
        }
        
        public IDisposable BeginScope<TState>(TState state) => null;
        
        public bool IsEnabled(LogLevel logLevel) => true;
        
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception exception, Func<TState, Exception, string> formatter)
        {
            if (!IsEnabled(logLevel))
            {
                return;
            }
            
            var logFile = Path.Combine(_logDirectory, $"installer-{DateTime.Today:yyyy-MM-dd}.log");
            var message = formatter(state, exception);
            
            lock (new object())
            {
                File.AppendAllText(logFile, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} [{logLevel}] [{_categoryName}] {message}{Environment.NewLine}");
                
                if (exception != null)
                {
                    File.AppendAllText(logFile, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} [{logLevel}] [{_categoryName}] Exception: {exception}{Environment.NewLine}");
                }
            }
        }
    }
}