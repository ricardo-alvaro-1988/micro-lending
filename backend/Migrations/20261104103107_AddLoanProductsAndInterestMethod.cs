using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroLending.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLoanProductsAndInterestMethod : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH(N'dbo.Loans', N'InterestMethod') IS NULL
    ALTER TABLE [Loans] ADD [InterestMethod] int NOT NULL CONSTRAINT [DF_Loans_InterestMethod] DEFAULT 0;
");

            migrationBuilder.Sql(@"
IF COL_LENGTH(N'dbo.Loans', N'LoanProductId') IS NULL
    ALTER TABLE [Loans] ADD [LoanProductId] int NULL;
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'dbo.LoanProducts', N'U') IS NULL
BEGIN
    CREATE TABLE [LoanProducts] (
        [Id] int NOT NULL IDENTITY,
        [Name] nvarchar(150) NOT NULL,
        [Description] nvarchar(500) NULL,
        [Amount] decimal(18,2) NOT NULL,
        [InterestRatePercent] decimal(18,4) NOT NULL,
        [TermCount] int NOT NULL,
        [PaymentFrequency] int NOT NULL,
        [InterestMethod] int NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_LoanProducts] PRIMARY KEY ([Id])
    );
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH(N'dbo.Loans', N'LoanProductId') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_Loans_LoanProductId' AND object_id = OBJECT_ID(N'dbo.Loans'))
    CREATE INDEX [IX_Loans_LoanProductId] ON [Loans] ([LoanProductId]);
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'dbo.LoanProducts', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_LoanProducts_Name' AND object_id = OBJECT_ID(N'dbo.LoanProducts'))
    CREATE UNIQUE INDEX [IX_LoanProducts_Name] ON [LoanProducts] ([Name]);
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'dbo.FK_Loans_LoanProducts_LoanProductId', N'F') IS NULL
   AND COL_LENGTH(N'dbo.Loans', N'LoanProductId') IS NOT NULL
   AND OBJECT_ID(N'dbo.LoanProducts', N'U') IS NOT NULL
    ALTER TABLE [Loans] ADD CONSTRAINT [FK_Loans_LoanProducts_LoanProductId]
        FOREIGN KEY ([LoanProductId]) REFERENCES [LoanProducts] ([Id]) ON DELETE SET NULL;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'dbo.FK_Loans_LoanProducts_LoanProductId', N'F') IS NOT NULL
    ALTER TABLE [Loans] DROP CONSTRAINT [FK_Loans_LoanProducts_LoanProductId];
");

            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Loans_LoanProductId' AND object_id = OBJECT_ID(N'dbo.Loans'))
    DROP INDEX [IX_Loans_LoanProductId] ON [Loans];
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'dbo.LoanProducts', N'U') IS NOT NULL
    DROP TABLE [LoanProducts];
");

            migrationBuilder.Sql(@"
IF COL_LENGTH(N'dbo.Loans', N'InterestMethod') IS NOT NULL
    ALTER TABLE [Loans] DROP COLUMN [InterestMethod];
");

            migrationBuilder.Sql(@"
IF COL_LENGTH(N'dbo.Loans', N'LoanProductId') IS NOT NULL
    ALTER TABLE [Loans] DROP COLUMN [LoanProductId];
");
        }
    }
}
