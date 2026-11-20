using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroLending.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCashflowFundInjections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CashflowFundInjections",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InjectionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    BranchId = table.Column<int>(type: "int", nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RecordedByUserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashflowFundInjections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CashflowFundInjections_AspNetUsers_RecordedByUserId",
                        column: x => x.RecordedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CashflowFundInjections_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CashflowFundInjections_BranchId",
                table: "CashflowFundInjections",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_CashflowFundInjections_InjectionDate_BranchId",
                table: "CashflowFundInjections",
                columns: new[] { "InjectionDate", "BranchId" });

            migrationBuilder.CreateIndex(
                name: "IX_CashflowFundInjections_RecordedByUserId",
                table: "CashflowFundInjections",
                column: "RecordedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CashflowFundInjections");
        }
    }
}
