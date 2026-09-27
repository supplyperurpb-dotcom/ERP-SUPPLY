/*
  Warnings:

  - You are about to drop the column `tipo` on the `skus` table. All the data in the column will be lost.
  - Added the required column `subfamilia` to the `skus` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "skus" DROP COLUMN "tipo",
ADD COLUMN     "subfamilia" TEXT NOT NULL;

-- DropEnum
DROP TYPE "TipoSku";
