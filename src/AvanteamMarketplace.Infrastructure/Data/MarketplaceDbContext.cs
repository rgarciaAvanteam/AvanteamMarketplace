using Microsoft.EntityFrameworkCore;
using AvanteamMarketplace.Core.Models;

namespace AvanteamMarketplace.Infrastructure.Data
{
    /// <summary>
    /// Contexte de base de données pour le marketplace
    /// </summary>
    public class MarketplaceDbContext : DbContext
    {
        public MarketplaceDbContext(DbContextOptions<MarketplaceDbContext> options) : base(options)
        {
        }
        
        public DbSet<Component> Components { get; set; } = null!;
        public DbSet<ComponentTag> ComponentTags { get; set; } = null!;
        public DbSet<ComponentDependency> ComponentDependencies { get; set; } = null!;
        public DbSet<ComponentVersion> ComponentVersions { get; set; } = null!;
        public DbSet<ClientInstallation> ClientInstallations { get; set; } = null!;
        public DbSet<InstalledComponent> InstalledComponents { get; set; } = null!;
        public DbSet<ComponentDownload> ComponentDownloads { get; set; } = null!;
        public DbSet<ApiKey> ApiKeys { get; set; } = null!;
        
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            
            // Configuration du modèle de données
            modelBuilder.Entity<Component>(entity =>
            {
                entity.HasKey(e => e.ComponentId);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(50);
                entity.Property(e => e.DisplayName).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Description).IsRequired().HasMaxLength(500);
                entity.Property(e => e.Version).IsRequired().HasMaxLength(20);
                entity.Property(e => e.Category).HasMaxLength(50);
                entity.Property(e => e.Author).HasMaxLength(100);
                entity.Property(e => e.MinPlatformVersion).HasMaxLength(20);
                entity.Property(e => e.RecommendedPlatformVersion).HasMaxLength(20);
                entity.Property(e => e.RepositoryUrl).HasMaxLength(255);
                entity.Property(e => e.TargetPath).HasMaxLength(255);
                entity.Property(e => e.PackageUrl).HasMaxLength(255);
                
                // Index pour recherche par nom
                entity.HasIndex(e => e.Name).IsUnique();
            });
            
            modelBuilder.Entity<ComponentTag>(entity =>
            {
                entity.HasKey(e => new { e.ComponentId, e.Tag });
                entity.Property(e => e.Tag).IsRequired().HasMaxLength(50);
                
                entity.HasOne(d => d.Component)
                    .WithMany(p => p.Tags)
                    .HasForeignKey(d => d.ComponentId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
            
            modelBuilder.Entity<ComponentDependency>(entity =>
            {
                entity.HasKey(e => new { e.ComponentId, e.DependsOnComponentId });
                entity.Property(e => e.MinVersion).HasMaxLength(20);
                
                entity.HasOne(d => d.Component)
                    .WithMany(p => p.Dependencies)
                    .HasForeignKey(d => d.ComponentId)
                    .OnDelete(DeleteBehavior.Cascade);
                    
                entity.HasOne(d => d.DependsOnComponent)
                    .WithMany()
                    .HasForeignKey(d => d.DependsOnComponentId)
                    .OnDelete(DeleteBehavior.Restrict);
            });
            
            modelBuilder.Entity<ComponentVersion>(entity =>
            {
                entity.HasKey(e => e.VersionId);
                entity.Property(e => e.Version).IsRequired().HasMaxLength(20);
                entity.Property(e => e.MinPlatformVersion).HasMaxLength(20);
                entity.Property(e => e.PackageUrl).HasMaxLength(255);
                
                entity.HasOne(d => d.Component)
                    .WithMany(p => p.Versions)
                    .HasForeignKey(d => d.ComponentId)
                    .OnDelete(DeleteBehavior.Cascade);
                    
                // Index pour recherche par version
                entity.HasIndex(e => new { e.ComponentId, e.Version }).IsUnique();
            });
            
            modelBuilder.Entity<ClientInstallation>(entity =>
            {
                entity.HasKey(e => e.InstallationId);
                entity.Property(e => e.ClientIdentifier).IsRequired().HasMaxLength(100);
                entity.Property(e => e.PlatformVersion).HasMaxLength(20);
                
                // Index pour recherche par identifiant client
                entity.HasIndex(e => e.ClientIdentifier).IsUnique();
            });
            
            modelBuilder.Entity<InstalledComponent>(entity =>
            {
                entity.HasKey(e => new { e.InstallationId, e.ComponentId });
                entity.Property(e => e.Version).IsRequired().HasMaxLength(20);
                
                entity.HasOne(d => d.Installation)
                    .WithMany(p => p.InstalledComponents)
                    .HasForeignKey(d => d.InstallationId)
                    .OnDelete(DeleteBehavior.Cascade);
                    
                entity.HasOne(d => d.Component)
                    .WithMany(p => p.Installations)
                    .HasForeignKey(d => d.ComponentId)
                    .OnDelete(DeleteBehavior.Restrict);
            });
            
            modelBuilder.Entity<ComponentDownload>(entity =>
            {
                entity.HasKey(e => e.DownloadId);
                entity.Property(e => e.ClientIdentifier).HasMaxLength(100);
                entity.Property(e => e.Version).IsRequired().HasMaxLength(20);
                
                entity.HasOne(d => d.Component)
                    .WithMany()
                    .HasForeignKey(d => d.ComponentId)
                    .OnDelete(DeleteBehavior.Cascade);
                    
                // Index pour les statistiques
                entity.HasIndex(e => e.ComponentId);
                entity.HasIndex(e => e.ClientIdentifier);
            });
            
            modelBuilder.Entity<ApiKey>(entity =>
            {
                entity.HasKey(e => e.ApiKeyId);
                entity.Property(e => e.Key).IsRequired().HasMaxLength(50);
                entity.Property(e => e.ClientId).HasMaxLength(100);
                
                // Index pour validation de clé
                entity.HasIndex(e => e.Key).IsUnique();
            });
        }
    }
}