import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// Plantilla base de PDF para la fase de scaffold. Fase 2 la reemplazará (o
// la reutilizará) por plantillas específicas de Tarja, Guía de Remisión y
// Packing List con el detalle completo exigido por cada documento.
const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 16, borderBottom: 1, borderBottomColor: "#1d4ed8", paddingBottom: 8 },
  empresa: { fontSize: 12, fontWeight: 700, color: "#1d4ed8" },
  subtitulo: { fontSize: 9, color: "#555" },
  titulo: { fontSize: 14, fontWeight: 700, marginTop: 12, marginBottom: 12 },
  fila: { flexDirection: "row", borderBottom: 1, borderBottomColor: "#eee", paddingVertical: 4 },
  label: { width: "35%", color: "#555" },
  value: { width: "65%", fontWeight: 700 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#999", textAlign: "center" },
});

export type FilaDocumentoPdf = { label: string; value: string };

export function DocumentoPruebaPdf({
  titulo,
  numero,
  filas,
}: {
  titulo: string;
  numero: string;
  filas: FilaDocumentoPdf[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.empresa}>Empresa Agroexportadora de Arándanos S.A.C.</Text>
          <Text style={styles.subtitulo}>Ica, Perú — Documento interno generado por el sistema (no válido como comprobante SUNAT)</Text>
        </View>

        <Text style={styles.titulo}>{titulo} — {numero}</Text>

        {filas.map((fila) => (
          <View key={fila.label} style={styles.fila}>
            <Text style={styles.label}>{fila.label}</Text>
            <Text style={styles.value}>{fila.value}</Text>
          </View>
        ))}

        <Text style={styles.footer} fixed>
          Documento de prueba — fase de scaffold. La integración con SUNAT/OSE se implementará en una fase posterior.
        </Text>
      </Page>
    </Document>
  );
}
