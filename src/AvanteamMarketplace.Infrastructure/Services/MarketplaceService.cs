using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AvanteamMarketplace.Core.Models;
using AvanteamMarketplace.Core.Services;
using AvanteamMarketplace.Core.ViewModels;
using AvanteamMarketplace.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AvanteamMarketplace.Infrastructure.Services
{
    /// <summary>
    /// Implémentation du service du marketplace
    /// </summary>
    public class MarketplaceService : IMarketplaceService
    {
        private readonly MarketplaceDbContext _context;
        private readonly IProcessStudioVersionDetector _versionDetector;
        private readonly ILogger<MarketplaceService> _logger;
        
        public MarketplaceService(
            MarketplaceDbContext context,
            IProcessStudioVersionDetector versionDetector,
            ILogger<MarketplaceService> logger)
        {
            _context = context;
            _versionDetector = versionDetector;
            _logger = logger;
        }
        
        /// <summary>
        /// Récupère les composants compatibles avec la version de la plateforme spécifiée
        /// </summary>
        public async Task<ComponentsViewModel> GetCompatibleComponentsAsync(string clientId, string platformVersion)
        {
            try
            {
                // Récupérer tous les composants
                var components = await _context.Components
                    .Include(c => c.Tags)
                    .AsNoTracking()
                    .ToListAsync();
                
                // Récupérer les installations du client si un ID client est fourni
                var installedComponents = new List<InstalledComponent>();
                if (!string.IsNullOrEmpty(clientId))
                {
                    installedComponents = await _context.InstalledComponents
                        .Include(ic => ic.Installation)
                        .Where(ic => ic.Installation.ClientIdentifier == clientId && ic.IsActive)
                        .AsNoTracking()
                        .ToListAsync();
                }
                
                // Filtrer les composants compatibles
                var compatibleComponents = components
                    .Where(c => _versionDetector.IsPlatformVersionSufficient(c.MinPlatformVersion, platformVersion))
                    .ToList();
                
                // Créer le ViewModel
                var result = new ComponentsViewModel
                {
                    PlatformInfo = new PlatformInfoViewModel
                    {
                        Version = platformVersion,
                        ClientId = clientId ?? "",
                        ComponentsCount = compatibleComponents.Count,
                        UpdatesCount = 0 // Sera calculé plus tard
                    }
                };
                
                // Ajouter les composants au ViewModel
                foreach (var component in compatibleComponents)
                {
                    // Vérifier si le composant est installé par ce client
                    var installInfo = installedComponents.FirstOrDefault(ic => ic.ComponentId == component.ComponentId);
                    bool isInstalled = installInfo != null;
                    bool hasUpdate = isInstalled && _versionDetector.CompareVersions(component.Version, installInfo.Version) > 0;
                    
                    // Si on a détecté une mise à jour, incrementer le compteur
                    if (hasUpdate)
                    {
                        result.PlatformInfo.UpdatesCount++;
                    }
                    
                    // Ajouter le composant au ViewModel
                    result.Components.Add(new ComponentViewModel
                    {
                        ComponentId = component.ComponentId,
                        Name = component.Name,
                        DisplayName = component.DisplayName,
                        Description = component.Description,
                        Version = component.Version,
                        Category = component.Category,
                        Author = component.Author,
                        MinPlatformVersion = component.MinPlatformVersion,
                        RequiresRestart = component.RequiresRestart,
                        IsInstalled = isInstalled,
                        HasUpdate = hasUpdate,
                        IsCompatible = true,
                        Tags = component.Tags.Select(t => t.Tag).ToList(),
                        IconUrl = $"/images/{component.Name}.svg"
                    });
                }
                
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des composants compatibles: {ex.Message}");
                throw;
            }
        }
        
        /// <summary>
        /// Récupère les mises à jour disponibles pour un client
        /// </summary>
        public async Task<ComponentsViewModel> GetUpdatesForClientAsync(string clientId, string platformVersion)
        {
            try
            {
                if (string.IsNullOrEmpty(clientId))
                {
                    return new ComponentsViewModel
                    {
                        PlatformInfo = new PlatformInfoViewModel
                        {
                            Version = platformVersion,
                            ClientId = "",
                            ComponentsCount = 0,
                            UpdatesCount = 0
                        }
                    };
                }
                
                // Récupérer tous les composants
                var components = await _context.Components
                    .Include(c => c.Tags)
                    .AsNoTracking()
                    .ToListAsync();
                
                // Récupérer les installations du client
                var installedComponents = await _context.InstalledComponents
                    .Include(ic => ic.Installation)
                    .Where(ic => ic.Installation.ClientIdentifier == clientId && ic.IsActive)
                    .AsNoTracking()
                    .ToListAsync();
                
                // Filtrer les composants compatibles qui ont des mises à jour
                var componentsWithUpdates = new List<Component>();
                
                foreach (var component in components)
                {
                    var installInfo = installedComponents.FirstOrDefault(ic => ic.ComponentId == component.ComponentId);
                    
                    // Si le composant est installé et qu'il y a une mise à jour disponible
                    if (installInfo != null && 
                        _versionDetector.CompareVersions(component.Version, installInfo.Version) > 0 &&
                        _versionDetector.IsPlatformVersionSufficient(component.MinPlatformVersion, platformVersion))
                    {
                        componentsWithUpdates.Add(component);
                    }
                }
                
                // Créer le ViewModel
                var result = new ComponentsViewModel
                {
                    PlatformInfo = new PlatformInfoViewModel
                    {
                        Version = platformVersion,
                        ClientId = clientId,
                        ComponentsCount = componentsWithUpdates.Count,
                        UpdatesCount = componentsWithUpdates.Count
                    }
                };
                
                // Ajouter les composants au ViewModel
                foreach (var component in componentsWithUpdates)
                {
                    var installInfo = installedComponents.First(ic => ic.ComponentId == component.ComponentId);
                    
                    result.Components.Add(new ComponentViewModel
                    {
                        ComponentId = component.ComponentId,
                        Name = component.Name,
                        DisplayName = component.DisplayName,
                        Description = component.Description,
                        Version = component.Version,
                        Category = component.Category,
                        Author = component.Author,
                        MinPlatformVersion = component.MinPlatformVersion,
                        RequiresRestart = component.RequiresRestart,
                        IsInstalled = true,
                        HasUpdate = true,
                        IsCompatible = true,
                        Tags = component.Tags.Select(t => t.Tag).ToList(),
                        IconUrl = $"/images/{component.Name}.svg"
                    });
                }
                
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des mises à jour: {ex.Message}");
                throw;
            }
        }
        
        /// <summary>
        /// Récupère les composants futurs (non compatibles avec la version actuelle)
        /// </summary>
        public async Task<ComponentsViewModel> GetFutureComponentsAsync(string clientId, string platformVersion)
        {
            try
            {
                // Récupérer tous les composants
                var components = await _context.Components
                    .Include(c => c.Tags)
                    .AsNoTracking()
                    .ToListAsync();
                
                // Filtrer les composants non compatibles avec la version actuelle
                var futureComponents = components
                    .Where(c => !_versionDetector.IsPlatformVersionSufficient(c.MinPlatformVersion, platformVersion))
                    .ToList();
                
                // Créer le ViewModel
                var result = new ComponentsViewModel
                {
                    PlatformInfo = new PlatformInfoViewModel
                    {
                        Version = platformVersion,
                        ClientId = clientId ?? "",
                        ComponentsCount = futureComponents.Count,
                        UpdatesCount = 0
                    }
                };
                
                // Ajouter les composants au ViewModel
                foreach (var component in futureComponents)
                {
                    result.Components.Add(new ComponentViewModel
                    {
                        ComponentId = component.ComponentId,
                        Name = component.Name,
                        DisplayName = component.DisplayName,
                        Description = component.Description,
                        Version = component.Version,
                        Category = component.Category,
                        Author = component.Author,
                        MinPlatformVersion = component.MinPlatformVersion,
                        RequiresRestart = component.RequiresRestart,
                        IsInstalled = false,
                        HasUpdate = false,
                        IsCompatible = false,
                        Tags = component.Tags.Select(t => t.Tag).ToList(),
                        IconUrl = $"/images/{component.Name}.svg"
                    });
                }
                
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des composants futurs: {ex.Message}");
                throw;
            }
        }
        
        /// <summary>
        /// Récupère les détails d'un composant
        /// </summary>
        public async Task<ComponentDetailViewModel> GetComponentDetailAsync(int componentId)
        {
            try
            {
                // Récupérer le composant
                var component = await _context.Components
                    .Include(c => c.Tags)
                    .Include(c => c.Versions)
                    .Include(c => c.Dependencies)
                        .ThenInclude(d => d.DependsOnComponent)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.ComponentId == componentId);
                
                if (component == null)
                {
                    return null;
                }
                
                // Récupérer les statistiques de téléchargement et d'installation
                int downloadCount = await _context.ComponentDownloads
                    .CountAsync(cd => cd.ComponentId == componentId);
                    
                int installationCount = await _context.InstalledComponents
                    .CountAsync(ic => ic.ComponentId == componentId && ic.IsActive);
                
                // Créer le ViewModel
                var result = new ComponentDetailViewModel
                {
                    ComponentId = component.ComponentId,
                    Name = component.Name,
                    DisplayName = component.DisplayName,
                    Description = component.Description,
                    Version = component.Version,
                    Category = component.Category,
                    Author = component.Author,
                    MinPlatformVersion = component.MinPlatformVersion,
                    RecommendedPlatformVersion = component.RecommendedPlatformVersion,
                    RepositoryUrl = component.RepositoryUrl,
                    RequiresRestart = component.RequiresRestart,
                    CreatedDate = component.CreatedDate,
                    UpdatedDate = component.UpdatedDate,
                    IsInstalled = false, // Sera défini par le client
                    IsCompatible = true, // Sera défini par le client
                    HasUpdate = false,   // Sera défini par le client
                    IconUrl = $"/images/{component.Name}.svg",
                    DownloadCount = downloadCount,
                    InstallationCount = installationCount,
                    Tags = component.Tags.Select(t => t.Tag).ToList(),
                    Versions = component.Versions.Select(v => new VersionViewModel
                    {
                        VersionId = v.VersionId,
                        VersionNumber = v.Version,
                        ReleaseDate = v.ReleaseDate,
                        ChangeLog = v.ChangeLog ?? v.ReleaseNotes ?? "",
                        DownloadUrl = v.PackageUrl ?? "",
                        DownloadCount = _context.ComponentDownloads.Count(cd => cd.ComponentId == componentId && cd.Version == v.Version),
                        IsLatest = v.IsLatest
                    }).ToList(),
                    Dependencies = component.Dependencies.Select(d => new DependencyViewModel
                    {
                        DependencyId = d.DependsOnComponentId,
                        ComponentName = d.DependsOnComponent.DisplayName,
                        MinVersion = d.MinVersion,
                        MaxVersion = d.MaxVersion ?? "",
                        IsRequired = d.IsRequired
                    }).ToList()
                };
                
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des détails du composant {componentId}: {ex.Message}");
                throw;
            }
        }
        
        /// <summary>
        /// Récupère le contenu README d'un composant
        /// </summary>
        public async Task<string> GetComponentReadmeAsync(int componentId)
        {
            try
            {
                var component = await _context.Components
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.ComponentId == componentId);
                
                if (component == null)
                {
                    return null;
                }
                
                return component.ReadmeContent;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération du README du composant {componentId}: {ex.Message}");
                throw;
            }
        }
        
        /// <summary>
        /// Récupère les informations de téléchargement d'un composant
        /// </summary>
        public async Task<ComponentDownloadInfo> GetComponentDownloadInfoAsync(int componentId, string? version = null)
        {
            try
            {
                var component = await _context.Components
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.ComponentId == componentId);
                
                if (component == null)
                {
                    return null;
                }
                
                // Si une version spécifique est demandée
                if (!string.IsNullOrEmpty(version))
                {
                    var versionInfo = await _context.ComponentVersions
                        .AsNoTracking()
                        .FirstOrDefaultAsync(v => v.ComponentId == componentId && v.Version == version);
                    
                    if (versionInfo != null)
                    {
                        return new ComponentDownloadInfo
                        {
                            Version = versionInfo.Version,
                            DownloadUrl = versionInfo.PackageUrl,
                            FilePath = null // Pourrait être implémenté pour les fichiers locaux
                        };
                    }
                }
                
                // Sinon, retourner la version actuelle
                return new ComponentDownloadInfo
                {
                    Version = component.Version,
                    DownloadUrl = component.PackageUrl,
                    FilePath = null // Pourrait être implémenté pour les fichiers locaux
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des informations de téléchargement du composant {componentId}: {ex.Message}");
                throw;
            }
        }
        
        /// <summary>
        /// Enregistre un téléchargement de composant
        /// </summary>
        public async Task LogComponentDownloadAsync(int componentId, string clientId, string version)
        {
            try
            {
                var component = await _context.Components
                    .FirstOrDefaultAsync(c => c.ComponentId == componentId);
                
                if (component == null)
                {
                    throw new ArgumentException($"Composant {componentId} non trouvé");
                }
                
                var download = new ComponentDownload
                {
                    ComponentId = componentId,
                    Version = version,
                    ClientIdentifier = clientId,
                    ClientIp = null, // Pourrait être implémenté
                    DownloadDate = DateTime.UtcNow
                };
                
                _context.ComponentDownloads.Add(download);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de l'enregistrement du téléchargement du composant {componentId}: {ex.Message}");
                throw;
            }
        }
        
        /// <summary>
        /// Enregistre l'installation d'un composant
        /// </summary>
        public async Task LogComponentInstallationAsync(int componentId, string clientId, string? version = null)
        {
            try
            {
                var component = await _context.Components
                    .FirstOrDefaultAsync(c => c.ComponentId == componentId);
                
                if (component == null)
                {
                    throw new ArgumentException($"Composant {componentId} non trouvé");
                }
                
                // Si aucune version n'est spécifiée, utiliser la version actuelle du composant
                version ??= component.Version;
                
                // Récupérer ou créer l'installation client
                var clientInstallation = await _context.ClientInstallations
                    .FirstOrDefaultAsync(ci => ci.ClientIdentifier == clientId);
                
                if (clientInstallation == null)
                {
                    clientInstallation = new ClientInstallation
                    {
                        ClientIdentifier = clientId,
                        RegisteredDate = DateTime.UtcNow,
                        LastCheckinDate = DateTime.UtcNow
                    };
                    
                    _context.ClientInstallations.Add(clientInstallation);
                    await _context.SaveChangesAsync();
                }
                else
                {
                    // Mettre à jour la date de dernière vérification
                    clientInstallation.LastCheckinDate = DateTime.UtcNow;
                    _context.ClientInstallations.Update(clientInstallation);
                }
                
                // Vérifier si le composant est déjà installé
                var installedComponent = await _context.InstalledComponents
                    .FirstOrDefaultAsync(ic => ic.InstallationId == clientInstallation.InstallationId && ic.ComponentId == componentId);
                
                if (installedComponent == null)
                {
                    // Créer une nouvelle installation
                    installedComponent = new InstalledComponent
                    {
                        InstallationId = clientInstallation.InstallationId,
                        ComponentId = componentId,
                        Version = version,
                        InstallDate = DateTime.UtcNow,
                        LastUpdateDate = DateTime.UtcNow,
                        IsActive = true
                    };
                    
                    _context.InstalledComponents.Add(installedComponent);
                }
                else
                {
                    // Mettre à jour l'installation existante
                    installedComponent.Version = version;
                    installedComponent.LastUpdateDate = DateTime.UtcNow;
                    installedComponent.IsActive = true;
                    
                    _context.InstalledComponents.Update(installedComponent);
                }
                
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de l'enregistrement de l'installation du composant {componentId}: {ex.Message}");
                throw;
            }
        }
        
        /// <summary>
        /// Désinstalle un composant pour un client spécifique
        /// </summary>
        /// <param name="componentId">ID du composant à désinstaller</param>
        /// <param name="clientId">Identifiant du client</param>
        /// <returns>True si la désinstallation a réussi, sinon False</returns>
        public async Task<bool> UninstallComponentAsync(int componentId, string clientId)
        {
            try
            {
                _logger.LogInformation($"Désinstallation du composant {componentId} pour le client {clientId}");
                
                // Vérifier que le composant existe
                var component = await _context.Components
                    .FirstOrDefaultAsync(c => c.ComponentId == componentId);
                
                if (component == null)
                {
                    _logger.LogWarning($"Tentative de désinstallation d'un composant inexistant: {componentId}");
                    return false;
                }
                
                // Récupérer l'installation client
                var clientInstallation = await _context.ClientInstallations
                    .FirstOrDefaultAsync(ci => ci.ClientIdentifier == clientId);
                
                if (clientInstallation == null)
                {
                    _logger.LogWarning($"Client inconnu lors de la désinstallation: {clientId}");
                    return false;
                }
                
                // Récupérer l'installation du composant
                var installedComponent = await _context.InstalledComponents
                    .FirstOrDefaultAsync(ic => 
                        ic.InstallationId == clientInstallation.InstallationId && 
                        ic.ComponentId == componentId &&
                        ic.IsActive);
                
                if (installedComponent == null)
                {
                    _logger.LogWarning($"Le composant {componentId} n'est pas installé pour le client {clientId}");
                    return false;
                }
                
                // Marquer le composant comme désinstallé (ne pas le supprimer pour conserver l'historique)
                installedComponent.IsActive = false;
                installedComponent.LastUpdateDate = DateTime.UtcNow;
                
                _context.InstalledComponents.Update(installedComponent);
                await _context.SaveChangesAsync();
                
                _logger.LogInformation($"Désinstallation réussie du composant {componentId} pour le client {clientId}");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la désinstallation du composant {componentId} pour le client {clientId}: {ex.Message}");
                throw;
            }
        }
        
        // Méthodes d'administration
    
    /// <summary>
    /// Récupère la liste des composants pour l'administration
    /// </summary>
    public async Task<ComponentsAdminViewModel> GetComponentsForAdminAsync()
    {
        try
        {
            var components = await _context.Components
                .Include(c => c.Tags)
                .AsNoTracking()
                .ToListAsync();
                
            // Calculer les statistiques pour chaque composant
            var result = new ComponentsAdminViewModel
            {
                Components = new List<ComponentAdminViewModel>()
            };
            
            foreach (var component in components)
            {
                int downloads = await _context.ComponentDownloads
                    .CountAsync(cd => cd.ComponentId == component.ComponentId);
                    
                int installations = await _context.InstalledComponents
                    .CountAsync(ic => ic.ComponentId == component.ComponentId && ic.IsActive);
                
                result.Components.Add(new ComponentAdminViewModel
                {
                    ComponentId = component.ComponentId,
                    Name = component.Name,
                    DisplayName = component.DisplayName,
                    Description = component.Description,
                    Version = component.Version,
                    Category = component.Category,
                    MinPlatformVersion = component.MinPlatformVersion,
                    TotalDownloads = downloads,
                    TotalInstallations = installations,
                    Status = component.MinPlatformVersion.StartsWith("24") ? "Future" : "Active",
                    IconUrl = $"/images/{component.Name}.svg",
                    UpdatedDate = component.UpdatedDate
                });
            }
            
            // Calculer les statistiques globales
            result.Statistics = new AdminStatisticsViewModel
            {
                TotalComponents = components.Count,
                TotalCategories = components.Select(c => c.Category).Distinct().Count(),
                TotalClients = await _context.ClientInstallations.CountAsync(),
                TotalDownloads = await _context.ComponentDownloads.CountAsync(),
                TotalInstallations = await _context.InstalledComponents.CountAsync(ic => ic.IsActive)
            };
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erreur lors de la récupération des composants pour l'administration: {ex.Message}");
            throw;
        }
    }
    
    /// <summary>
    /// Récupère les détails d'un composant pour l'administration
    /// </summary>
    public async Task<ComponentAdminDetailViewModel> GetComponentAdminDetailAsync(int componentId)
    {
        try
        {
            var component = await _context.Components
                .Include(c => c.Tags)
                .Include(c => c.Versions)
                .Include(c => c.Dependencies)
                    .ThenInclude(d => d.DependsOnComponent)
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.ComponentId == componentId);
                
            if (component == null)
            {
                return null;
            }
            
            var result = new ComponentAdminDetailViewModel
            {
                ComponentId = component.ComponentId,
                Name = component.Name,
                DisplayName = component.DisplayName,
                Description = component.Description,
                Version = component.Version,
                Category = component.Category,
                Author = component.Author,
                MinPlatformVersion = component.MinPlatformVersion,
                RecommendedPlatformVersion = component.RecommendedPlatformVersion,
                RepositoryUrl = component.RepositoryUrl,
                RequiresRestart = component.RequiresRestart,
                TargetPath = component.TargetPath,
                PackageUrl = component.PackageUrl,
                ReadmeContent = component.ReadmeContent,
                IconUrl = $"/images/{component.Name}.svg",
                CreatedDate = component.CreatedDate,
                UpdatedDate = component.UpdatedDate,
                
                TotalDownloads = await _context.ComponentDownloads.CountAsync(cd => cd.ComponentId == componentId),
                TotalInstallations = await _context.InstalledComponents.CountAsync(ic => ic.ComponentId == componentId),
                ActiveInstallations = await _context.InstalledComponents.CountAsync(ic => ic.ComponentId == componentId && ic.IsActive),
                
                Tags = component.Tags.Select(t => t.Tag).ToList(),
                
                Versions = component.Versions.Select(v => new VersionViewModel
                {
                    VersionId = v.VersionId,
                    VersionNumber = v.Version,
                    ReleaseDate = v.ReleaseDate,
                    ChangeLog = v.ChangeLog ?? "",
                    DownloadUrl = v.PackageUrl ?? "",
                    DownloadCount = _context.ComponentDownloads.Count(cd => cd.ComponentId == componentId && cd.Version == v.Version),
                    IsLatest = v.IsLatest
                }).ToList(),
                
                Dependencies = component.Dependencies.Select(d => new DependencyViewModel
                {
                    DependencyId = d.DependsOnComponentId,
                    ComponentName = d.DependsOnComponent.DisplayName,
                    MinVersion = d.MinVersion,
                    MaxVersion = d.MaxVersion ?? string.Empty,
                    IsRequired = d.IsRequired
                }).ToList()
            };
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erreur lors de la récupération des détails du composant {componentId} pour l'administration: {ex.Message}");
            throw;
        }
    }
    
    /// <summary>
    /// Crée un nouveau composant
    /// </summary>
    public async Task<int> CreateComponentAsync(ComponentCreateViewModel model)
    {
        try
        {
            // Vérifier si le nom du composant est déjà utilisé
            if (await _context.Components.AnyAsync(c => c.Name == model.Name))
            {
                throw new ArgumentException($"Un composant avec le nom {model.Name} existe déjà");
            }
            
            var component = new Component
            {
                Name = model.Name,
                DisplayName = model.DisplayName,
                Description = model.Description,
                Version = model.Version,
                Category = model.Category,
                Author = model.Author,
                MinPlatformVersion = model.MinPlatformVersion,
                RecommendedPlatformVersion = model.RecommendedPlatformVersion,
                RepositoryUrl = model.RepositoryUrl,
                RequiresRestart = model.RequiresRestart,
                TargetPath = model.TargetPath,
                PackageUrl = model.PackageUrl,
                ReadmeContent = model.ReadmeContent,
                CreatedDate = DateTime.UtcNow,
                UpdatedDate = DateTime.UtcNow
            };
            
            // Ajouter les tags
            if (model.Tags != null)
            {
                foreach (var tag in model.Tags)
                {
                    component.Tags.Add(new ComponentTag { Component = component, Tag = tag });
                }
            }
            
            // Ajouter les dépendances
            if (model.Dependencies != null)
            {
                foreach (var dependency in model.Dependencies)
                {
                    component.Dependencies.Add(new ComponentDependency
                    {
                        Component = component,
                        DependsOnComponentId = dependency.ComponentId,
                        MinVersion = dependency.MinVersion,
                        IsRequired = true
                    });
                }
            }
            
            _context.Components.Add(component);
            await _context.SaveChangesAsync();
            
            return component.ComponentId;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erreur lors de la création du composant {model.Name}: {ex.Message}");
            throw;
        }
    }
    
    /// <summary>
    /// Met à jour un composant existant
    /// </summary>
    public async Task<bool> UpdateComponentAsync(int componentId, ComponentUpdateViewModel model)
    {
        try
        {
            var component = await _context.Components
                .Include(c => c.Tags)
                .Include(c => c.Dependencies)
                .FirstOrDefaultAsync(c => c.ComponentId == componentId);
                
            if (component == null)
            {
                return false;
            }
            
            // Mettre à jour les propriétés
            if (!string.IsNullOrEmpty(model.DisplayName))
                component.DisplayName = model.DisplayName;
                
            if (!string.IsNullOrEmpty(model.Description))
                component.Description = model.Description;
                
            if (!string.IsNullOrEmpty(model.Version))
                component.Version = model.Version;
                
            if (!string.IsNullOrEmpty(model.Category))
                component.Category = model.Category;
                
            if (!string.IsNullOrEmpty(model.Author))
                component.Author = model.Author;
                
            if (!string.IsNullOrEmpty(model.MinPlatformVersion))
                component.MinPlatformVersion = model.MinPlatformVersion;
                
            if (!string.IsNullOrEmpty(model.RecommendedPlatformVersion))
                component.RecommendedPlatformVersion = model.RecommendedPlatformVersion;
                
            if (!string.IsNullOrEmpty(model.RepositoryUrl))
                component.RepositoryUrl = model.RepositoryUrl;
                
            if (model.RequiresRestart.HasValue)
                component.RequiresRestart = model.RequiresRestart.Value;
                
            if (!string.IsNullOrEmpty(model.TargetPath))
                component.TargetPath = model.TargetPath;
                
            if (!string.IsNullOrEmpty(model.PackageUrl))
                component.PackageUrl = model.PackageUrl;
                
            if (!string.IsNullOrEmpty(model.ReadmeContent))
                component.ReadmeContent = model.ReadmeContent;
                
            component.UpdatedDate = DateTime.UtcNow;
            
            // Mettre à jour les tags
            if (model.Tags != null)
            {
                component.Tags.Clear();
                foreach (var tag in model.Tags)
                {
                    component.Tags.Add(new ComponentTag { Component = component, Tag = tag });
                }
            }
            
            // Mettre à jour les dépendances
            if (model.Dependencies != null)
            {
                component.Dependencies.Clear();
                foreach (var dependency in model.Dependencies)
                {
                    component.Dependencies.Add(new ComponentDependency
                    {
                        Component = component,
                        DependsOnComponentId = dependency.ComponentId,
                        MinVersion = dependency.MinVersion,
                        IsRequired = true
                    });
                }
            }
            
            await _context.SaveChangesAsync();
            
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erreur lors de la mise à jour du composant {componentId}: {ex.Message}");
            throw;
        }
    }
    
    /// <summary>
    /// Supprime un composant
    /// </summary>
    public async Task<bool> DeleteComponentAsync(int componentId)
    {
        try
        {
            // Inclure explicitement toutes les collections liées
            var component = await _context.Components
                .Include(c => c.Tags)
                .Include(c => c.Dependencies)
                .Include(c => c.Versions)
                .FirstOrDefaultAsync(c => c.ComponentId == componentId);
                
            if (component == null)
            {
                return false;
            }
            
            // Vérifier s'il y a des installations actives
            int activeInstallations = await _context.InstalledComponents
                .CountAsync(ic => ic.ComponentId == componentId && ic.IsActive);
                
            if (activeInstallations > 0)
            {
                // Récupérer les identifiants des clients qui ont ce composant installé
                var clientsWithInstallation = await _context.InstalledComponents
                    .Include(ic => ic.Installation)
                    .Where(ic => ic.ComponentId == componentId && ic.IsActive)
                    .Select(ic => ic.Installation.ClientIdentifier)
                    .ToListAsync();
                
                string clientsList = string.Join(", ", clientsWithInstallation);
                
                throw new InvalidOperationException(
                    $"Impossible de supprimer un composant avec des installations actives. " +
                    $"Ce composant est installé sur {activeInstallations} plateforme(s): {clientsList}");
            }
            
            // Supprimer les téléchargements
            var downloads = await _context.ComponentDownloads
                .Where(cd => cd.ComponentId == componentId)
                .ToListAsync();
                
            _context.ComponentDownloads.RemoveRange(downloads);
            
            // Supprimer les installations
            var installations = await _context.InstalledComponents
                .Where(ic => ic.ComponentId == componentId)
                .ToListAsync();
                
            _context.InstalledComponents.RemoveRange(installations);
            
            // Supprimer les dépendances inverses (composants qui dépendent de celui-ci)
            var inverseDependencies = await _context.ComponentDependencies
                .Where(cd => cd.DependsOnComponentId == componentId)
                .ToListAsync();
                
            _context.ComponentDependencies.RemoveRange(inverseDependencies);
            
            // Supprimer les tags du composant explicitement
            if (component.Tags != null && component.Tags.Any())
            {
                _context.ComponentTags.RemoveRange(component.Tags);
            }
            
            // Supprimer les dépendances du composant explicitement
            if (component.Dependencies != null && component.Dependencies.Any())
            {
                _context.ComponentDependencies.RemoveRange(component.Dependencies);
            }
            
            // Supprimer les versions du composant explicitement
            if (component.Versions != null && component.Versions.Any())
            {
                _context.ComponentVersions.RemoveRange(component.Versions);
            }
            
            // Enregistrer les suppressions de relations
            await _context.SaveChangesAsync();
            
            // Supprimer le composant lui-même
            _context.Components.Remove(component);
            
            // Enregistrer la suppression du composant
            await _context.SaveChangesAsync();
            
            _logger.LogInformation($"Composant {componentId} supprimé avec succès");
            
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erreur lors de la suppression du composant {componentId}: {ex.Message}");
            throw;
        }
    }
    
    /// <summary>
    /// Récupère la liste des clés API
    /// </summary>
    public async Task<List<ApiKeyViewModel>> GetApiKeysAsync()
    {
        try
        {
            var apiKeys = await _context.ApiKeys
                .AsNoTracking()
                .ToListAsync();
                
            return apiKeys.Select(k => new ApiKeyViewModel
            {
                ApiKeyId = k.ApiKeyId,
                Key = k.Key,
                ClientId = k.ClientId,
                IsAdmin = k.IsAdmin,
                IsActive = k.IsActive,
                CreatedDate = k.CreatedDate,
                LastAccessDate = k.LastAccessDate
            }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erreur lors de la récupération des clés API: {ex.Message}");
            throw;
        }
    }
    
    /// <summary>
    /// Crée une nouvelle clé API
    /// </summary>
    public async Task<ApiKeyViewModel> CreateApiKeyAsync(ApiKeyCreateViewModel model)
    {
        try
        {
            // Générer une nouvelle clé API
            string key = GenerateApiKey();
            
            var apiKey = new ApiKey
            {
                Key = key,
                ClientId = model.ClientId,
                IsAdmin = model.IsAdmin,
                IsActive = true,
                CreatedDate = DateTime.UtcNow
            };
            
            _context.ApiKeys.Add(apiKey);
            await _context.SaveChangesAsync();
            
            return new ApiKeyViewModel
            {
                ApiKeyId = apiKey.ApiKeyId,
                Key = apiKey.Key,
                ClientId = apiKey.ClientId,
                IsAdmin = apiKey.IsAdmin,
                IsActive = apiKey.IsActive,
                CreatedDate = apiKey.CreatedDate
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erreur lors de la création de la clé API: {ex.Message}");
            throw;
        }
    }
    
    /// <summary>
    /// Supprime une clé API
    /// </summary>
    public async Task<bool> DeleteApiKeyAsync(int apiKeyId)
    {
        try
        {
            var apiKey = await _context.ApiKeys.FindAsync(apiKeyId);
            if (apiKey == null)
            {
                return false;
            }
            
            _context.ApiKeys.Remove(apiKey);
            await _context.SaveChangesAsync();
            
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erreur lors de la suppression de la clé API {apiKeyId}: {ex.Message}");
            throw;
        }
    }
    
    /// <summary>
    /// Génère une nouvelle clé API
    /// </summary>
    private string GenerateApiKey()
    {
        byte[] key = new byte[32];
        using (var generator = System.Security.Cryptography.RandomNumberGenerator.Create())
        {
            generator.GetBytes(key);
        }
        
        return Convert.ToBase64String(key)
            .Replace("+", "-")
            .Replace("/", "_")
            .Replace("=", "")
            .Substring(0, 32);
    }
    
    /// <summary>
    /// Vérifie si une mise à jour est disponible pour un composant installé
    /// </summary>
    public async Task<ComponentUpdateInfo> CheckForUpdateAsync(int componentId, string clientId, string installedVersion, string platformVersion)
    {
        try
        {
            // Récupérer le composant et ses versions
            var component = await _context.Components
                .Include(c => c.Versions)
                .FirstOrDefaultAsync(c => c.ComponentId == componentId);
                
            if (component == null)
            {
                return null;
            }
            
            // Récupérer la dernière version compatible avec le client
            var latestVersion = component.Versions
                .Where(v => _versionDetector.IsPlatformVersionSufficient(v.MinPlatformVersion, platformVersion))
                .OrderByDescending(v => v.Version, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault();
                
            // Si aucune version compatible n'est trouvée, retourner la version principale du composant
            latestVersion ??= component.Versions.FirstOrDefault(v => v.IsLatest);
            
            // Si toujours pas de version, utiliser les données du composant lui-même
            if (latestVersion == null)
            {
                // Vérifier si la version actuelle du composant est plus récente que la version installée
                bool hasUpdate = _versionDetector.CompareVersions(component.Version, installedVersion) > 0;
                
                if (!hasUpdate)
                {
                    return null; // Aucune mise à jour disponible
                }
                
                // Vérifier si le composant est compatible avec la version de la plateforme du client
                bool isCompatible = _versionDetector.IsPlatformVersionSufficient(component.MinPlatformVersion, platformVersion);
                
                return new ComponentUpdateInfo
                {
                    AvailableVersion = component.Version,
                    InstalledVersion = installedVersion,
                    MinPlatformVersion = component.MinPlatformVersion,
                    DownloadUrl = component.PackageUrl,
                    ChangeLog = "Mise à jour disponible",
                    RequiresRestart = component.RequiresRestart,
                    IsCompatibleWithCurrentPlatform = isCompatible
                };
            }
            
            // Vérifier si la dernière version est plus récente que la version installée
            bool hasNewerVersion = _versionDetector.CompareVersions(latestVersion.Version, installedVersion) > 0;
            
            if (!hasNewerVersion)
            {
                return null; // Aucune mise à jour disponible
            }
            
            // Vérifier si la dernière version est compatible avec la version de la plateforme du client
            bool isCompatibleWithPlatform = _versionDetector.IsPlatformVersionSufficient(
                latestVersion.MinPlatformVersion ?? component.MinPlatformVersion, 
                platformVersion);
            
            return new ComponentUpdateInfo
            {
                AvailableVersion = latestVersion.Version,
                InstalledVersion = installedVersion,
                MinPlatformVersion = latestVersion.MinPlatformVersion ?? component.MinPlatformVersion,
                DownloadUrl = latestVersion.PackageUrl ?? component.PackageUrl,
                ChangeLog = latestVersion.ChangeLog ?? latestVersion.ReleaseNotes ?? "Mise à jour disponible",
                RequiresRestart = component.RequiresRestart,
                IsCompatibleWithCurrentPlatform = isCompatibleWithPlatform
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erreur lors de la vérification des mises à jour pour le composant {componentId}: {ex.Message}");
            throw;
        }
    }
    
    /// <summary>
    /// Récupère la liste des versions d'un composant
    /// </summary>
    public async Task<List<VersionViewModel>> GetComponentVersionsAsync(int componentId)
    {
        try
        {
            var component = await _context.Components
                .Include(c => c.Versions)
                .FirstOrDefaultAsync(c => c.ComponentId == componentId);
                
            if (component == null)
            {
                return new List<VersionViewModel>();
            }
            
            return component.Versions.Select(v => new VersionViewModel
            {
                VersionId = v.VersionId,
                VersionNumber = v.Version,
                ReleaseDate = v.ReleaseDate,
                ChangeLog = v.ChangeLog ?? v.ReleaseNotes ?? "",
                DownloadUrl = v.PackageUrl ?? "",
                DownloadCount = _context.ComponentDownloads.Count(cd => cd.ComponentId == componentId && cd.Version == v.Version),
                IsLatest = v.IsLatest,
                MinPlatformVersion = v.MinPlatformVersion ?? ""
            }).OrderByDescending(v => v.ReleaseDate).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erreur lors de la récupération des versions du composant {componentId}: {ex.Message}");
            throw;
        }
    }
    
    /// <summary>
    /// Récupère les détails d'une version spécifique
    /// </summary>
    public async Task<VersionViewModel> GetComponentVersionAsync(int versionId)
    {
        try
        {
            var version = await _context.ComponentVersions
                .FirstOrDefaultAsync(v => v.VersionId == versionId);
                
            if (version == null)
            {
                return null;
            }
            
            return new VersionViewModel
            {
                VersionId = version.VersionId,
                VersionNumber = version.Version,
                ReleaseDate = version.ReleaseDate,
                ChangeLog = version.ChangeLog ?? version.ReleaseNotes ?? "",
                DownloadUrl = version.PackageUrl ?? "",
                DownloadCount = _context.ComponentDownloads.Count(cd => cd.ComponentId == version.ComponentId && cd.Version == version.Version),
                IsLatest = version.IsLatest,
                MinPlatformVersion = version.MinPlatformVersion ?? ""
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erreur lors de la récupération de la version {versionId}: {ex.Message}");
            throw;
        }
    }
    
    /// <summary>
    /// Crée une nouvelle version pour un composant
    /// </summary>
    public async Task<int> CreateComponentVersionAsync(int componentId, ComponentVersionCreateViewModel model)
    {
        try
        {
            var component = await _context.Components
                .Include(c => c.Versions)
                .FirstOrDefaultAsync(c => c.ComponentId == componentId);
                
            if (component == null)
            {
                throw new ArgumentException($"Composant {componentId} non trouvé");
            }
            
            // Vérifier si la version existe déjà
            if (component.Versions.Any(v => v.Version == model.Version))
            {
                throw new InvalidOperationException($"La version {model.Version} existe déjà pour ce composant");
            }
            
            // Si la nouvelle version doit être définie comme la dernière, 
            // réinitialiser toutes les autres versions
            if (model.IsLatest)
            {
                foreach (var existingVersion in component.Versions)
                {
                    existingVersion.IsLatest = false;
                }
            }
            
            var newVersion = new ComponentVersion
            {
                ComponentId = componentId,
                Version = model.Version,  // This is correct - the server model uses "Version" property
                ReleaseDate = DateTime.UtcNow,
                ChangeLog = model.ChangeLog,
                MinPlatformVersion = model.MinPlatformVersion,
                PackageUrl = model.PackageUrl,
                IsLatest = model.IsLatest,
                PublishedDate = DateTime.UtcNow
            };
            
            // Log the version data for debugging purposes
            _logger.LogInformation($"Creating new version for component {componentId} with Version={model.Version}, versionNumber={model.Version}");
            
            _context.ComponentVersions.Add(newVersion);
            await _context.SaveChangesAsync();
            
            // Si c'est la dernière version, mettre à jour également le composant principal
            if (model.IsLatest)
            {
                component.Version = model.Version;
                component.MinPlatformVersion = model.MinPlatformVersion;
                component.UpdatedDate = DateTime.UtcNow;
                
                if (!string.IsNullOrEmpty(model.PackageUrl))
                {
                    component.PackageUrl = model.PackageUrl;
                }
                
                _context.Components.Update(component);
                await _context.SaveChangesAsync();
            }
            
            return newVersion.VersionId;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erreur lors de la création d'une nouvelle version pour le composant {componentId}: {ex.Message}");
            throw;
        }
    }
    
    /// <summary>
    /// Met à jour une version existante
    /// </summary>
    public async Task<bool> UpdateComponentVersionAsync(int versionId, ComponentVersionCreateViewModel model)
    {
        try
        {
            var version = await _context.ComponentVersions
                .Include(v => v.Component)
                .FirstOrDefaultAsync(v => v.VersionId == versionId);
                
            if (version == null)
            {
                return false;
            }
            
            // Vérifier si le nouveau numéro de version n'est pas déjà utilisé par une autre version
            if (model.Version != version.Version)
            {
                var existingVersion = await _context.ComponentVersions
                    .FirstOrDefaultAsync(v => v.ComponentId == version.ComponentId && 
                                         v.Version == model.Version &&
                                         v.VersionId != versionId);
                                         
                if (existingVersion != null)
                {
                    throw new InvalidOperationException($"La version {model.Version} existe déjà pour ce composant");
                }
            }
            
            // Si cette version doit devenir la dernière, réinitialiser les autres versions
            if (model.IsLatest && !version.IsLatest)
            {
                var otherVersions = await _context.ComponentVersions
                    .Where(v => v.ComponentId == version.ComponentId && v.VersionId != versionId)
                    .ToListAsync();
                    
                foreach (var otherVersion in otherVersions)
                {
                    otherVersion.IsLatest = false;
                    _context.ComponentVersions.Update(otherVersion);
                }
            }
            
            // Mettre à jour les propriétés de la version
            version.Version = model.Version;
            version.ChangeLog = model.ChangeLog;
            version.MinPlatformVersion = model.MinPlatformVersion;
            
            if (!string.IsNullOrEmpty(model.PackageUrl))
            {
                version.PackageUrl = model.PackageUrl;
            }
            
            version.IsLatest = model.IsLatest;
            
            _context.ComponentVersions.Update(version);
            await _context.SaveChangesAsync();
            
            // Si c'est la dernière version, mettre à jour également le composant principal
            if (model.IsLatest)
            {
                var component = version.Component;
                component.Version = model.Version;
                component.MinPlatformVersion = model.MinPlatformVersion;
                component.UpdatedDate = DateTime.UtcNow;
                
                if (!string.IsNullOrEmpty(model.PackageUrl))
                {
                    component.PackageUrl = model.PackageUrl;
                }
                
                _context.Components.Update(component);
                await _context.SaveChangesAsync();
            }
            
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erreur lors de la mise à jour de la version {versionId}: {ex.Message}");
            throw;
        }
    }
    
    /// <summary>
    /// Récupère les clients qui utilisent une version spécifique d'un composant
    /// </summary>
    public async Task<List<ClientInstallationViewModel>> GetClientsByComponentVersionAsync(int componentId, string version)
    {
        try
        {
            var installedComponents = await _context.InstalledComponents
                .Include(ic => ic.Installation)
                .Where(ic => ic.ComponentId == componentId && ic.Version == version && ic.IsActive)
                .ToListAsync();
                
            var result = new List<ClientInstallationViewModel>();
            
            foreach (var ic in installedComponents)
            {
                var clientInfo = new ClientInstallationViewModel
                {
                    InstallationId = ic.InstallationId,
                    ClientIdentifier = ic.Installation.ClientIdentifier,
                    ClientName = ic.Installation.ClientIdentifier, // Utiliser l'identifiant comme nom
                    PlatformVersion = ic.Installation.PlatformVersion ?? "Inconnue",
                    InstalledVersion = ic.Version,
                    InstallDate = ic.InstallDate,
                    LastUpdateDate = ic.LastUpdateDate ?? DateTime.UtcNow,
                    IsActive = true
                };
                
                // Vérifier si une mise à jour est disponible
                var component = await _context.Components
                    .Include(c => c.Versions)
                    .FirstOrDefaultAsync(c => c.ComponentId == componentId);
                    
                if (component != null)
                {
                    var latestVersion = component.Versions
                        .Where(v => v.IsLatest)
                        .Select(v => v.Version)
                        .FirstOrDefault() ?? component.Version;
                        
                    clientInfo.HasUpdateAvailable = _versionDetector.CompareVersions(latestVersion, ic.Version) > 0;
                }
                
                result.Add(clientInfo);
            }
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erreur lors de la récupération des clients utilisant la version {version} du composant {componentId}: {ex.Message}");
            throw;
        }
    }
    
    /// <summary>
    /// Définit une version comme étant la dernière version du composant
    /// </summary>
    public async Task<bool> SetLatestVersionAsync(int componentId, int versionId)
    {
        try
        {
            var component = await _context.Components
                .Include(c => c.Versions)
                .FirstOrDefaultAsync(c => c.ComponentId == componentId);
                
            if (component == null)
            {
                return false;
            }
            
            var newLatestVersion = component.Versions.FirstOrDefault(v => v.VersionId == versionId);
            if (newLatestVersion == null)
            {
                return false;
            }
            
            // Réinitialiser toutes les versions
            foreach (var version in component.Versions)
            {
                version.IsLatest = (version.VersionId == versionId);
                _context.ComponentVersions.Update(version);
            }
            
            // Mettre à jour le composant principal
            component.Version = newLatestVersion.Version;
            component.MinPlatformVersion = newLatestVersion.MinPlatformVersion ?? component.MinPlatformVersion;
            component.UpdatedDate = DateTime.UtcNow;
            
            if (!string.IsNullOrEmpty(newLatestVersion.PackageUrl))
            {
                component.PackageUrl = newLatestVersion.PackageUrl;
            }
            
            _context.Components.Update(component);
            await _context.SaveChangesAsync();
            
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erreur lors de la définition de la version {versionId} comme dernière version du composant {componentId}: {ex.Message}");
            throw;
        }

        /// <summary>\n        /// Supprime une version spécifique d'un composant\n        /// </summary>\n        /// <param name="componentId">ID du composant</param>\n        /// <param name="versionId">ID de la version à supprimer</param>\n        /// <returns>True si la suppression a réussi, sinon False</returns>\n        public async Task<bool> DeleteComponentVersionAsync(int componentId, int versionId)\n        {\n            try\n            {\n                _logger.LogInformation($"Suppression de la version {versionId} pour le composant {componentId}");\n                \n                // Récupérer le composant avec ses versions\n                var component = await _context.Components\n                    .Include(c => c.Versions)\n                    .FirstOrDefaultAsync(c => c.ComponentId == componentId);\n                    \n                if (component == null)\n                {\n                    _logger.LogWarning($"Tentative de suppression d'une version pour un composant inexistant: {componentId}");\n                    return false;\n                }\n                \n                // Récupérer la version à supprimer\n                var version = component.Versions.FirstOrDefault(v => v.VersionId == versionId);\n                if (version == null)\n                {\n                    _logger.LogWarning($"Tentative de suppression d'une version inexistante: {versionId} pour le composant {componentId}");\n                    return false;\n                }\n                \n                // Vérifier si c'est la seule version ou la version actuelle du composant\n                if (component.Versions.Count == 1)\n                {\n                    _logger.LogWarning($"Impossible de supprimer la seule version d'un composant: {componentId}");\n                    throw new InvalidOperationException("Impossible de supprimer la seule version d'un composant");\n                }\n                \n                // Vérifier si c'est la version actuelle/latest\n                if (version.IsLatest)\n                {\n                    _logger.LogWarning($"Impossible de supprimer la version actuelle d'un composant: {versionId} pour le composant {componentId}");\n                    throw new InvalidOperationException("Impossible de supprimer la version actuelle d'un composant. Veuillez définir une autre version comme actuelle avant de supprimer celle-ci.");\n                }\n                \n                // Vérifier si cette version est installée chez des clients\n                var clientsUsingVersion = await _context.InstalledComponents\n                    .Include(ic => ic.Installation)\n                    .Where(ic => ic.ComponentId == componentId && ic.Version == version.Version && ic.IsActive)\n                    .ToListAsync();\n                    \n                if (clientsUsingVersion.Any())\n                {\n                    var clientsList = string.Join(", ", clientsUsingVersion.Select(ic => ic.Installation.ClientIdentifier));\n                    _logger.LogWarning($"Impossible de supprimer une version utilisée par des clients: {version.Version} pour le composant {componentId}. Clients: {clientsList}");\n                    throw new InvalidOperationException(\n                        $"Impossible de supprimer cette version car elle est actuellement utilisée par {clientsUsingVersion.Count} client(s): {clientsList}");\n                }\n                \n                // Supprimer les téléchargements associés à cette version\n                var downloads = await _context.ComponentDownloads\n                    .Where(cd => cd.ComponentId == componentId && cd.Version == version.Version)\n                    .ToListAsync();\n                    \n                _context.ComponentDownloads.RemoveRange(downloads);\n                \n                // Supprimer la version\n                _context.ComponentVersions.Remove(version);\n                await _context.SaveChangesAsync();\n                \n                _logger.LogInformation($"Version {versionId} ({version.Version}) du composant {componentId} supprimée avec succès");\n                return true;\n            }\n            catch (Exception ex)\n            {\n                _logger.LogError(ex, $"Erreur lors de la suppression de la version {versionId} du composant {componentId}: {ex.Message}");\n                throw;\n            }\n        }
    }
}
}