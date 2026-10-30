// Escapa caracteres HTML para evitar inyección en el cuerpo del email
export const esc = (str) =>
  String(str || "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
