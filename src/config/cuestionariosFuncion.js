// CUESTIONARIOS DE FUNCIÓN POR REGIÓN (D160, pedido del dueño 2026-10-25): ODI (lumbar), NDI
// (cervical), QuickDASH (miembro superior) y LEFS (miembro inferior). Los pidió para el informe
// interdisciplinario a traumatología (D159), que hasta acá solo tenía NPRS, PSFS y objetivos.
//
// Viven en su propio archivo por lo mismo que el PSQI: tres de los cuatro NO se puntúan con la suma
// simple del motor. El ODI es un porcentaje sobre las secciones contestadas, el NDI se escala igual
// cuando falta alguna, y el QuickDASH es ((suma / n) − 1) × 25. Traen su `calcular()`.
//
// ⚠️ LICENCIA — los cuatro quedan como `requiere_autorizacion` (decisión del dueño: "marcados como
// que hay que conseguir licencia"). Quién la da, verificado el 2026-10-25 (BIBLIOGRAFIA §9.10-9.13):
//   · ODI      → © Jeremy Fairbank; licencia vía Mapi Research Trust (ePROVIDE).
//   · NDI      → © Howard Vernon; todo uso sujeto a permiso del autor.
//   · QuickDASH→ © Institute for Work & Health; gratis solo para uso clínico o investigación sin fines
//                de lucro, prohibido incorporarlo a un producto que se venda sin permiso escrito, y
//                prohibido modificarlo.
//   · LEFS     → © J. M. Binkley; no hay términos publicados: pedir permiso.
// ⚠️ TRADUCCIÓN — igual que el resto (cuestionarios.js, punto 2): los textos son NUESTROS, no las
// versiones validadas. No sirven para reportar un puntaje como el del instrumento.
//
// No importa nada de cuestionarios.js (él importa este archivo): mismo motivo que psqi.js.
import { traductor, idiomaInstalacion } from "../i18n/index.js";

const tq = (clave, vars) => traductor(idiomaInstalacion())(clave, vars);

function rotular(base, claves) {
  const o = { ...base };
  for (const [prop, clave] of Object.entries(claves)) {
    Object.defineProperty(o, prop, { get: () => tq(clave), enumerable: true, configurable: true });
  }
  return o;
}

const TRADUCCION_SIN_VALIDAR = { es: "propia_sin_validar", en: "propia_sin_validar_retrotraducida", pt: "propia_sin_validar" };

const licencia = (k) => ({
  estado: "requiere_autorizacion",
  get nota() { return tq(`cuest.${k}.nota`); },
  traduccion: TRADUCCION_SIN_VALIDAR,
  get fuente() { return tq(`cuest.${k}.fuente`); },
});

const encabezado = (k) => ({
  get nombre() { return tq(`cuest.${k}.nombre`); },
  get descripcion() { return tq(`cuest.${k}.descripcion`); },
  get tituloPublico() { return tq(`cuest.${k}.titulo`); },
  get subtituloPublico() { return tq(`cuest.${k}.subtitulo`); },
});

/**
 * Una sección de seis frases (0 a 5), el formato del ODI y del NDI: cada sección tiene sus propias
 * frases, así que cada opción tiene su rótulo. `opcional` porque los dos instrumentos admiten
 * secciones sin contestar (la vida sexual en el ODI, manejar en el NDI); el mínimo lo pone calcular().
 */
const seccion = (k, n) => rotular(
  { key: `s${n}`, tipo: "opciones", opcional: true,
    opciones: [0, 1, 2, 3, 4, 5].map((valor) => rotular({ valor }, { label: `cuest.${k}.s${n}.o${valor}` })) },
  { texto: `cuest.${k}.s${n}` },
);

const contestadas = (def, r) => def.items.filter((it) => r[it.key] !== undefined && r[it.key] !== null && r[it.key] !== "");

// ── ODI — Oswestry Disability Index 2.1a ─────────────────────────────────────────────────────
// Fairbank y Pynsent, Spine 2000. Diez secciones de 0 a 5; el puntaje es la suma sobre 5 × las
// secciones contestadas, en %. Con más de dos secciones sin contestar no se puntúa (decisión
// nuestra: el original solo dice cómo ajustar si falta alguna). Bandas de Fairbank.
export const ODI = {
  ...encabezado("odi"),
  version: "1.0",
  licencia: licencia("odi"),
  items: Array.from({ length: 10 }, (_, i) => seccion("odi", i + 1)),
  corte: null,
  calcular(r) {
    const hechas = contestadas(this, r);
    if (hechas.length < 8) return null;
    const suma = hechas.reduce((s, it) => s + Number(r[it.key]), 0);
    return { total: Math.round((suma / (5 * hechas.length)) * 100), max: 100, contestadas: hechas.length };
  },
  interpretar(total) {
    const detalle = tq("cuest.odi.detalle");
    const banda = total <= 20 ? "minima" : total <= 40 ? "moderada" : total <= 60 ? "severa" : total <= 80 ? "invalidante" : "postrado";
    return { nivel: total <= 20 ? "bajo" : total <= 40 ? "medio" : "alto", label: tq(`cuest.odi.${banda}`), detalle };
  },
};

