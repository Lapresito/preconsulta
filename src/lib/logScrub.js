// Última línea de defensa antes de loguear (A8.3). Los logs se copian, se comparten y no están
// cifrados — y con la arquitectura Local-Online el archivo está hecho para SALIR de la máquina
// (D31): Felipe se lo manda a Joaco cuando algo falla. Por eso el criterio es tapar de más.
//
// No reemplaza revisar cada console.error a mano — ver docs/tecnico/IDEAS-DE-PASAJE.md
// "Reglas duras".
const MAX_LEN = 300;

export function mensajeSeguro(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.length > MAX_LEN ? `${msg.slice(0, MAX_LEN)}…` : msg;
}

// Nombres de campo que nunca deben imprimirse, vengan de donde vengan.
const CLAVE_SENSIBLE = /token|key|clave|secret|password|contrasena|contraseña|authorization|cookie|dek|kek/i;

// Detección por FORMA, para lo que se escapa del filtro por nombre: strings largos que parecen
// material criptográfico (base64/hex) aunque el campo se llame de cualquier manera. 32 bytes en
// hex son 64 caracteres; en base64, 44. El umbral de 40 los agarra a los dos.
const PARECE_CLAVE = /^[A-Za-z0-9+/=_-]{40,}$/;

/**
 * Devuelve una copia del objeto con los valores sensibles reemplazados por "[oculto]".
 * Pensado para loguear `req.headers`, un `.env` parseado o un objeto de configuración.
 *
 * ⚠️ NO lo uses para "limpiar" datos de paciente y loguearlos igual: nombres, teléfonos y
 * narrativa clínica no van al log **en ninguna forma** (D31). Esto es para secretos, no para PII.
 */
export function redactar(valor, profundidad = 0) {
  if (profundidad > 4) return "[demasiado anidado]";

  if (typeof valor === "string") return PARECE_CLAVE.test(valor) ? "[oculto]" : valor;
  if (valor === null || typeof valor !== "object") return valor;
  if (Array.isArray(valor)) return valor.map((v) => redactar(v, profundidad + 1));
  if (Buffer.isBuffer(valor)) return `[buffer ${valor.length} bytes]`;

  const salida = {};
  for (const [clave, v] of Object.entries(valor)) {
    salida[clave] = CLAVE_SENSIBLE.test(clave) ? "[oculto]" : redactar(v, profundidad + 1);
  }
  return salida;
}
