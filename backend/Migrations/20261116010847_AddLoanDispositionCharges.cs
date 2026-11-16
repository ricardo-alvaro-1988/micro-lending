using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroLending.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLoanDispositionCharges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "InsurancePortion",
                table: "LoanScheduleItems",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SavingsPortion",
                table: "LoanScheduleItems",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "InitialSavings",
                table: "Loans",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "InsuranceAmount",
                table: "Loans",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "InsurancePerPeriod",
                table: "Loans",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "LoanRedemptionFee",
                table: "Loans",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "MembershipFee",
                table: "Loans",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "NetProceeds",
                table: "Loans",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "NotarialFee",
                table: "Loans",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ProcessingFee",
                table: "Loans",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Raffle",
                table: "Loans",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SavingsPerPeriod",
                table: "Loans",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Taxes",
                table: "Loans",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalDeductions",
                table: "Loans",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "InitialSavings",
                table: "LoanProducts",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "InsuranceAmount",
                table: "LoanProducts",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "InsurancePerPeriod",
                table: "LoanProducts",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "LoanRedemptionFee",
                table: "LoanProducts",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "MembershipFee",
                table: "LoanProducts",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "NotarialFee",
                table: "LoanProducts",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ProcessingFee",
                table: "LoanProducts",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Raffle",
                table: "LoanProducts",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SavingsPerPeriod",
                table: "LoanProducts",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Taxes",
                table: "LoanProducts",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InsurancePortion",
                table: "LoanScheduleItems");

            migrationBuilder.DropColumn(
                name: "SavingsPortion",
                table: "LoanScheduleItems");

            migrationBuilder.DropColumn(
                name: "InitialSavings",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "InsuranceAmount",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "InsurancePerPeriod",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "LoanRedemptionFee",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "MembershipFee",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "NetProceeds",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "NotarialFee",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "ProcessingFee",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "Raffle",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "SavingsPerPeriod",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "Taxes",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "TotalDeductions",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "InitialSavings",
                table: "LoanProducts");

            migrationBuilder.DropColumn(
                name: "InsuranceAmount",
                table: "LoanProducts");

            migrationBuilder.DropColumn(
                name: "InsurancePerPeriod",
                table: "LoanProducts");

            migrationBuilder.DropColumn(
                name: "LoanRedemptionFee",
                table: "LoanProducts");

            migrationBuilder.DropColumn(
                name: "MembershipFee",
                table: "LoanProducts");

            migrationBuilder.DropColumn(
                name: "NotarialFee",
                table: "LoanProducts");

            migrationBuilder.DropColumn(
                name: "ProcessingFee",
                table: "LoanProducts");

            migrationBuilder.DropColumn(
                name: "Raffle",
                table: "LoanProducts");

            migrationBuilder.DropColumn(
                name: "SavingsPerPeriod",
                table: "LoanProducts");

            migrationBuilder.DropColumn(
                name: "Taxes",
                table: "LoanProducts");
        }
    }
}
