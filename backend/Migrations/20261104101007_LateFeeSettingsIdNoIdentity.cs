using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroLending.Api.Migrations
{
    /// <inheritdoc />
    public partial class LateFeeSettingsIdNoIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF OBJECT_ID(N'[LateFeeSettings]', N'U') IS NOT NULL
                    DROP TABLE [LateFeeSettings];

                CREATE TABLE [LateFeeSettings] (
                    [Id] int NOT NULL,
                    [IsEnabled] bit NOT NULL,
                    [Type] int NOT NULL,
                    [Amount] decimal(18,2) NOT NULL,
                    [Percent] decimal(18,4) NOT NULL,
                    [GraceDays] int NOT NULL,
                    [MaxPerInstallment] decimal(18,2) NULL,
                    [UpdatedAt] datetime2 NOT NULL,
                    CONSTRAINT [PK_LateFeeSettings] PRIMARY KEY ([Id])
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF OBJECT_ID(N'[LateFeeSettings]', N'U') IS NOT NULL
                    DROP TABLE [LateFeeSettings];

                CREATE TABLE [LateFeeSettings] (
                    [Id] int NOT NULL IDENTITY(1,1),
                    [IsEnabled] bit NOT NULL,
                    [Type] int NOT NULL,
                    [Amount] decimal(18,2) NOT NULL,
                    [Percent] decimal(18,4) NOT NULL,
                    [GraceDays] int NOT NULL,
                    [MaxPerInstallment] decimal(18,2) NULL,
                    [UpdatedAt] datetime2 NOT NULL,
                    CONSTRAINT [PK_LateFeeSettings] PRIMARY KEY ([Id])
                );
                """);
        }
    }
}
