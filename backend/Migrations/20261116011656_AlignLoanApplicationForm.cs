using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroLending.Api.Migrations
{
    /// <inheritdoc />
    public partial class AlignLoanApplicationForm : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ApplicationType",
                table: "Loans",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ApprovedAmount",
                table: "Loans",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Cycle",
                table: "Loans",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LoanType",
                table: "Loans",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AuthorizationRemarks",
                table: "Customers",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CivilStatus",
                table: "Customers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmployerContactNumber",
                table: "Customers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmployerOrBusinessAddress",
                table: "Customers",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmployerOrBusinessName",
                table: "Customers",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IncomeVia",
                table: "Customers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NameExtension",
                table: "Customers",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "NetIncomePerMonth",
                table: "Customers",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OccupationOrPosition",
                table: "Customers",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PlaceOfBirth",
                table: "Customers",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PresentHousingStatus",
                table: "Customers",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreviousBarangay",
                table: "Customers",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreviousCity",
                table: "Customers",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreviousHouseUnit",
                table: "Customers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreviousHousingStatus",
                table: "Customers",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreviousProvince",
                table: "Customers",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreviousStreet",
                table: "Customers",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Sex",
                table: "Customers",
                type: "nvarchar(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SpouseName",
                table: "Customers",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "YearsAtPresentAddress",
                table: "Customers",
                type: "decimal(6,2)",
                precision: 6,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "YearsAtPreviousAddress",
                table: "Customers",
                type: "decimal(6,2)",
                precision: 6,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LoanCollaterals",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LoanId = table.Column<int>(type: "int", nullable: false),
                    DescriptionOrKind = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Brand = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    EstimatedMarketValue = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanCollaterals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LoanCollaterals_Loans_LoanId",
                        column: x => x.LoanId,
                        principalTable: "Loans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LoanCollaterals_LoanId",
                table: "LoanCollaterals",
                column: "LoanId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LoanCollaterals");

            migrationBuilder.DropColumn(
                name: "ApplicationType",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "ApprovedAmount",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "Cycle",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "LoanType",
                table: "Loans");

            migrationBuilder.DropColumn(
                name: "AuthorizationRemarks",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "CivilStatus",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "EmployerContactNumber",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "EmployerOrBusinessAddress",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "EmployerOrBusinessName",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "IncomeVia",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "NameExtension",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "NetIncomePerMonth",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "OccupationOrPosition",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PlaceOfBirth",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PresentHousingStatus",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PreviousBarangay",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PreviousCity",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PreviousHouseUnit",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PreviousHousingStatus",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PreviousProvince",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PreviousStreet",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "Sex",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "SpouseName",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "YearsAtPresentAddress",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "YearsAtPreviousAddress",
                table: "Customers");
        }
    }
}
