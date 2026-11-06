using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroLending.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerCollectionAgents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Agent1UserId",
                table: "Customers",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Agent2UserId",
                table: "Customers",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Agent3UserId",
                table: "Customers",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Customers_Agent1UserId",
                table: "Customers",
                column: "Agent1UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_Agent2UserId",
                table: "Customers",
                column: "Agent2UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_Agent3UserId",
                table: "Customers",
                column: "Agent3UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Customers_AspNetUsers_Agent1UserId",
                table: "Customers",
                column: "Agent1UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Customers_AspNetUsers_Agent2UserId",
                table: "Customers",
                column: "Agent2UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Customers_AspNetUsers_Agent3UserId",
                table: "Customers",
                column: "Agent3UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Customers_AspNetUsers_Agent1UserId",
                table: "Customers");

            migrationBuilder.DropForeignKey(
                name: "FK_Customers_AspNetUsers_Agent2UserId",
                table: "Customers");

            migrationBuilder.DropForeignKey(
                name: "FK_Customers_AspNetUsers_Agent3UserId",
                table: "Customers");

            migrationBuilder.DropIndex(
                name: "IX_Customers_Agent1UserId",
                table: "Customers");

            migrationBuilder.DropIndex(
                name: "IX_Customers_Agent2UserId",
                table: "Customers");

            migrationBuilder.DropIndex(
                name: "IX_Customers_Agent3UserId",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "Agent1UserId",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "Agent2UserId",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "Agent3UserId",
                table: "Customers");
        }
    }
}
