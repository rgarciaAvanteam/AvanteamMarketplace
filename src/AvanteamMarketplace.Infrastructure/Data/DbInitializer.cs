using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using AvanteamMarketplace.Core.Models;

namespace AvanteamMarketplace.Infrastructure.Data
{
    /// <summary>
    /// Initialise la base de données avec des données de base
    /// </summary>
    public static class DbInitializer
    {
        public static void Initialize(MarketplaceDbContext context)
        {
            // S'assurer que la base de données existe
            context.Database.EnsureCreated();
            
            // Si des composants existent déjà, cela signifie que la base a déjà été initialisée
            if (context.Components.Any())
            {
                return;
            }
            
            // Créer une clé API d'administration par défaut
            CreateDefaultAdminApiKey(context);
            
            // Créer quelques composants d'exemple
            CreateSampleComponents(context);
            
            // Sauvegarder les changements
            context.SaveChanges();
        }
        
        private static void CreateDefaultAdminApiKey(MarketplaceDbContext context)
        {
            // Générer une clé admin par défaut
            using (var sha = SHA256.Create())
            {
                byte[] hashBytes = sha.ComputeHash(Encoding.UTF8.GetBytes("AvanteamMarketplaceAdminKey"));
                
                var apiKey = new ApiKey
                {
                    Key = Convert.ToBase64String(hashBytes)
                        .Replace('+', '-')
                        .Replace('/', '_')
                        .Replace("=", "")
                        .Substring(0, 32),
                    ClientId = "admin",
                    IsAdmin = true,
                    IsActive = true,
                    CreatedDate = DateTime.UtcNow
                };
                
                context.ApiKeys.Add(apiKey);
                
                Console.WriteLine($"Clé API admin créée: {apiKey.Key}");
            }
        }
        
