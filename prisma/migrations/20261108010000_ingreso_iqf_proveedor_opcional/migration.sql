-- DropForeignKey
ALTER TABLE "ingresos_iqf" DROP CONSTRAINT "ingresos_iqf_proveedorId_fkey";

-- AlterTable
ALTER TABLE "ingresos_iqf" ALTER COLUMN "proveedorId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ingresos_iqf" ADD CONSTRAINT "ingresos_iqf_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

