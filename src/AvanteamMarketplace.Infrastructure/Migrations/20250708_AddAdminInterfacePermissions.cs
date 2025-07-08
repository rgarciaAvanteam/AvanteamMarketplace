using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AvanteamMarketplace.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminInterfacePermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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

            // Mettre à jour les clés existantes qui sont admin pour qu'elles puissent accéder à l'interface admin
            migrationBuilder.Sql(@"
                UPDATE ApiKeys 
                SET CanAccessAdminInterface = 1, CanReadAdminInterface = 1 
                WHERE IsAdmin = 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CanAccessAdminInterface",
                table: "ApiKeys");

            migrationBuilder.DropColumn(
                name: "CanReadAdminInterface",
                table: "ApiKeys");
        }
    }
}