using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroLending.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStageRouting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "OnApproveStageId",
                table: "ProcessStages",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OnDeclineStageId",
                table: "ProcessStages",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProcessStages_OnApproveStageId",
                table: "ProcessStages",
                column: "OnApproveStageId");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessStages_OnDeclineStageId",
                table: "ProcessStages",
                column: "OnDeclineStageId");

            migrationBuilder.AddForeignKey(
                name: "FK_ProcessStages_ProcessStages_OnApproveStageId",
                table: "ProcessStages",
                column: "OnApproveStageId",
                principalTable: "ProcessStages",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ProcessStages_ProcessStages_OnDeclineStageId",
                table: "ProcessStages",
                column: "OnDeclineStageId",
                principalTable: "ProcessStages",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProcessStages_ProcessStages_OnApproveStageId",
                table: "ProcessStages");

            migrationBuilder.DropForeignKey(
                name: "FK_ProcessStages_ProcessStages_OnDeclineStageId",
                table: "ProcessStages");

            migrationBuilder.DropIndex(
                name: "IX_ProcessStages_OnApproveStageId",
                table: "ProcessStages");

            migrationBuilder.DropIndex(
                name: "IX_ProcessStages_OnDeclineStageId",
                table: "ProcessStages");

            migrationBuilder.DropColumn(
                name: "OnApproveStageId",
                table: "ProcessStages");

            migrationBuilder.DropColumn(
                name: "OnDeclineStageId",
                table: "ProcessStages");
        }
    }
}
