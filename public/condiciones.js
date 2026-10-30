// Condiciones de visibilidad de los bloques variables de la preconsulta (D136).
//
// UN SOLO ARCHIVO PARA LOS DOS LADOS. El navegador lo usa para mostrar u ocultar preguntas
// mientras el paciente contesta (public/bloques.js), y el servidor lo importa
// (src/config/bloques.js) para validar el envío con exactamente la misma regla. Vive en `public/`
// porque es lo único que el navegador puede cargar sin un paso de build; el servidor lo importa
// por ruta relativa. Con dos copias, tarde o temprano el formulario mostraría una pregunta que el
// servidor después rechaza por "no correspondía", o al revés.
//
// Sin dependencias y sin tocar el DOM: recibe una función `leer(nombre)` que devuelve el valor
// crudo de un campo del formulario (string, array de strings, o nada).

/** El `name` del input de una pregunta de bloque. */
export function nombreCampo(bloque, item) {
  return `bq:${bloque}:${item}`;
}

/** "bloque.item" → el `name` de esa pregunta; un campo del núcleo ("dolorCronico") queda igual. */
export function campoDeCondicion(campo) {
  const punto = campo.indexOf(".");
  return punto === -1 ? campo : nombreCampo(campo.slice(0, punto), campo.slice(punto + 1));
}

function comoLista(valor) {
  if (Array.isArray(valor)) return valor.map(String);
  if (valor === undefined || valor === null || valor === "") return [];
  return [String(valor)];
}

/**
 * ¿Se cumple la condición? Sin condición, siempre.
 *
 *   { campo, igual }    — lo elegido es ese valor (radio, select)
 *   { campo, incluye }  — entre lo marcado está ese valor (casillas)
 *   { campo, enLista }  — lo elegido es alguno de esos valores (o, en casillas, alguno de los marcados)
 *   { campo, lleno }    — el campo tiene algo escrito (un texto que se completó)
 *   { todas: [...] }    — se cumplen todas
 *
 * `igual` e `incluye` se evalúan igual; existen los dos para que la definición se lea como lo que
 * pregunta ("marcó otros" no es lo mismo que "eligió otros" para quien la revisa).
 */
export function cumple(condicion, leer) {
  if (!condicion) return true;
  if (Array.isArray(condicion.todas)) return condicion.todas.every((c) => cumple(c, leer));
  const valores = comoLista(leer(campoDeCondicion(condicion.campo)));
  if ("igual" in condicion) return valores.includes(String(condicion.igual));
  if ("incluye" in condicion) return valores.includes(String(condicion.incluye));
  if (Array.isArray(condicion.enLista)) return valores.some((v) => condicion.enLista.map(String).includes(v));
  if (condicion.lleno) return valores.some((v) => v.trim() !== "");
  return false;
}
