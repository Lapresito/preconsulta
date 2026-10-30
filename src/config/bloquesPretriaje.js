// LOS BLOQUES DEL PRETRIAGE Y DE LA PSFS (D141). Se registran en BLOQUES de src/config/bloques.js
// y se dibujan, validan y guardan exactamente como cualquier otro bloque (D136). Viven en un
// archivo aparte porque son los dos únicos que leen campos del NÚCLEO para decidir qué preguntar
// (las zonas del dolor), y porque el pretriage arrastra una regla de evaluación propia.
//
// Los helpers de rótulo están repetidos de bloques.js a propósito: importarlos de ahí haría un
// import circular (bloques.js importa este archivo para registrarlos) y las `const` de allá
// todavía no existirían cuando este módulo se evalúa.
import { traductor, idiomaInstalacion } from "../i18n/index.js";
import { zonasDeFormulario, cancerDeFormulario, codigoEnfermedad } from "./catalogos.js";
import {
  evaluarPretriaje, ZONAS_LUMBOPELVICAS, ZONAS_CERVICALES, ZONAS_TORACICAS, ZONAS_ARTICULARES,
  ZONAS_TVP, ZONAS_APOYO,
} from "../../public/pretriaje.js";

const tb = (clave, vars) => traductor(idiomaInstalacion())(clave, vars);

// Getters y no valores: el idioma cambia en caliente (D127).
function rotular(base, claves) {
  const o = { ...base };
  for (const [prop, clave] of Object.entries(claves)) {
    Object.defineProperty(o, prop, { get: () => tb(clave), enumerable: true, configurable: true });
  }
  return o;
}
const opcion = (valor, clave) => rotular({ valor }, { label: clave });
const opciones = (claveBase, valores) => valores.map((v) => opcion(v, `${claveBase}.${v}`));

// ── Pretriage de banderas rojas ──────────────────────────────────────────────────────────────
//
// El pedido del dueño: que la preconsulta ya haga un triage básico, para que Felipe no tenga que
// esperar a la sesión para enterarse de algo que puede ser una emergencia. Y sin convertir el
// formulario en un interrogatorio: CUATRO preguntas generales para todos, y el resto se abre
// según DÓNDE le duele (las zonas del núcleo) y lo que va contestando. Un dolor de rodilla sin
// golpe agrega dos preguntas; uno lumbar, tres.
//
// Lo que cada respuesta SIGNIFICA no está acá: está en public/pretriaje.js, que comparten el
// navegador y el servidor. Acá vive solo qué se pregunta y cuándo.
//
// 📚 BIBLIOGRAFIA-CLINICA.md §12 — fuente de cada pregunta y de cada regla.
const P = "bq.pretriaje";
const siNo = [opcion("si", "comun.si"), opcion("no", "comun.no")];
const ninguno = opcion("ninguno", "bq.ninguno");
const zonaEn = (zonas) => ({ campo: "zonasConsulta", enLista: zonas });
const hubo = (item, valor = "si") => ({ campo: `pretriaje.${item}`, igual: valor });

/**
 * El contexto de los bloques a partir del FORMULARIO crudo (la ruta pública, para el PDF y el
 * mail). `edad` la calcula quien llama, con la misma función que usa para todo lo demás.
 */
export function contextoDeFormulario(data = {}, edad = null, extra = {}) {
  const enfermedades = Array.isArray(data.enfermedades) ? data.enfermedades : data.enfermedades ? [data.enfermedades] : [];
  return {
    ...extra,
    zonas: zonasDeFormulario(data),
    edad: typeof edad === "number" ? edad : null,
    genero: data.genero || null,
    enfermedades: enfermedades.map(codigoEnfermedad),
    cancerTipos: cancerDeFormulario(data),
  };
}

