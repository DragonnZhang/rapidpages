/*
  Warnings:

  - The `code` column on the `Component` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `code` column on the `ComponentRevision` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Component" DROP COLUMN "code",
ADD COLUMN     "code" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "ComponentRevision" DROP COLUMN "code",
ADD COLUMN     "code" JSONB NOT NULL DEFAULT '[]';
