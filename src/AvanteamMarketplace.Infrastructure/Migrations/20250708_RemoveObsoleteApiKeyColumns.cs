using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AvanteamMarketplace.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveObsoleteApiKeyColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Supprimer les colonnes obsolètes qui ne sont plus utilisées
            // La nouvelle logique utilise uniquement AccessLevel
            
            migrationBuilder.DropColumn(
                name: "IsAdmin",
                table: "ApiKeys");
                
            migrationBuilder.DropColumn(
                name: "CanAccessAdminInterface", 
                table: "ApiKeys");
                
            migrationBuilder.DropColumn(
                name: "CanReadAdminInterface",
                table: "ApiKeys");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Recréer les colonnes pour la rétrocompatibilité si nécessaire
            
            migrationBuilder.AddColumn<bool>(
                name: "IsAdmin",
                table: "ApiKeys",
                type: "bit",
                nullable: false,
                defaultValue: false);
                
            migrationBuilder.AddColumn<bool>(
                name: "CanAccessAdminInterface",
                table: "ApiKeys", 
                type: "bit",
                nullable: false,
                defaultValue: false);
                
            migrationBuilder.AddColumn<bool>(
                name: "CanReadAdminInterface",
                table: "ApiKeys",
                type: "bit", 
                nullable: false,
                defaultValue: false);
                
            // Recalculer les valeurs basées sur AccessLevel
            migrationBuilder.Sql(@"
                UPDATE ApiKeys 
                SET IsAdmin = CASE WHEN AccessLevel = 1 THEN 1 ELSE 0 END,
                    CanAccessAdminInterface = CASE WHEN AccessLevel IN (1, 2) THEN 1 ELSE 0 END,
                    CanReadAdminInterface = CASE WHEN AccessLevel = 2 THEN 1 ELSE 0 END
            ");
        }
    }
}