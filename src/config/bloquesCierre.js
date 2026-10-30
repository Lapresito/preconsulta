// EL FORMULARIO DE CIERRE / FEEDBACK DE FIN DE TRATAMIENTO (D147, pedido del dueño 2026-10-24).
//
// "La idea es hacer algo similar a la preconsulta para terminar de ver la evolución": el cierre usa
// el formulario común (como el intermedio) con un recorte del núcleo —actividad física, intensidad
// del dolor y body chart— y estos bloques propios:
//
//   · cierreActividad — si notó mejoría en las actividades que hacía. Va pegado a la actividad.
//   · cierreFarmacos  — si el tratamiento cambió los fármacos que toma. Ídem.
//   · cierreReflexion — al final: qué entendió o qué reflexiones tiene, y qué tan conforme está.
//
// La PSFS del cierre NO es un bloque de esta lista: repite las actividades del INGRESO, que llegan
// cifradas en el link, así que su validación depende del link y no solo del tipo de formulario.
// Vive en extraerPsfsCierre(), abajo, y se guarda en `bloques.psfs` como cualquier PSFS.
//
// Helpers de rótulo repetidos de bloques.js por la misma razón que en bloquesPretriaje.js: importar
// de ahí sería circular.
import { traductor, idiomaInstalacion } from "../i18n/index.js";

const tb = (clave, vars) => traductor(idiomaInstalacion())(clave, vars);

function rotular(base, claves) {
  const o = { ...base };
  for (const [prop, clave] of Object.entries(claves)) {
    Object.defineProperty(o, prop, { get: () => tb(clave), enumerable: true, configurable: true });
  }
  return o;
}
const opcion = (valor, clave) => rotular({ valor }, { label: clave });
const opciones = (claveBase, valores) => valores.map((v) => opcion(v, `${claveBase}.${v}`));

const C = "bq.cierre";

// `lugar: "actividad"` los dibuja justo debajo de la actividad física del núcleo, sin sección propia
// (`integrado`): son preguntas sobre lo mismo, no un tema nuevo.
export const cierreActividad = {
  key: "cierreActividad",
  version: "1.0",
  lugar: "actividad",
  integrado: true,
  get titulo() { return tb(`${C}.actividadTitulo`); },
  intro: null,
  mostrarSi: null,
  items: [
    // "no_hacia" existe para no forzar una respuesta a quien no hacía ninguna actividad: sin esa
    // opción, la única forma de seguir sería mentir o dejarla vacía.
    rotular({ key: "mejoria", tipo: "opcion", requerido: false,
      opciones: opciones(`${C}.mejoria`, ["mucho", "algo", "igual", "peor", "no_hacia"]) },
    { texto: `${C}.mejoria` }),
  ],
};

export const cierreFarmacos = {
  key: "cierreFarmacos",
  version: "1.0",
  lugar: "actividad",
  integrado: true,
  get titulo() { return tb(`${C}.farmacosTitulo`); },
  intro: null,
  mostrarSi: null,
  items: [
    rotular({ key: "cambio", tipo: "opcion", requerido: false,
      opciones: opciones(`${C}.farmacos`, ["no", "menos", "mas", "otro"]) },
    { texto: `${C}.farmacos` }),
    // Cuál, solo si hubo un cambio. Texto libre: capa C, como los fármacos de la preconsulta.
    rotular({ key: "detalle", tipo: "texto", requerido: false,
      mostrarSi: { campo: "cierreFarmacos.cambio", enLista: ["menos", "mas", "otro"] } },
    { texto: `${C}.farmacosDetalle` }),
  ],
};

export const cierreReflexion = {
  key: "cierreReflexion",
  version: "1.0",
  lugar: "cierre",
  get titulo() { return tb(`${C}.reflexionTitulo`); },
  intro: null,
  mostrarSi: null,
  items: [
    rotular({ key: "reflexion", tipo: "texto", requerido: false }, { texto: `${C}.reflexion` }),
    // La misma escala 1-5 que la satisfacción del cierre viejo, y a la misma columna
    // (`consultas.satisfaccion`): el promedio del dashboard sigue leyendo un solo dato.
    rotular({ key: "conformidad", tipo: "escala", min: 1, max: 5, requerido: true, alimenta: "satisfaccion" },
      { texto: `${C}.conformidad`, anclaBaja: `${C}.conformidadBaja`, anclaAlta: `${C}.conformidadAlta` }),
  ],
};

// ── La PSFS del cierre ──────────────────────────────────────────────────────────────────────

/** El nombre del campo de la PSFS del cierre en el formulario. */
export const campoPsfsCierre = (item) => `psfsc:pun${item}`;

/**
 * El puntaje de cada actividad del ingreso, tal como llegó. `items` son las actividades que trae el
 * link (`link.psfsCierre.items`). Obligatorio (pedido del dueño): cada actividad del ingreso tiene
 * que volver con su puntaje, o no hay contra qué comparar.
 *
 * Devuelve `{ error, respuestas }`. En modo no estricto (el sync) descarta lo inválido en vez de
 * fallar: del otro lado del buzón ya no hay a quién avisarle.
 */
export function extraerPsfsCierre({ data = {}, items = [], estricto = true } = {}) {
  const respuestas = {};
  for (const item of items) {
    const crudo = data[campoPsfsCierre(item)];
    const texto = crudo === undefined || crudo === null ? "" : String(crudo).trim();
    const n = /^\d+$/.test(texto) ? Number(texto) : null;
    if (n !== null && n >= 0 && n <= 10) { respuestas[`pun${item}`] = n; continue; }
    if (estricto) return { error: tb("bq.cierre.faltaPsfs"), respuestas: {} };
  }
  return { error: null, respuestas };
}
