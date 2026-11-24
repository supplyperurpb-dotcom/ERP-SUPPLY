// Interruptor temporal (pedido explícito, 2026-11-24): mientras esté en
// `false`, los Consumos de Almacén son siempre directos/manuales — se
// oculta el botón "Atender" de Solicitudes de Despacho y la página de
// nuevo consumo ignora cualquier solicitudDespachoId/solicitudDespachoIds
// que venga en la URL. Para volver a habilitar el flujo normal (atender
// una Solicitud de Despacho desde un consumo), alcanza con poner esto en
// `true` y desplegar — no se tocó ni se borró nada del flujo en sí.
export const PERMITIR_ATENDER_SOLICITUD_DESPACHO_EN_CONSUMO = false;