/** El mismo contexto a partir de una consulta GUARDADA y sus condiciones (la ficha, la bandeja). */
export function contextoDeConsulta(c = {}, condiciones = [], extra = {}) {
  return {
    ...extra,
    zonas: c.zonasConsulta || [],
    edad: Number.isInteger(c.edadAnios) ? c.edadAnios : null,
    genero: c.genero || null,
    enfermedades: condiciones.filter((x) => x.tipo === "enfermedad").map((x) => x.codigo),
    cancerTipos: condiciones.filter((x) => x.tipo === "cancer").map((x) => x.codigo),
  };
}

/**
 * Solo el resultado del pretriage de una consulta guardada, sin el resto de los bloques. Lo usan
 * la bandeja y la campanita, que necesitan el nivel y nada más.
 */
export function pretriajeDeConsulta(c = {}, condiciones = []) {
  const respuestas = c.bloques?.pretriaje?.respuestas;
  if (!respuestas) return null;
  return pretriaje.evaluar(respuestas, contextoDeConsulta(c, condiciones));
}

/** El contexto que pide evaluarPretriaje(), a partir del que reciben los bloques al leerse. */
function contextoPretriaje(c = {}) {
  return {
    zonas: c.zonas || [],
    edad: Number.isFinite(c.edad) ? c.edad : null,
    genero: c.genero || null,
    enfermedades: c.enfermedades || [],
    cancerTipos: c.cancerTipos || [],
  };
}

