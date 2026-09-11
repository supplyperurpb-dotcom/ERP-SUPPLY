import { PrismaClient, RolNombre } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  for (const nombre of Object.values(RolNombre)) {
    await prisma.rol.upsert({
      where: { nombre },
      update: {},
      create: { nombre, descripcion: descripcionRol(nombre) },
    });
  }

  await prisma.tipoBandeja.upsert({
    where: { nombre: "Bandeja Plástica Blanca" },
    update: {},
    create: { nombre: "Bandeja Plástica Blanca", pesoTaraKg: 0.285 },
  });

  await prisma.tipoBandeja.upsert({
    where: { nombre: "Jaba Plástica" },
    update: {},
    create: { nombre: "Jaba Plástica", pesoTaraKg: 1.4 },
  });

  await prisma.tipoPallet.upsert({
    where: { nombre: "Parihuela madera estándar" },
    update: {},
    create: { nombre: "Parihuela madera estándar", pesoTaraKg: 22 },
  });

  await prisma.tipoPallet.upsert({
    where: { nombre: "Pallet Plástico Azul" },
    update: {},
    create: { nombre: "Pallet Plástico Azul", pesoTaraKg: 18.5 },
  });

  await prisma.formatoExportacion.upsert({
    where: { codigo: "CLAM-125" },
    update: {},
    create: { codigo: "CLAM-125", nombre: "Clamshell 125g", pesoNetoUnitarioG: 125 },
  });

  console.log("Seed completado.");
}

function descripcionRol(nombre: RolNombre): string {
  const descripciones: Record<RolNombre, string> = {
    ADMIN: "Acceso total al sistema",
    LOGISTICA_COMPRAS: "Gestión de solicitudes de pedido, órdenes de compra, SKU e inventario",
    ACOPIO: "Registro de ingresos de fruta, tarjas y guías de remisión",
    COMEX: "Gestión de packing list, stock de cámara y embarques",
    APROBADOR: "Aprobación de documentos según reglas configuradas",
    SOLO_LECTURA: "Acceso de solo lectura a todos los módulos",
  };
  return descripciones[nombre];
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
