-- DropForeignKey
ALTER TABLE "tarjas" DROP CONSTRAINT "tarjas_palletId_fkey";

-- AddForeignKey
ALTER TABLE "tarjas" ADD CONSTRAINT "tarjas_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "pallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