export const pretriaje = {
  key: "pretriaje",
  version: "1.0",
  get titulo() { return tb(`${P}.titulo`); },
  get intro() { return tb(`${P}.intro`); },
  mostrarSi: null,
  items: [
    // ── Para todos ──
    rotular({ key: "trauma", tipo: "opcion", requerido: true, opciones: siNo }, { texto: `${P}.trauma` }),
    rotular({ key: "trauma_tipo", tipo: "opcion", requerido: true, mostrarSi: hubo("trauma"),
      opciones: opciones(`${P}.traumaTipo`, ["alto_impacto", "bajo_impacto", "esfuerzo"]) },
    { texto: `${P}.traumaTipo` }),
    rotular({ key: "trauma_moreton", tipo: "opcion", requerido: true, mostrarSi: hubo("trauma"), opciones: siNo },
      { texto: `${P}.traumaMoreton` }),
    rotular({ key: "trauma_deformidad", tipo: "opcion", requerido: true, mostrarSi: hubo("trauma"), opciones: siNo },
      { texto: `${P}.traumaDeformidad` }),
    // Reglas de Ottawa (tobillo y rodilla): poder dar cuatro pasos, aunque sea rengueando.
    rotular({ key: "apoyo", tipo: "opcion", requerido: true, mostrarSi: { todas: [hubo("trauma"), zonaEn(ZONAS_APOYO)] }, opciones: siNo },
      { texto: `${P}.apoyo` }),
    // Regla canadiense de columna cervical: parestesias en brazos o piernas después del golpe.
    rotular({ key: "trauma_hormigueo", tipo: "opcion", requerido: true, mostrarSi: { todas: [hubo("trauma"), zonaEn(["cuello"])] }, opciones: siNo },
      { texto: `${P}.traumaHormigueo` }),

    rotular({ key: "sistemicos", tipo: "casillas", requerido: true, exclusiva: "ninguno",
      opciones: [...opciones(`${P}.sistemicos`, ["fiebre", "peso", "sudor_nocturno", "cansancio", "bulto"]), ninguno] },
    { texto: `${P}.sistemicos` }),
    // Las tres respuestas son la distinción exacta de la tabla 14 de Finucane: lo que preocupa no
    // es que el dolor despierte, es que no se calme con nada.
    rotular({ key: "dolor_nocturno", tipo: "opcion", requerido: true,
      opciones: opciones(`${P}.nocturno`, ["no_molesta", "cambio_posicion", "no_cede"]) },
    { texto: `${P}.nocturno` }),
    rotular({ key: "factores", tipo: "casillas", requerido: true, exclusiva: "ninguno",
      opciones: [...opciones(`${P}.factores`, ["osteoporosis", "corticoides", "inmunosupresion", "procedimiento", "infeccion_reciente", "drogas_iv"]), ninguno] },
    { texto: `${P}.factores` }),

    // ── Espalda baja / cadera: cauda equina y déficit motor ──
    rotular({ key: "ce_sintomas", tipo: "casillas", requerido: true, exclusiva: "ninguno", mostrarSi: zonaEn(ZONAS_LUMBOPELVICAS),
      opciones: [...opciones(`${P}.ce`, ["orina", "intestino", "silla_montar", "sexual", "ambas_piernas"]), ninguno] },
    { texto: `${P}.ce`, antes: `${P}.antesLumbar` }),
    rotular({ key: "ce_reciente", tipo: "opcion", requerido: true,
      mostrarSi: { todas: [zonaEn(ZONAS_LUMBOPELVICAS), { campo: "pretriaje.ce_sintomas", enLista: ["orina", "intestino", "silla_montar", "sexual"] }] },
      opciones: opciones(`${P}.ceReciente`, ["nuevo", "previo"]) },
    { texto: `${P}.ceReciente` }),
    rotular({ key: "debilidad_pierna", tipo: "opcion", requerido: true, mostrarSi: zonaEn(ZONAS_LUMBOPELVICAS), opciones: siNo },
      { texto: `${P}.debilidadPierna` }),

    // ── Cuello / cabeza: patología vascular y mielopatía ──
    rotular({ key: "cervical_neuro", tipo: "casillas", requerido: true, exclusiva: "ninguno", mostrarSi: zonaEn(ZONAS_CERVICALES),
      opciones: [...opciones(`${P}.cn`, ["mareo", "vision", "habla", "caidas", "cara", "manos", "equilibrio"]), ninguno] },
    { texto: `${P}.cn`, antes: `${P}.antesCuello` }),
    rotular({ key: "inicio_subito", tipo: "opcion", requerido: true, mostrarSi: zonaEn(["cuello"]), opciones: siNo },
      { texto: `${P}.inicioSubito` }),

    // ── Cabeza: cefalea secundaria (SNNOOP10) ──
    rotular({ key: "cefalea", tipo: "casillas", requerido: true, exclusiva: "ninguno", mostrarSi: zonaEn(["cabeza"]),
      opciones: [...opciones(`${P}.cf`, ["subito", "neuro", "fiebre_rigidez", "esfuerzo", "posicion", "progresivo", "nuevo"]), ninguno] },
    { texto: `${P}.cf` }),

    // ── Hombro / espalda alta: dolor de origen cardíaco ──
    rotular({ key: "cardio_esfuerzo", tipo: "opcion", requerido: true, mostrarSi: zonaEn(ZONAS_TORACICAS), opciones: siNo },
      { texto: `${P}.cardioEsfuerzo`, antes: `${P}.antesToracico` }),
    rotular({ key: "cardio_sintomas", tipo: "opcion", requerido: true, mostrarSi: zonaEn(ZONAS_TORACICAS), opciones: siNo },
      { texto: `${P}.cardioSintomas` }),

    // ── Articulaciones: artritis séptica ──
    // D154 — tres casillas y no una pregunta que exigía las tres a la vez (pedido del dueño).
    rotular({ key: "articulacion", tipo: "casillas", requerido: true, exclusiva: "ninguno", mostrarSi: zonaEn(ZONAS_ARTICULARES),
      opciones: [...opciones(`${P}.art`, ["hinchada", "caliente", "roja"]), ninguno] },
    { texto: `${P}.articulacion` }),

    // ── Pierna: trombosis venosa profunda ──
    rotular({ key: "pantorrilla", tipo: "opcion", requerido: true, mostrarSi: zonaEn(ZONAS_TVP), opciones: siNo },
      { texto: `${P}.pantorrilla` }),
    rotular({ key: "tvp_riesgo", tipo: "casillas", requerido: true, exclusiva: "ninguno",
      mostrarSi: { todas: [zonaEn(ZONAS_TVP), hubo("pantorrilla")] },
      opciones: [...opciones(`${P}.tvp`, ["cirugia", "reposo", "previa"]), ninguno] },
    { texto: `${P}.tvp` }),
  ],

  /** Lo que el pretriage concluye, con los rótulos resueltos. La regla: evaluarPretriaje(). */
  evaluar(respuestas = {}, contexto = {}) {
    const res = evaluarPretriaje({ r: respuestas, ...contextoPretriaje(contexto) });
    return {
      nivel: res.nivel,
      nivelLabel: res.nivel ? tb(`${P}.nivel.${res.nivel}`) : null,
      // Las banderas del triage de la sesión que la preconsulta sugiere tildar. Sugiere: no tilda.
      flags: [...new Set(res.sospechas.flatMap((s) => s.flags))],
      sospechas: res.sospechas.map((s) => ({
        ...s,
        label: tb(`${P}.sosp.${s.key}`),
        nivelLabel: tb(`${P}.nivel.${s.nivel}`),
        nota: tb(`${P}.nota.${s.key}`),
        evidenciasLabels: s.evidencias.map((ev) => tb(`${P}.ev.${ev}`)),
      })),
    };
  },

  // Las sospechas también como señales: así llegan solas al PDF y al mail, que ya saben dibujarlas.
  senales(respuestas = {}, contexto = {}) {
    return this.evaluar(respuestas, contexto).sospechas.map((s) => ({
      nivel: s.nivel === "atencion" ? "bajo" : s.nivel === "urgente" ? "medio" : "alto",
      texto: `${s.nivelLabel} — ${s.label}: ${s.evidenciasLabels.join(", ")}`,
    }));
  },
};

