-- Respaldo del archivo original de cada importación (Fase 2 del pedido:
-- "Conservar el archivo original como respaldo"), en Supabase Storage.
ALTER TABLE "import_history" ADD COLUMN "archivoUrl" TEXT;
