using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroLending.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSavingsLedgerAndUnderpaid : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ExtraSavingsBalance",
                table: "Loans",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "PrimarySavingsBalance",
                table: "Loans",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "SavingsTransactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CustomerId = table.Column<int>(type: "int", nullable: false),
                    LoanId = table.Column<int>(type: "int", nullable: false),
                    Kind = table.Column<int>(type: "int", nullable: false),
                    Type = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    BalanceAfter = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LoanPaymentId = table.Column<int>(type: "int", nullable: true),
                    ScheduleItemId = table.Column<int>(type: "int", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RecordedByUserId = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavingsTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SavingsTransactions_AspNetUsers_RecordedByUserId",
                        column: x => x.RecordedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SavingsTransactions_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SavingsTransactions_LoanPayments_LoanPaymentId",
                        column: x => x.LoanPaymentId,
                        principalTable: "LoanPayments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SavingsTransactions_LoanScheduleItems_ScheduleItemId",
                        column: x => x.ScheduleItemId,
                        principalTable: "LoanScheduleItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SavingsTransactions_Loans_LoanId",
                        column: x => x.LoanId,
                        principalTable: "Loans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SavingsTransactions_CustomerId_Kind_OccurredAt",
                table: "SavingsTransactions",
                columns: new[] { "CustomerId", "Kind", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SavingsTransactions_LoanId_Kind_OccurredAt",
                table: "SavingsTransactions",
                columns: new[] { "LoanId", "Kind", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SavingsTransactions_LoanPaymentId",
                table: "SavingsTransactions",
                column: "LoanPaymentId");

            migrationBuilder.CreateIndex(
                name: "IX_SavingsTransactions_RecordedByUserId",
                table: "SavingsTransactions",
                column: "RecordedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_SavingsTransactions_ScheduleItemId",
                table: "SavingsTransactions",
                column: "ScheduleItemId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SavingsTransactions");

            migrationBuilder.DropColumn(
                name: "ExtraSavingsBalance",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "PrimarySavingsBalance",
                table: "Loans");
        }
    }
}