// ── PSFS — Escala Funcional Específica del Paciente ─────────────────────────────────────────
//
// Pedido del dueño: corta, y mide lo que ningún otro instrumento del formulario mide, que es la
// FUNCIÓN en las palabras del propio paciente. Hasta tres actividades que le cuesta hacer por su
// problema, cada una de 0 (no puede) a 10 (como antes del problema). El puntaje es el promedio.
//
// 📚 Stratford 1995 — BIBLIOGRAFIA-CLINICA.md §13.
const PS = "bq.psfs";
const PSFS_ACTIVIDADES = [1, 2, 3];

export const psfs = {
  key: "psfs",
  version: "1.0",
  get titulo() { return tb(`${PS}.titulo`); },
  get intro() { return tb(`${PS}.intro`); },
  mostrarSi: null,
  items: PSFS_ACTIVIDADES.flatMap((n) => [
    // La primera es obligatoria: un PSFS sin ninguna actividad no mide nada. Las otras dos no: hay
    // quien tiene una sola cosa que no puede hacer, y obligarlo a inventar dos más ensucia el
    // promedio.
    rotular({ key: `act${n}`, tipo: "texto", requerido: n === 1 }, { texto: `${PS}.actividad${n}` }),
    // El puntaje aparece recién cuando la actividad está escrita: puntuar una actividad vacía no
    // significa nada.
    rotular({ key: `pun${n}`, tipo: "escala", min: 0, max: 10, requerido: true, mostrarSi: { campo: `psfs.act${n}`, lleno: true } },
      { texto: `${PS}.puntaje`, anclaBaja: `${PS}.anclaBaja`, anclaAlta: `${PS}.anclaAlta` }),
  ]),

  // El texto de cada actividad va cifrado (capa C) y no llega acá; no hace falta: el promedio sale
  // de los puntajes, que solo existen si la actividad se escribió.
  puntuar(respuestas = {}) {
    const puntajes = PSFS_ACTIVIDADES.map((n) => respuestas[`pun${n}`]).filter(Number.isInteger);
    if (!puntajes.length) return null;
    const promedio = Math.round((puntajes.reduce((a, b) => a + b, 0) / puntajes.length) * 10) / 10;
    return {
      total: promedio, min: 0, max: 10,
      // Al revés que los demás puntajes: acá más es MEJOR (10 = como antes del problema).
      nivel: promedio < 4 ? "alto" : promedio < 7 ? "medio" : "bajo",
      label: tb(`${PS}.promedio`, { n: puntajes.length }),
      detalle: tb(`${PS}.detalle`),
    };
  },
};
