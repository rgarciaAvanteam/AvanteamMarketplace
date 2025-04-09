using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.IO;

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

builder.Services.AddCors(options =>
{
    options.AddPolicy("ProcessStudioPolicy", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configuration de l'application
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseRouting();
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