// ── NDI — Neck Disability Index ──────────────────────────────────────────────────────────────
// Vernon y Mior, JMPT 1991. Diez secciones de 0 a 5, total 0-50. Si faltan secciones (hasta dos,
// decisión nuestra) se escala a 50 con la misma proporción que el ODI. Bandas de Vernon.
export const NDI = {
  ...encabezado("ndi"),
  version: "1.0",
  licencia: licencia("ndi"),
  items: Array.from({ length: 10 }, (_, i) => seccion("ndi", i + 1)),
  corte: null,
  calcular(r) {
    const hechas = contestadas(this, r);
    if (hechas.length < 8) return null;
    const suma = hechas.reduce((s, it) => s + Number(r[it.key]), 0);
    return { total: Math.round((suma / (5 * hechas.length)) * 50), max: 50, contestadas: hechas.length };
  },
  interpretar(total) {
    const detalle = tq("cuest.ndi.detalle");
    const banda = total <= 4 ? "sin" : total <= 14 ? "leve" : total <= 24 ? "moderada" : total <= 34 ? "severa" : "completa";
    return { nivel: total <= 14 ? "bajo" : total <= 24 ? "medio" : "alto", label: tq(`cuest.ndi.${banda}`), detalle };
  },
};

// ── QuickDASH ────────────────────────────────────────────────────────────────────────────────
// Beaton et al., JBJS Am 2005. Once ítems de 1 a 5 con cinco escalas de respuesta distintas.
// Puntaje: ((suma / n) − 1) × 25, de 0 (sin discapacidad) a 100; no se puntúa con más de UN ítem
// sin contestar (regla del original). Sin bandas publicadas: se reporta el número.
const escalaQd = (nombre) => [1, 2, 3, 4, 5].map((valor) => rotular({ valor }, { label: `cuest.quickdash.esc.${nombre}.${valor}` }));
const QD_ESCALAS = { dificultad: escalaQd("dificultad"), interferencia: escalaQd("interferencia"), limitacion: escalaQd("limitacion"), intensidad: escalaQd("intensidad"), sueno: escalaQd("sueno") };
const QD_ITEMS = ["dificultad", "dificultad", "dificultad", "dificultad", "dificultad", "dificultad", "interferencia", "limitacion", "intensidad", "intensidad", "sueno"];

export const QUICKDASH = {
  ...encabezado("quickdash"),
  version: "1.0",
  licencia: licencia("quickdash"),
  items: QD_ITEMS.map((esc, i) => rotular(
    { key: `q${i + 1}`, tipo: "opciones", opcional: true, opciones: QD_ESCALAS[esc] },
    i === 0 ? { texto: "cuest.quickdash.q1", antes: "cuest.quickdash.antesDificultad" }
      : i === 6 ? { texto: "cuest.quickdash.q7", antes: "cuest.quickdash.antesSemana" }
      : { texto: `cuest.quickdash.q${i + 1}` },
  )),
  corte: null,
  calcular(r) {
    const hechas = contestadas(this, r);
    if (hechas.length < 10) return null;
    const suma = hechas.reduce((s, it) => s + Number(r[it.key]), 0);
    return { total: Math.round(((suma / hechas.length) - 1) * 25 * 10) / 10, max: 100, contestadas: hechas.length };
  },
  interpretar() {
    return { nivel: null, label: tq("cuest.quickdash.lectura"), detalle: tq("cuest.quickdash.detalle") };
  },
};

// ── LEFS — Lower Extremity Functional Scale ──────────────────────────────────────────────────
// Binkley et al., Phys Ther 1999. Veinte actividades de 0 (dificultad extrema o no puede) a 4 (sin
// dificultad), total 0-80. AL REVÉS que los demás: más puntaje es MEJOR función (`mejor: "mas"`,
// que lee la comparación y el informe). Suma simple: no trae calcular().
const LEFS_ESCALA = [0, 1, 2, 3, 4].map((valor) => rotular({ valor }, { label: `cuest.lefs.esc.${valor}` }));

export const LEFS = {
  ...encabezado("lefs"),
  version: "1.0",
  licencia: licencia("lefs"),
  mejor: "mas",
  items: Array.from({ length: 20 }, (_, i) => rotular(
    { key: `l${i + 1}`, tipo: "opciones", opciones: LEFS_ESCALA },
    i === 0 ? { texto: "cuest.lefs.l1", antes: "cuest.lefs.antes" } : { texto: `cuest.lefs.l${i + 1}` },
  )),
  corte: null,
  interpretar(total) {
    // Sin bandas publicadas en el original: el porcentaje de la función máxima, que es como se lee.
    return { nivel: total >= 60 ? "bajo" : total >= 40 ? "medio" : "alto", label: tq("cuest.lefs.lectura", { pct: Math.round((total / 80) * 100) }), detalle: tq("cuest.lefs.detalle") };
  },
};