        private static void CreateSampleComponents(MarketplaceDbContext context)
        {
            // Composant 1: Workflow Designer
            var component1 = new Component
            {
                Name = "workflow-designer",
                DisplayName = "Workflow Designer",
                Description = "Éditeur graphique de workflows BPMN pour Process Studio",
                Version = "1.2.0",
                Category = "Design",
                Author = "Avanteam",
                MinPlatformVersion = "23.0",
                RepositoryUrl = "https://github.com/avanteam/workflow-designer",
                RequiresRestart = false,
                TargetPath = "Components/workflow-designer",
                PackageUrl = "https://github.com/avanteam/workflow-designer/releases/download/v1.2.0/workflow-designer-1.2.0.zip",
                ReadmeContent = "# Workflow Designer\r\n\r\nÉditeur graphique de workflows BPMN pour Process Studio.\r\n\r\n## Fonctionnalités\r\n\r\n- Création de workflows basés sur le standard BPMN 2.0\r\n- Support des tâches, passerelles, événements et sous-processus\r\n- Export/Import au format BPMN XML\r\n- Intégration avec les formulaires Process Studio\r\n\r\n## Installation\r\n\r\nInstallation automatique via le marketplace Process Studio.",
                CreatedDate = DateTime.UtcNow.AddMonths(-3),
                UpdatedDate = DateTime.UtcNow.AddDays(-15)
            };
            
            // Tags
            component1.Tags.Add(new ComponentTag { Component = component1, Tag = "workflow" });
            component1.Tags.Add(new ComponentTag { Component = component1, Tag = "bpmn" });
            component1.Tags.Add(new ComponentTag { Component = component1, Tag = "design" });
            
            // Versions précédentes
            component1.Versions.Add(new ComponentVersion
            {
                Component = component1,
                Version = "1.0.0",
                ReleaseNotes = "Version initiale",
                MinPlatformVersion = "23.0",
                PackageUrl = "https://github.com/avanteam/workflow-designer/releases/download/v1.0.0/workflow-designer-1.0.0.zip",
                PublishedDate = DateTime.UtcNow.AddMonths(-3)
            });
            
            component1.Versions.Add(new ComponentVersion
            {
                Component = component1,
                Version = "1.1.0",
                ReleaseNotes = "Ajout du support des sous-processus",
                MinPlatformVersion = "23.0",
                PackageUrl = "https://github.com/avanteam/workflow-designer/releases/download/v1.1.0/workflow-designer-1.1.0.zip",
                PublishedDate = DateTime.UtcNow.AddMonths(-2)
            });
            
            context.Components.Add(component1);
            
            // Composant 2: Document AI
            var component2 = new Component
            {
                Name = "doc-ai",
                DisplayName = "Document AI",
                Description = "Extraction automatique de données depuis des documents avec IA",
                Version = "0.9.5",
                Category = "IA",
                Author = "Avanteam Labs",
                MinPlatformVersion = "22.0",
                RepositoryUrl = "https://github.com/avanteam/doc-ai",
                RequiresRestart = true,
                TargetPath = "Components/doc-ai",
                PackageUrl = "https://github.com/avanteam/doc-ai/releases/download/v0.9.5/doc-ai-0.9.5.zip",
                ReadmeContent = "# Document AI\r\n\r\nExtraction automatique de données depuis des documents avec IA.\r\n\r\n## Fonctionnalités\r\n\r\n- Reconnaissance de texte (OCR)\r\n- Extraction de champs structurés (factures, formulaires)\r\n- Classification de documents\r\n- Intégration avec le workflow Process Studio\r\n\r\n## Prérequis\r\n\r\n- Process Studio 22.0 ou supérieur\r\n- Minimum 4GB de RAM\r\n\r\n## Installation\r\n\r\nInstallation automatique via le marketplace Process Studio.",
                CreatedDate = DateTime.UtcNow.AddMonths(-2),
                UpdatedDate = DateTime.UtcNow.AddDays(-7)
            };
            
            // Tags
            component2.Tags.Add(new ComponentTag { Component = component2, Tag = "ia" });
            component2.Tags.Add(new ComponentTag { Component = component2, Tag = "document" });
            component2.Tags.Add(new ComponentTag { Component = component2, Tag = "ocr" });
            
            context.Components.Add(component2);
            
            // Composant 3: Advanced Reporting
            var component3 = new Component
            {
                Name = "advanced-reporting",
                DisplayName = "Advanced Reporting",
                Description = "Rapports personnalisés et tableaux de bord analytiques",
                Version = "2.1.0",
                Category = "Reporting",
                Author = "Avanteam",
                MinPlatformVersion = "23.5",
                RepositoryUrl = "https://github.com/avanteam/advanced-reporting",
                RequiresRestart = false,
                TargetPath = "Components/reporting",
                PackageUrl = "https://github.com/avanteam/advanced-reporting/releases/download/v2.1.0/advanced-reporting-2.1.0.zip",
                ReadmeContent = "# Advanced Reporting\r\n\r\nRapports personnalisés et tableaux de bord analytiques pour Process Studio.\r\n\r\n## Fonctionnalités\r\n\r\n- Création de rapports personnalisés\r\n- Tableaux de bord interactifs\r\n- Export aux formats PDF, Excel, CSV\r\n- Programmation de rapports récurrents\r\n\r\n## Prérequis\r\n\r\n- Process Studio 23.5 ou supérieur\r\n\r\n## Installation\r\n\r\nInstallation automatique via le marketplace Process Studio.",
                CreatedDate = DateTime.UtcNow.AddMonths(-1),
                UpdatedDate = DateTime.UtcNow.AddDays(-1)
            };
            
            // Tags
            component3.Tags.Add(new ComponentTag { Component = component3, Tag = "reporting" });
            component3.Tags.Add(new ComponentTag { Component = component3, Tag = "dashboard" });
            component3.Tags.Add(new ComponentTag { Component = component3, Tag = "analyse" });
            
            context.Components.Add(component3);
            
            // Composant 4: Mobile Companion
            var component4 = new Component
            {
                Name = "mobile-companion",
                DisplayName = "Mobile Companion",
                Description = "Application mobile pour accéder à Process Studio en déplacement",
                Version = "3.2.1",
                Category = "Mobile",
                Author = "Avanteam",
                MinPlatformVersion = "22.0",
                RepositoryUrl = "https://github.com/avanteam/mobile-companion",
                RequiresRestart = false,
                TargetPath = "Components/mobile",
                PackageUrl = "https://github.com/avanteam/mobile-companion/releases/download/v3.2.1/mobile-companion-3.2.1.zip",
                ReadmeContent = "# Mobile Companion\r\n\r\nApplication mobile pour accéder à Process Studio en déplacement.\r\n\r\n## Fonctionnalités\r\n\r\n- Accès aux tâches et workflows\r\n- Consultation des documents\r\n- Formulaires adaptatifs\r\n- Notifications push\r\n\r\n## Prérequis\r\n\r\n- Process Studio 22.0 ou supérieur\r\n- Configuration du serveur pour l'accès externe\r\n\r\n## Installation\r\n\r\nInstallation automatique via le marketplace Process Studio.",
                CreatedDate = DateTime.UtcNow.AddMonths(-6),
                UpdatedDate = DateTime.UtcNow.AddDays(-21)
            };
            
            // Tags
            component4.Tags.Add(new ComponentTag { Component = component4, Tag = "mobile" });
            component4.Tags.Add(new ComponentTag { Component = component4, Tag = "app" });
            component4.Tags.Add(new ComponentTag { Component = component4, Tag = "smartphone" });
            
            // Versions précédentes
            component4.Versions.Add(new ComponentVersion
            {
                Component = component4,
                Version = "3.0.0",
                ReleaseNotes = "Refonte complète de l'interface",
                MinPlatformVersion = "22.0",
                PackageUrl = "https://github.com/avanteam/mobile-companion/releases/download/v3.0.0/mobile-companion-3.0.0.zip",
                PublishedDate = DateTime.UtcNow.AddMonths(-6)
            });
            
            component4.Versions.Add(new ComponentVersion
            {
                Component = component4,
                Version = "3.1.0",
                ReleaseNotes = "Ajout des notifications push",
                MinPlatformVersion = "22.0",
                PackageUrl = "https://github.com/avanteam/mobile-companion/releases/download/v3.1.0/mobile-companion-3.1.0.zip",
                PublishedDate = DateTime.UtcNow.AddMonths(-3)
            });
            
            context.Components.Add(component4);
            
            // Composant 5: Digital Signature (futur)
            var component5 = new Component
            {
                Name = "digital-signature",
                DisplayName = "Digital Signature",
                Description = "Signature électronique de documents conforme eIDAS",
                Version = "1.0.0-beta",
                Category = "Sécurité",
                Author = "Avanteam",
                MinPlatformVersion = "24.0",
                RepositoryUrl = "https://github.com/avanteam/digital-signature",
                RequiresRestart = true,
                TargetPath = "Components/signature",
                PackageUrl = "https://github.com/avanteam/digital-signature/releases/download/v1.0.0-beta/digital-signature-1.0.0-beta.zip",
                ReadmeContent = "# Digital Signature\r\n\r\nSignature électronique de documents conforme eIDAS.\r\n\r\n## Fonctionnalités\r\n\r\n- Signature électronique qualifiée\r\n- Conformité eIDAS\r\n- Intégration avec les principaux fournisseurs de certificats\r\n- Workflow de signature multi-parties\r\n\r\n## Prérequis\r\n\r\n- Process Studio 24.0 ou supérieur\r\n\r\n## Installation\r\n\r\nInstallation automatique via le marketplace Process Studio.",
                CreatedDate = DateTime.UtcNow.AddDays(-10),
                UpdatedDate = DateTime.UtcNow.AddDays(-10)
            };
            
            // Tags
            component5.Tags.Add(new ComponentTag { Component = component5, Tag = "signature" });
            component5.Tags.Add(new ComponentTag { Component = component5, Tag = "sécurité" });
            component5.Tags.Add(new ComponentTag { Component = component5, Tag = "document" });
            
            context.Components.Add(component5);
        }
    }
}