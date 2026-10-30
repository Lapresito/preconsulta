// Edad y validación de fecha de nacimiento.
//
// Vive en `lib/` y no en `services/persistencia.js` —donde estaba `calcularEdad`— porque el
// proceso PÚBLICO también tiene que validar, y persistencia.js arrastra la cadena entera
// (repos → pool → crypto → Postgres) que del lado público no existe ni debe existir.
// Acá no hay ninguna dependencia: se puede importar desde cualquiera de los dos.

// Felipe no atiende niños: un paciente de menos de 6 años es un error de tipeo, no un caso real.
// El tope de 120 corta por el otro lado (fechas de nacimiento absurdas).
export const EDAD_MINIMA = 6;
export const EDAD_MAXIMA = 120;

export function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "";

  // ⚠️ Se parsea a mano en vez de con `new Date(str)`. Motivo: `new Date("1996-08-08")` se
  // interpreta como medianoche UTC, pero después se compara contra `new Date()`, que es hora
  // LOCAL. En Uruguay (UTC-3) esa medianoche UTC cae el día anterior a las 21:00, así que
  // `getDate()` devolvía un día menos y la edad salía corrida en el borde del cumpleaños.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fechaNacimiento));
  if (!m) return NaN;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return NaN;

  const hoy = new Date();
  let edad = hoy.getFullYear() - anio;
  const difMes = (hoy.getMonth() + 1) - mes;
  if (difMes < 0 || (difMes === 0 && hoy.getDate() < dia)) edad--;
  return edad;
}

/**
 * Valida del lado del SERVIDOR. Los `min`/`max` del input solo frenan al navegador: un POST
 * directo —o un navegador que los ignore— pasaba fechas futuras, y una edad negativa después
 * rompía el rango etario en la analítica.
 *
 * Devuelve el mensaje de error, o null si está bien. No tira: los llamadores responden 400.
 * Una fecha vacía se considera válida acá: la obligatoriedad la decide cada formulario
 * (en Nuevo Ingreso nada es obligatorio), esto solo se ocupa de que lo que venga tenga sentido.
 */
export function validarFechaNacimiento(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const edad = calcularEdad(fechaNacimiento);
  if (typeof edad !== "number" || Number.isNaN(edad)) return "La fecha de nacimiento no es válida.";
  if (edad < 0) return "La fecha de nacimiento no puede ser futura.";
  if (edad < EDAD_MINIMA) return `La edad mínima es ${EDAD_MINIMA} años.`;
  if (edad > EDAD_MAXIMA) return "La fecha de nacimiento no es válida.";
  return null;
}
