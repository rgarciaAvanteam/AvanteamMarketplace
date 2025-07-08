using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AvanteamMarketplace.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAccessLevelToApiKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Ajouter la nouvelle colonne AccessLevel
            migrationBuilder.AddColumn<int>(
                name: "AccessLevel",
                table: "ApiKeys",
                type: "int",
                nullable: false,
                defaultValue: 0); // ApplicationWeb par défaut

            // Migrer les données existantes selon la logique suivante :
            // IsAdmin = true -> AccessLevel = 1 (UtilisateurAdmin)
            // CanAccessAdminInterface = true ET CanReadAdminInterface = true -> AccessLevel = 2 (UtilisateurLecture)
            // CanAccessAdminInterface = true ET CanReadAdminInterface = false -> AccessLevel = 1 (UtilisateurAdmin)
            // Sinon -> AccessLevel = 0 (ApplicationWeb)
            
            migrationBuilder.Sql(@"
                UPDATE ApiKeys 
                SET AccessLevel = CASE 
                    WHEN IsAdmin = 1 THEN 1
                    WHEN CanAccessAdminInterface = 1 AND CanReadAdminInterface = 1 THEN 2
                    WHEN CanAccessAdminInterface = 1 AND CanReadAdminInterface = 0 THEN 1
                    ELSE 0
                END");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AccessLevel",
                table: "ApiKeys");
        }
    }
}