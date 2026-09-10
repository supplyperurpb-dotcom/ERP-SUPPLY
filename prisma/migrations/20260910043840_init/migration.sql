-- CreateEnum
CREATE TYPE "RolNombre" AS ENUM ('ADMIN', 'LOGISTICA_COMPRAS', 'ACOPIO', 'COMEX', 'APROBADOR', 'SOLO_LECTURA');

-- CreateEnum
CREATE TYPE "AccionPermiso" AS ENUM ('VER', 'CREAR', 'EDITAR', 'APROBAR', 'ELIMINAR');

-- CreateEnum
CREATE TYPE "TipoDocumentoIdentidad" AS ENUM ('RUC', 'DNI');

-- CreateEnum
CREATE TYPE "TipoProveedor" AS ENUM ('INSUMOS', 'FUNDO', 'AMBOS');

-- CreateEnum
CREATE TYPE "TipoSku" AS ENUM ('INSUMO', 'PRODUCTO_TERMINADO');

-- CreateEnum
CREATE TYPE "TipoAlmacen" AS ENUM ('INSUMOS', 'AGROQUIMICOS', 'MATERIAL_EMPAQUE', 'CAMARA_FRIO', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoMovimientoStock" AS ENUM ('INGRESO', 'SALIDA', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "EstadoDocumento" AS ENUM ('BORRADOR', 'PENDIENTE', 'APROBADO', 'RECHAZADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoDocumentoAprobacion" AS ENUM ('SOLICITUD_PEDIDO', 'ORDEN_COMPRA');

-- CreateEnum
CREATE TYPE "EstadoAprobacionItem" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "TipoGuiaRemision" AS ENUM ('REMITENTE', 'TRANSPORTISTA');

-- CreateEnum
CREATE TYPE "EstadoGuiaRemision" AS ENUM ('EMITIDA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoEmbarque" AS ENUM ('PLANIFICADO', 'EN_PROCESO', 'EMBARCADO', 'CERRADO');

-- CreateEnum
CREATE TYPE "EstadoPackingList" AS ENUM ('BORRADOR', 'EMITIDO', 'ANULADO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "supabaseAuthId" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "nombre" "RolNombre" NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "accion" "AccionPermiso" NOT NULL,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_rol" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,
    "asignadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignaciones_rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumentoIdentidad" NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "tipo" "TipoProveedor" NOT NULL,
    "direccion" TEXT,
    "distrito" TEXT,
    "provincia" TEXT,
    "departamento" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "contactoNombre" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skus" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "tipo" "TipoSku" NOT NULL,
    "stockMinimo" DECIMAL(12,3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "almacenes" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoAlmacen" NOT NULL,
    "ubicacion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "almacenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_stock" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "almacenOrigenId" TEXT,
    "almacenDestinoId" TEXT,
    "tipo" "TipoMovimientoStock" NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "documentoOrigenTipo" TEXT,
    "documentoOrigenId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_pedido" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "solicitanteId" TEXT,
    "area" TEXT,
    "estado" "EstadoDocumento" NOT NULL DEFAULT 'BORRADOR',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "justificacion" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_pedido_items" (
    "id" TEXT NOT NULL,
    "solicitudPedidoId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "observaciones" TEXT,

    CONSTRAINT "solicitud_pedido_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_compra" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "solicitudPedidoId" TEXT,
    "estado" "EstadoDocumento" NOT NULL DEFAULT 'BORRADOR',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "montoTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordenes_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_compra_items" (
    "id" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "precioUnitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "orden_compra_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglas_aprobacion" (
    "id" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumentoAprobacion" NOT NULL,
    "montoUmbral" DECIMAL(12,2),
    "rolAprobadorId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reglas_aprobacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aprobaciones" (
    "id" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumentoAprobacion" NOT NULL,
    "documentoId" TEXT NOT NULL,
    "documentoNumero" TEXT,
    "aprobadorId" TEXT,
    "estado" "EstadoAprobacionItem" NOT NULL DEFAULT 'PENDIENTE',
    "comentario" TEXT,
    "fecha" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aprobaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_bandeja" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "pesoTaraKg" DECIMAL(8,3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_bandeja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_pallet" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "pesoTaraKg" DECIMAL(8,3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_pallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingresos_fruta" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "lote" TEXT NOT NULL,
    "variedad" TEXT NOT NULL,
    "fechaCosecha" TIMESTAMP(3) NOT NULL,
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horaIngreso" TEXT,
    "placaTransporte" TEXT,
    "observaciones" TEXT,
    "estado" "EstadoDocumento" NOT NULL DEFAULT 'BORRADOR',
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingresos_fruta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingreso_fruta_pallets" (
    "id" TEXT NOT NULL,
    "ingresoFrutaId" TEXT NOT NULL,
    "numeroPallet" INTEGER NOT NULL,
    "tipoPalletId" TEXT NOT NULL,
    "tipoBandejaId" TEXT NOT NULL,
    "cantidadBandejas" INTEGER NOT NULL,
    "pesoBrutoTotalKg" DECIMAL(10,3) NOT NULL,
    "pesoTaraTotalKg" DECIMAL(10,3) NOT NULL,
    "pesoNetoKg" DECIMAL(10,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingreso_fruta_pallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingreso_fruta_bandeja_pesos" (
    "id" TEXT NOT NULL,
    "palletId" TEXT NOT NULL,
    "numeroBandeja" INTEGER NOT NULL,
    "pesoBrutoKg" DECIMAL(8,3) NOT NULL,

    CONSTRAINT "ingreso_fruta_bandeja_pesos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarjas" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "palletId" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfUrl" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarjas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guias_remision" (
    "id" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipoGuia" "TipoGuiaRemision" NOT NULL,
    "motivoTraslado" TEXT NOT NULL,
    "fechaTraslado" TIMESTAMP(3) NOT NULL,
    "puntoPartida" TEXT NOT NULL,
    "puntoLlegada" TEXT NOT NULL,
    "pesoBrutoTotalKg" DECIMAL(10,3) NOT NULL,
    "unidadMedidaPeso" TEXT NOT NULL DEFAULT 'KGM',
    "transportistaRazonSocial" TEXT,
    "transportistaDocumento" TEXT,
    "placaVehiculo" TEXT,
    "licenciaConductor" TEXT,
    "conductorNombre" TEXT,
    "conductorDocumento" TEXT,
    "ingresoFrutaId" TEXT NOT NULL,
    "estado" "EstadoGuiaRemision" NOT NULL DEFAULT 'EMITIDA',
    "pdfUrl" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guias_remision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guia_remision_detalles" (
    "id" TEXT NOT NULL,
    "guiaRemisionId" TEXT NOT NULL,
    "palletId" TEXT NOT NULL,
    "descripcion" TEXT,
    "cantidadBultos" INTEGER,
    "pesoKg" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "guia_remision_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formatos_exportacion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "pesoNetoUnitarioG" DECIMAL(10,2),
    "unidadesPorCaja" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formatos_exportacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "pais" TEXT,
    "numeroIdentificacionFiscal" TEXT,
    "contactoNombre" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_camara" (
    "id" TEXT NOT NULL,
    "skuId" TEXT,
    "formatoExportacionId" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "lote" TEXT NOT NULL,
    "clienteId" TEXT,
    "cantidadDisponible" DECIMAL(12,3) NOT NULL,
    "unidadMedida" TEXT NOT NULL DEFAULT 'NIU',
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_camara_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embarques" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fechaEmbarque" TIMESTAMP(3),
    "contenedor" TEXT,
    "naviera" TEXT,
    "destinoPais" TEXT,
    "destinoPuerto" TEXT,
    "clienteId" TEXT,
    "estado" "EstadoEmbarque" NOT NULL DEFAULT 'PLANIFICADO',
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embarques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_lists" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "embarqueId" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfUrl" TEXT,
    "estado" "EstadoPackingList" NOT NULL DEFAULT 'BORRADOR',
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packing_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_list_items" (
    "id" TEXT NOT NULL,
    "packingListId" TEXT NOT NULL,
    "formatoExportacionId" TEXT NOT NULL,
    "lote" TEXT,
    "numeroPallet" TEXT,
    "cantidadCajas" INTEGER NOT NULL,
    "pesoNetoKg" DECIMAL(10,3) NOT NULL,
    "pesoBrutoKg" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "packing_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "valoresAntes" JSONB,
    "valoresDespues" JSONB,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_supabaseAuthId_key" ON "usuarios"("supabaseAuthId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_rolId_modulo_accion_key" ON "permisos"("rolId", "modulo", "accion");

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_rol_usuarioId_rolId_key" ON "asignaciones_rol"("usuarioId", "rolId");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_tipoDocumento_numeroDocumento_key" ON "proveedores"("tipoDocumento", "numeroDocumento");

-- CreateIndex
CREATE UNIQUE INDEX "skus_codigo_key" ON "skus"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "almacenes_codigo_key" ON "almacenes"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_pedido_numero_key" ON "solicitudes_pedido"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_compra_numero_key" ON "ordenes_compra"("numero");

-- CreateIndex
CREATE INDEX "aprobaciones_tipoDocumento_documentoId_idx" ON "aprobaciones"("tipoDocumento", "documentoId");

-- CreateIndex
CREATE INDEX "aprobaciones_aprobadorId_estado_idx" ON "aprobaciones"("aprobadorId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_bandeja_nombre_key" ON "tipos_bandeja"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_pallet_nombre_key" ON "tipos_pallet"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ingresos_fruta_numero_key" ON "ingresos_fruta"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "ingreso_fruta_pallets_ingresoFrutaId_numeroPallet_key" ON "ingreso_fruta_pallets"("ingresoFrutaId", "numeroPallet");

-- CreateIndex
CREATE UNIQUE INDEX "ingreso_fruta_bandeja_pesos_palletId_numeroBandeja_key" ON "ingreso_fruta_bandeja_pesos"("palletId", "numeroBandeja");

-- CreateIndex
CREATE UNIQUE INDEX "tarjas_numero_key" ON "tarjas"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "tarjas_palletId_key" ON "tarjas"("palletId");

-- CreateIndex
CREATE UNIQUE INDEX "guias_remision_serie_numero_key" ON "guias_remision"("serie", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "formatos_exportacion_codigo_key" ON "formatos_exportacion"("codigo");

-- CreateIndex
CREATE INDEX "stock_camara_formatoExportacionId_lote_idx" ON "stock_camara"("formatoExportacionId", "lote");

-- CreateIndex
CREATE UNIQUE INDEX "embarques_numero_key" ON "embarques"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "packing_lists_numero_key" ON "packing_lists"("numero");

-- CreateIndex
CREATE INDEX "logs_auditoria_entidad_entidadId_idx" ON "logs_auditoria"("entidad", "entidadId");

-- AddForeignKey
ALTER TABLE "permisos" ADD CONSTRAINT "permisos_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_rol" ADD CONSTRAINT "asignaciones_rol_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_rol" ADD CONSTRAINT "asignaciones_rol_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_almacenOrigenId_fkey" FOREIGN KEY ("almacenOrigenId") REFERENCES "almacenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_almacenDestinoId_fkey" FOREIGN KEY ("almacenDestinoId") REFERENCES "almacenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_pedido_items" ADD CONSTRAINT "solicitud_pedido_items_solicitudPedidoId_fkey" FOREIGN KEY ("solicitudPedidoId") REFERENCES "solicitudes_pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_pedido_items" ADD CONSTRAINT "solicitud_pedido_items_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_solicitudPedidoId_fkey" FOREIGN KEY ("solicitudPedidoId") REFERENCES "solicitudes_pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_items" ADD CONSTRAINT "orden_compra_items_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_items" ADD CONSTRAINT "orden_compra_items_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_aprobacion" ADD CONSTRAINT "reglas_aprobacion_rolAprobadorId_fkey" FOREIGN KEY ("rolAprobadorId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_fruta" ADD CONSTRAINT "ingresos_fruta_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso_fruta_pallets" ADD CONSTRAINT "ingreso_fruta_pallets_ingresoFrutaId_fkey" FOREIGN KEY ("ingresoFrutaId") REFERENCES "ingresos_fruta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso_fruta_pallets" ADD CONSTRAINT "ingreso_fruta_pallets_tipoPalletId_fkey" FOREIGN KEY ("tipoPalletId") REFERENCES "tipos_pallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso_fruta_pallets" ADD CONSTRAINT "ingreso_fruta_pallets_tipoBandejaId_fkey" FOREIGN KEY ("tipoBandejaId") REFERENCES "tipos_bandeja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso_fruta_bandeja_pesos" ADD CONSTRAINT "ingreso_fruta_bandeja_pesos_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "ingreso_fruta_pallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarjas" ADD CONSTRAINT "tarjas_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "ingreso_fruta_pallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_remision" ADD CONSTRAINT "guias_remision_ingresoFrutaId_fkey" FOREIGN KEY ("ingresoFrutaId") REFERENCES "ingresos_fruta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guia_remision_detalles" ADD CONSTRAINT "guia_remision_detalles_guiaRemisionId_fkey" FOREIGN KEY ("guiaRemisionId") REFERENCES "guias_remision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guia_remision_detalles" ADD CONSTRAINT "guia_remision_detalles_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "ingreso_fruta_pallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_camara" ADD CONSTRAINT "stock_camara_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_camara" ADD CONSTRAINT "stock_camara_formatoExportacionId_fkey" FOREIGN KEY ("formatoExportacionId") REFERENCES "formatos_exportacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_camara" ADD CONSTRAINT "stock_camara_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_camara" ADD CONSTRAINT "stock_camara_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embarques" ADD CONSTRAINT "embarques_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_lists" ADD CONSTRAINT "packing_lists_embarqueId_fkey" FOREIGN KEY ("embarqueId") REFERENCES "embarques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_list_items" ADD CONSTRAINT "packing_list_items_packingListId_fkey" FOREIGN KEY ("packingListId") REFERENCES "packing_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_list_items" ADD CONSTRAINT "packing_list_items_formatoExportacionId_fkey" FOREIGN KEY ("formatoExportacionId") REFERENCES "formatos_exportacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
