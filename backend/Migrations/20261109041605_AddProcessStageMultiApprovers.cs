using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroLending.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProcessStageMultiApprovers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProcessStageApproverRoles",
                columns: table => new
                {
                    StageId = table.Column<int>(type: "int", nullable: false),
                    RoleId = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProcessStageApproverRoles", x => new { x.StageId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_ProcessStageApproverRoles_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProcessStageApproverRoles_ProcessStages_StageId",
                        column: x => x.StageId,
                        principalTable: "ProcessStages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProcessStageApproverUsers",
                columns: table => new
                {
                    StageId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProcessStageApproverUsers", x => new { x.StageId, x.UserId });
                    table.ForeignKey(
                        name: "FK_ProcessStageApproverUsers_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProcessStageApproverUsers_ProcessStages_StageId",
                        column: x => x.StageId,
                        principalTable: "ProcessStages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProcessStageApproverRoles_RoleId",
                table: "ProcessStageApproverRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessStageApproverUsers_UserId",
                table: "ProcessStageApproverUsers",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProcessStageApproverRoles");

            migrationBuilder.DropTable(
                name: "ProcessStageApproverUsers");
        }
    }
}
