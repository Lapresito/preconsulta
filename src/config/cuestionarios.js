// CUESTIONARIOS VALIDADOS (migración 0033, D114/D115).
//
// Las definiciones viven acá y no en la base, mismo criterio que los catálogos clínicos: no son
// dato de paciente, son contenido versionado que tiene que viajar con el código. Y hay una razón
// extra: **el proceso público las necesita para renderizar el formulario**, y los dos procesos
// comparten `src/` — poniéndolas acá, el público las tiene sin que haya que publicarlas.
//
// EL PUNTAJE NO SE GUARDA, SE DERIVA (D114). Se guardan las respuestas crudas y `puntuar()`
// calcula el total al leer. Mismo criterio que D59 con la temporalidad y que los grados del
// fenotipo: si mañana se corrige un umbral o una regla de inversión, todas las tomas ya cargadas
// se releen con el criterio nuevo. Guardar el total las dejaría congeladas con la regla vieja.
//
// ⚠️⚠️ DOS ADVERTENCIAS QUE HAY QUE LEER ANTES DE USAR ESTO CON UN PACIENTE REAL ⚠️⚠️
//
// 1. LICENCIA. Ninguno de estos instrumentos tiene licencia comercial resuelta. Se cargaron para
//    DESARROLLO por decisión explícita del dueño (2026-08-26): es una instalación local, la usan
//    dos personas, y no tenía sentido frenar el motor entero esperando un trámite. Cada
//    definición declara su `licencia.estado`, y /admin/cuestionarios lo muestra. Antes de
//    instalar esto en otra clínica —o de venderlo— hay que resolverlo instrumento por
//    instrumento. Ver docs/tecnico/TODO.md §Bloqueos.
//
// 2. TRADUCCIÓN. Los textos en español de acá abajo son una traducción NUESTRA del original en
//    inglés, no la versión validada al español. Un instrumento validado tiene traducciones
//    validadas aparte, con su propio estudio psicométrico: **una traducción propia invalida las
//    propiedades psicométricas del original**, incluido el punto de corte. Alcanza para probar el
//    motor y para que Felipe vea cómo se refleja lo respondido; no alcanza para publicar un
//    puntaje como si fuera el del instrumento. `licencia.traduccion` lo deja declarado en cada uno.
//
// 3. LOS TRES IDIOMAS (D127). Traducir un instrumento validado tiene el mismo problema en
//    inglés y en portugués que en español, y en inglés tiene uno PEOR: como el original es
//    inglés, una retro-traducción de nuestro español SE PARECE al instrumento sin serlo, que es
//    la forma más engañosa de estar mal. Por eso `licencia.traduccion` dejó de ser un string y
//    pasó a ser un mapa POR IDIOMA: los tres declaran `propia_sin_validar`, y el inglés además
//    dice que es retro-traducción. Ninguno de los tres sirve para reportar un puntaje.
//
// 4. NO TODOS REQUIEREN AUTORIZACIÓN (D138). `licencia.estado` tiene tres valores: `libre`
//    (GAD-7 y PHQ-9: se pueden reproducir y traducir sin permiso), `requiere_autorizacion` y
//    `sin_resolver`. Que un instrumento sea libre NO arregla el punto 2: la traducción sigue siendo
//    nuestra y el corte sigue siendo el del original.
//
// Bibliografía y detalle de qué se tomó de cada fuente: docs/tecnico/BIBLIOGRAFIA-CLINICA.md §9.
import { traductor, idiomaInstalacion, idiomaInfo } from "../i18n/index.js";
import { PSQI, formatearHora } from "./psqi.js";
import { ODI, NDI, QUICKDASH, LEFS } from "./cuestionariosFuncion.js";

const tq = (clave, vars) => traductor(idiomaInstalacion())(clave, vars);

/** Un objeto con propiedades resueltas al leerlas. `{ label: "clave.i18n" }` → getter. */
function rotular(base, claves) {
  const o = { ...base };
  for (const [prop, clave] of Object.entries(claves)) {
    Object.defineProperty(o, prop, { get: () => tq(clave), enumerable: true, configurable: true });
  }
  return o;
}

// El estado de la traducción, por idioma. Es lo que hace verificable la advertencia de arriba.
const TRADUCCION_SIN_VALIDAR = {
  es: "propia_sin_validar",
  en: "propia_sin_validar_retrotraducida",
  pt: "propia_sin_validar",
};

// ── Tipos de ítem ────────────────────────────────────────────────────────────────────────────
// `numerica`  — escala con anclas en las puntas. 0-10 por defecto (el Örebro); `min`/`max` la
//               cambian (el NPQ va de 0 a 6).
// `opciones`  — lista cerrada con un valor por opción (Likert, o categorías con puntaje propio).
// Se mantienen dos y no uno genérico porque se renderizan distinto: una escala de 0 a 10 es un
// slider con dos rótulos, un Likert es una lista de radios con texto en cada uno.

const LIKERT_ACUERDO = [1, 2, 3, 4].map(
  (valor) => rotular({ valor }, { label: `cuest.likert.${valor}` })
);

// Otras propiedades de un ítem (D138), todas opcionales:
//   `subescala` — key de `def.subescalas`: puntuar() suma aparte cada una (DHI, NPQ).
//   `opcional`  — puede quedar sin contestar sin invalidar la toma (la pregunta de dificultad
//                 del PHQ-9, que el original indica solo "si marcaste algún problema").
//   `puntua`    — false: se muestra y se guarda, pero no suma al total.
//   `avisoSi`   — { mayorQue }: si la respuesta lo supera, el formulario le muestra `aviso` al
//                 paciente en el momento (la pregunta 9 del PHQ-9).
//   `antes`     — un enunciado que se muestra arriba del ítem: abre una parte nueva del mismo
//                 instrumento (la parte B del CSI).

// Las escalas de respuesta de la batería vestibular.
const FRECUENCIA_2_SEMANAS = [0, 1, 2, 3].map((valor) => rotular({ valor }, { label: `cuest.frec2sem.${valor}` }));
const FRECUENCIA_5 = [0, 1, 2, 3, 4].map((valor) => rotular({ valor }, { label: `cuest.frec5.${valor}` }));
// El DHI puntúa Sí 4 / A veces 2 / No 0: no son valores contiguos, y así se guardan.
const SI_AVECES_NO = [
  rotular({ valor: 4 }, { label: "comun.si" }),
  rotular({ valor: 2 }, { label: "cuest.aVeces" }),
  rotular({ valor: 0 }, { label: "comun.no" }),
];
const DIFICULTAD_PHQ = [0, 1, 2, 3].map((valor) => rotular({ valor }, { label: `cuest.phq9.dif.${valor}` }));
// La parte B del CSI: sí/no, no puntúa. 1/0 y no texto porque el motor guarda enteros.
const SI_NO = [rotular({ valor: 1 }, { label: "comun.si" }), rotular({ valor: 0 }, { label: "comun.no" })];

const subescala = (key, clave) => rotular({ key }, { label: clave });

// A qué subescala va cada ítem, en el orden original. Constantes y no letras sueltas para que se
// lea sin la tabla al lado.
const [FISICA, EMOCIONAL, FUNCIONAL] = ["fisica", "emocional", "funcional"];
// ⚠️ El ítem 8 es FÍSICO. Hay fichas públicas que lo marcan como funcional; con eso la subescala
// física sumaría 24 y la funcional 40, y el original es 28 / 36 / 36. Ver BIBLIOGRAFIA-CLINICA.md §9.3.
const DHI_SUBESCALAS = [
  FISICA, EMOCIONAL, FUNCIONAL, FISICA, FUNCIONAL, FUNCIONAL, FUNCIONAL, FISICA, EMOCIONAL, EMOCIONAL,
  FISICA, FUNCIONAL, FISICA, FUNCIONAL, EMOCIONAL, FUNCIONAL, FISICA, EMOCIONAL, FUNCIONAL, EMOCIONAL,
  EMOCIONAL, EMOCIONAL, EMOCIONAL, FUNCIONAL, FISICA,
];
const [POSTURA, MOVIMIENTO, VISUAL] = ["postura", "movimiento", "visual"];
const NPQ_SUBESCALAS = [
  MOVIMIENTO, VISUAL, POSTURA, VISUAL, MOVIMIENTO, POSTURA, POSTURA, VISUAL, MOVIMIENTO, VISUAL, POSTURA, MOVIMIENTO,
];

// El GAD-7 y el PHQ-9 llevan DOS lecturas del mismo total: el corte de la población peruana del
// estudio de Migue y el convencional. Se muestran las dos porque ninguna es "la correcta" para
// una consulta en Uruguay, y elegir una en silencio sería decidir por Felipe.
const resultadoCribado = (positivo) => tq(positivo ? "cuest.positivo" : "cuest.negativo");

export const CUESTIONARIOS = {
  // ──────────────────────────────────────────────────────────────────────────────────────────
  // Örebro corto (ÖMPSQ-10) — screening de banderas amarillas. Se eligió como primero porque es
  // el que engancha directo con los MODULADORES del fenotipado que ya están implementados
  // (sueño, ansiedad, ánimo, miedo-evitación): lo que el paciente responde acá es exactamente lo
  // que Felipe hoy tiene que inferir de la charla.
  // ──────────────────────────────────────────────────────────────────────────────────────────
  orebro10: {
    // ⚠️ Getters escritos a mano y NO un spread de `rotular(...)`: el spread evalúa el getter al
    // construir el objeto literal, y ahí mismo se congela el idioma de arranque. Es la misma
    // trampa que documenta catalogos.js, y se coló acá en el primer intento.
    get nombre() { return tq("cuest.orebro10.nombre"); },
    version: "1.0",
    get descripcion() { return tq("cuest.orebro10.descripcion"); },
    get tituloPublico() { return tq("cuest.orebro10.titulo"); },
    get subtituloPublico() { return tq("cuest.orebro10.subtitulo"); },
    licencia: {
      estado: "sin_resolver",
      get nota() { return tq("cuest.orebro10.nota"); },
      traduccion: TRADUCCION_SIN_VALIDAR,
      get fuente() { return tq("cuest.orebro10.fuente"); },
    },
    // Los ítems 3, 4 y 8 se invierten (10 − respuesta): están redactados en la dirección
    // contraria al resto, así que sin invertirlos el total mezclaría señales opuestas.
    items: [
      rotular({ key: "duracion", tipo: "opciones", opciones: Array.from({ length: 10 }, (_, i) =>
        rotular({ valor: i + 1 }, { label: `cuest.orebro10.dur.${i + 1}` })) },
        { texto: "cuest.orebro10.duracion" }),
      rotular({ key: "intensidad", tipo: "numerica" }, {
        texto: "cuest.orebro10.intensidad",
        anclaBaja: "cuest.orebro10.intensidad.baja", anclaAlta: "cuest.orebro10.intensidad.alta" }),
      rotular({ key: "trabajo_liviano", tipo: "numerica", invertido: true }, {
        texto: "cuest.orebro10.trabajo_liviano",
        anclaBaja: "cuest.orebro10.noPuedo", anclaAlta: "cuest.orebro10.puedoSinDolor" }),
      rotular({ key: "sueno", tipo: "numerica", invertido: true }, {
        texto: "cuest.orebro10.sueno",
        anclaBaja: "cuest.orebro10.noPuedo", anclaAlta: "cuest.orebro10.puedoSinDolor" }),
      rotular({ key: "tension", tipo: "numerica" }, {
        texto: "cuest.orebro10.tension",
        anclaBaja: "cuest.orebro10.tension.baja", anclaAlta: "cuest.orebro10.tension.alta" }),
      rotular({ key: "animo", tipo: "numerica" }, {
        texto: "cuest.orebro10.animo",
        anclaBaja: "cuest.orebro10.animo.baja", anclaAlta: "cuest.orebro10.animo.alta" }),
      rotular({ key: "riesgo_persistencia", tipo: "numerica" }, {
        texto: "cuest.orebro10.riesgo_persistencia",
        anclaBaja: "cuest.orebro10.riesgo.baja", anclaAlta: "cuest.orebro10.riesgo.alta" }),
      rotular({ key: "expectativa_trabajo", tipo: "numerica", invertido: true }, {
        texto: "cuest.orebro10.expectativa_trabajo",
        anclaBaja: "cuest.orebro10.expectativa.baja", anclaAlta: "cuest.orebro10.expectativa.alta" }),
      rotular({ key: "parar_actividad", tipo: "numerica" }, {
        texto: "cuest.orebro10.parar_actividad",
        anclaBaja: "cuest.orebro10.acuerdo.baja", anclaAlta: "cuest.orebro10.acuerdo.alta" }),
      rotular({ key: "evitar_actividad", tipo: "numerica" }, {
        texto: "cuest.orebro10.evitar_actividad",
        anclaBaja: "cuest.orebro10.acuerdo.baja", anclaAlta: "cuest.orebro10.acuerdo.alta" }),
    ],
    // Punto de corte >50 = mayor riesgo estimado de discapacidad laboral futura.
    // ⚠️ Ese corte está validado para el instrumento ORIGINAL, no para esta traducción.
    corte: 50,
    interpretar(total) {
      return total > 50
        ? { nivel: "alto", label: tq("cuest.orebro10.riesgoAlto"), detalle: tq("cuest.orebro10.detalleAlto") }
        : { nivel: "bajo", label: tq("cuest.orebro10.riesgoBajo"), detalle: tq("cuest.orebro10.detalleBajo") };
    },
  },

  // ──────────────────────────────────────────────────────────────────────────────────────────
  // Tampa 11 (TSK-11) — kinesiofobia. Se eligió como segundo porque es estructuralmente distinto
  // del Örebro (Likert de 1 a 4 en vez de escalas 0-10), y eso obliga a que el motor sea de
  // verdad genérico en vez de estar hecho a medida de un solo formato.
  //
  // ⚠️ El TSK-11 NO tiene ítems invertidos: se construyó justamente sacándole los cuatro
  // invertidos al TSK-17. Varias fuentes secundarias repiten "los ítems 4, 8, 12 y 16 se
  // invierten" copiándolo del TSK-17 — en un cuestionario de 11 ítems no existe el 12 ni el 16.
  // ──────────────────────────────────────────────────────────────────────────────────────────
  tsk11: {
    get nombre() { return tq("cuest.tsk11.nombre"); },
    version: "1.0",
    get descripcion() { return tq("cuest.tsk11.descripcion"); },
    get tituloPublico() { return tq("cuest.tsk11.titulo"); },
    get subtituloPublico() { return tq("cuest.tsk11.subtitulo"); },
    licencia: {
      estado: "requiere_autorizacion",
      get nota() { return tq("cuest.tsk11.nota"); },
      traduccion: TRADUCCION_SIN_VALIDAR,
      get fuente() { return tq("cuest.tsk11.fuente"); },
    },
    items: Array.from({ length: 11 }, (_, i) => rotular(
      { key: `t${i + 1}`, tipo: "opciones", opciones: LIKERT_ACUERDO },
      { texto: `cuest.tsk11.t${i + 1}` },
    )),
    // Sin punto de corte publicado y consensuado: se reporta el total y una lectura por tercios,
    // declarada como orientativa. Inventar un corte sería peor que no tener ninguno.
    corte: null,
    interpretar(total) {
      const detalle = tq("cuest.tsk11.detalle");
      if (total >= 34) return { nivel: "alto", label: tq("cuest.tsk11.alta"), detalle };
      if (total >= 23) return { nivel: "medio", label: tq("cuest.tsk11.media"), detalle };
      return { nivel: "bajo", label: tq("cuest.tsk11.baja"), detalle };
    },
  },

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // D138 — LA BATERÍA VESTIBULAR (resumen de investigación de Migue, 2026-09-10). Entraron juntos
  // por decisión del dueño. El TSKd entró después (D140), cuando apareció el Google Form de Migue
  // con sus diez ítems; el PHQ-4 y el PHQ-8 también son de D140: son los que ese formulario usa
  // de verdad, en lugar del GAD-7 y el PHQ-9 que dice el protocolo. Ver TODO.md.
  // ══════════════════════════════════════════════════════════════════════════════════════════

  // DHI — Dizziness Handicap Inventory. 25 preguntas en tres subescalas. Más puntaje = más
  // discapacidad. Las franjas son las del protocolo de Migue, no las de Jacobson y Calder: las dos
  // están publicadas y no son intercambiables, así que el detalle las nombra.
  dhi: {
    get nombre() { return tq("cuest.dhi.nombre"); },
    version: "1.0",
    get descripcion() { return tq("cuest.dhi.descripcion"); },
    get tituloPublico() { return tq("cuest.dhi.titulo"); },
    get subtituloPublico() { return tq("cuest.dhi.subtitulo"); },
    licencia: {
      estado: "requiere_autorizacion",
      get nota() { return tq("cuest.dhi.nota"); },
      traduccion: TRADUCCION_SIN_VALIDAR,
      get fuente() { return tq("cuest.dhi.fuente"); },
    },
    subescalas: [
      subescala(FISICA, "cuest.dhi.sub.fisica"),
      subescala(EMOCIONAL, "cuest.dhi.sub.emocional"),
      subescala(FUNCIONAL, "cuest.dhi.sub.funcional"),
    ],
    items: DHI_SUBESCALAS.map((sub, i) => rotular(
      { key: `d${i + 1}`, tipo: "opciones", opciones: SI_AVECES_NO, subescala: sub },
      { texto: `cuest.dhi.d${i + 1}` },
    )),
    corte: null,
    interpretar(total) {
      const detalle = tq("cuest.dhi.detalle");
      if (total >= 61) return { nivel: "alto", label: tq("cuest.dhi.severa"), detalle };
      if (total >= 31) return { nivel: "medio", label: tq("cuest.dhi.moderada"), detalle };
      return { nivel: "bajo", label: tq("cuest.dhi.leve"), detalle };
    },
  },

  // NPQ — Niigata PPPD Questionnaire. 12 situaciones de 0 a 6, cuatro por cada factor que empeora
  // el MPPP. Corte total ≥27; la subescala visual ≥9 se informa aparte.
  npq: {
    get nombre() { return tq("cuest.npq.nombre"); },
    version: "1.0",
    get descripcion() { return tq("cuest.npq.descripcion"); },
    get tituloPublico() { return tq("cuest.npq.titulo"); },
    get subtituloPublico() { return tq("cuest.npq.subtitulo"); },
    licencia: {
      estado: "requiere_autorizacion",
      get nota() { return tq("cuest.npq.nota"); },
      traduccion: TRADUCCION_SIN_VALIDAR,
      get fuente() { return tq("cuest.npq.fuente"); },
    },
    subescalas: [
      subescala(POSTURA, "cuest.npq.sub.postura"),
      subescala(MOVIMIENTO, "cuest.npq.sub.movimiento"),
      subescala(VISUAL, "cuest.npq.sub.visual"),
    ],
    items: NPQ_SUBESCALAS.map((sub, i) => rotular(
      { key: `n${i + 1}`, tipo: "numerica", min: 0, max: 6, subescala: sub },
      { texto: `cuest.npq.n${i + 1}`, anclaBaja: "cuest.npq.nada", anclaAlta: "cuest.npq.insoportable" },
    )),
    corte: 27,
    corteOperador: "gte",
    interpretar(total, { subescalas = [] } = {}) {
      const visual = subescalas.find((s) => s.key === VISUAL);
      const detalle = tq("cuest.npq.detalle") + (visual && visual.total >= 9 ? ` ${tq("cuest.npq.visualAlta", { n: visual.total })}` : "");
      return total >= 27
        ? { nivel: "alto", label: tq("cuest.npq.compatible"), detalle }
        : { nivel: "bajo", label: tq("cuest.npq.bajoCorte"), detalle };
    },
  },

  // TSKd — Escala de Tampa para mareo (D140). Los diez ítems salen del Google Form de la
  // investigación de Migue: es una adaptación de la Tampa al mareo (varios ítems son los del
  // TSK-11 con "dolor" cambiado por "mareo", otros son propios). La validación que define esa
  // versión sigue sin consultarse, así que no tiene corte: se reporta el total (10 a 40) y nada más.
  tskd: {
    get nombre() { return tq("cuest.tskd.nombre"); },
    version: "1.0",
    get descripcion() { return tq("cuest.tskd.descripcion"); },
    get tituloPublico() { return tq("cuest.tskd.titulo"); },
    get subtituloPublico() { return tq("cuest.tskd.subtitulo"); },
    licencia: {
      estado: "sin_resolver",
      get nota() { return tq("cuest.tskd.nota"); },
      traduccion: TRADUCCION_SIN_VALIDAR,
      get fuente() { return tq("cuest.tskd.fuente"); },
    },
    items: Array.from({ length: 10 }, (_, i) => rotular(
      { key: `t${i + 1}`, tipo: "opciones", opciones: LIKERT_ACUERDO },
      { texto: `cuest.tskd.t${i + 1}` },
    )),
    corte: null,
    interpretar() {
      return { nivel: "bajo", label: tq("cuest.tskd.sinCorte"), detalle: tq("cuest.tskd.detalle") };
    },
  },

  // CSI — Central Sensitization Inventory. Parte A: 25 síntomas de 0 a 4. Es un cribado de
  // SÍNTOMAS: "compatible con sensibilización central", nunca "tiene sensibilización central".
  // Parte B (D140, versión 1.1): diez diagnósticos previos, sí/no. No puntúa —tampoco en el
  // original—: está para que Felipe lea qué diagnósticos de la familia ya trae el paciente.
  csi: {
    get nombre() { return tq("cuest.csi.nombre"); },
    version: "1.1",
    get descripcion() { return tq("cuest.csi.descripcion"); },
    get tituloPublico() { return tq("cuest.csi.titulo"); },
    get subtituloPublico() { return tq("cuest.csi.subtitulo"); },
    licencia: {
      estado: "requiere_autorizacion",
      get nota() { return tq("cuest.csi.nota"); },
      traduccion: TRADUCCION_SIN_VALIDAR,
      get fuente() { return tq("cuest.csi.fuente"); },
    },
    items: [
      ...Array.from({ length: 25 }, (_, i) => rotular(
        { key: `c${i + 1}`, tipo: "opciones", opciones: FRECUENCIA_5 },
        { texto: `cuest.csi.c${i + 1}` },
      )),
      ...Array.from({ length: 10 }, (_, i) => rotular(
        { key: `b${i + 1}`, tipo: "opciones", opciones: SI_NO, puntua: false },
        i === 0 ? { texto: `cuest.csi.b${i + 1}`, antes: "cuest.csi.parteB" } : { texto: `cuest.csi.b${i + 1}` },
      )),
    ],
    corte: 40,
    corteOperador: "gte",
    interpretar(total) {
      const detalle = tq("cuest.csi.detalle");
      if (total >= 60) return { nivel: "alto", label: tq("cuest.csi.extremo"), detalle };
      if (total >= 50) return { nivel: "alto", label: tq("cuest.csi.severo"), detalle };
      if (total >= 40) return { nivel: "medio", label: tq("cuest.csi.moderado"), detalle };
      if (total >= 30) return { nivel: "bajo", label: tq("cuest.csi.leve"), detalle };
      return { nivel: "bajo", label: tq("cuest.csi.subclinico"), detalle };
    },
  },

  // GAD-7 — síntomas de ansiedad en las últimas dos semanas.
  gad7: {
    get nombre() { return tq("cuest.gad7.nombre"); },
    version: "1.0",
    get descripcion() { return tq("cuest.gad7.descripcion"); },
    get tituloPublico() { return tq("cuest.gad7.titulo"); },
    get subtituloPublico() { return tq("cuest.frec2sem.enunciado"); },
    licencia: {
      estado: "libre",
      get nota() { return tq("cuest.libreNota"); },
      traduccion: TRADUCCION_SIN_VALIDAR,
      get fuente() { return tq("cuest.gad7.fuente"); },
    },
    items: Array.from({ length: 7 }, (_, i) => rotular(
      { key: `g${i + 1}`, tipo: "opciones", opciones: FRECUENCIA_2_SEMANAS },
      { texto: `cuest.gad7.g${i + 1}` },
    )),
    // El corte que cuenta el dashboard es el de la población peruana (≥8); el detalle da los dos.
    corte: 8,
    corteOperador: "gte",
    interpretar(total) {
      const banda = total >= 15 ? "graves" : total >= 10 ? "moderados" : total >= 5 ? "leves" : "minimos";
      return {
        nivel: total >= 10 ? "alto" : total >= 8 ? "medio" : "bajo",
        label: tq(`cuest.sintomas.${banda}`),
        detalle: tq("cuest.gad7.detalle", { resLocal: resultadoCribado(total >= 8), resConv: resultadoCribado(total >= 10) }),
      };
    },
  },

  // PHQ-9 — síntomas depresivos en las últimas dos semanas.
  //
  // ⚠️ LA PREGUNTA 9 NO SE LEE POR EL TOTAL. Pregunta por ideas de muerte o de autolesión: un
  // paciente puede sumar 3 puntos en total y haberla contestado. Por eso tiene `alerta()`, que la
  // ficha y la campanita muestran aparte y en rojo, y `avisoSi`, que en el formulario le muestra
  // al paciente en el momento a dónde llamar — Felipe no va a leer la respuesta enseguida.
  phq9: {
    get nombre() { return tq("cuest.phq9.nombre"); },
    version: "1.0",
    get descripcion() { return tq("cuest.phq9.descripcion"); },
    get tituloPublico() { return tq("cuest.phq9.titulo"); },
    get subtituloPublico() { return tq("cuest.frec2sem.enunciado"); },
    licencia: {
      estado: "libre",
      get nota() { return tq("cuest.libreNota"); },
      traduccion: TRADUCCION_SIN_VALIDAR,
      get fuente() { return tq("cuest.phq9.fuente"); },
    },
    items: [
      ...Array.from({ length: 8 }, (_, i) => rotular(
        { key: `p${i + 1}`, tipo: "opciones", opciones: FRECUENCIA_2_SEMANAS },
        { texto: `cuest.phq9.p${i + 1}` },
      )),
      rotular(
        { key: "p9", tipo: "opciones", opciones: FRECUENCIA_2_SEMANAS, avisoSi: { mayorQue: 0 } },
        { texto: "cuest.phq9.p9", aviso: "cuest.phq9.avisoPaciente" },
      ),
      rotular(
        { key: "funcional", tipo: "opciones", opciones: DIFICULTAD_PHQ, opcional: true, puntua: false },
        { texto: "cuest.phq9.funcional" },
      ),
    ],
    corte: 7,
    corteOperador: "gte",
    interpretar(total) {
      const banda = total >= 20 ? "graves" : total >= 15 ? "moderadamenteGraves" : total >= 10 ? "moderados" : total >= 5 ? "leves" : "minimos";
      return {
        nivel: total >= 10 ? "alto" : total >= 7 ? "medio" : "bajo",
        label: tq(`cuest.sintomas.${banda}`),
        detalle: tq("cuest.phq9.detalle", { resLocal: resultadoCribado(total >= 7), resConv: resultadoCribado(total >= 10) }),
      };
    },
    alerta(respuestas = {}) {
      const valor = Number(respuestas.p9);
      if (!(valor > 0)) return null;
      const opcion = FRECUENCIA_2_SEMANAS.find((o) => o.valor === valor);
      return tq("cuest.phq9.alerta", { respuesta: opcion ? opcion.label : String(valor) });
    },
  },

  // PHQ-4 (D140) — lo que el Google Form de Migue titula "Trastorno de Ansiedad General": no es
  // el GAD-7 sino sus dos primeras preguntas (GAD-2) más las dos primeras del PHQ-9 (PHQ-2). Se
  // carga con su nombre real porque es un instrumento propio, con sus propios cortes. Los textos
  // de los ítems son los mismos del GAD-7 y el PHQ-9: son literalmente esas preguntas.
  phq4: {
    get nombre() { return tq("cuest.phq4.nombre"); },
    version: "1.0",
    get descripcion() { return tq("cuest.phq4.descripcion"); },
    get tituloPublico() { return tq("cuest.phq4.titulo"); },
    get subtituloPublico() { return tq("cuest.frec2sem.enunciado"); },
    licencia: {
      estado: "libre",
      get nota() { return tq("cuest.libreNota"); },
      traduccion: TRADUCCION_SIN_VALIDAR,
      get fuente() { return tq("cuest.phq4.fuente"); },
    },
    subescalas: [
      subescala("ansiedad", "cuest.phq4.sub.ansiedad"),
      subescala("depresion", "cuest.phq4.sub.depresion"),
    ],
    items: [
      rotular({ key: "g1", tipo: "opciones", opciones: FRECUENCIA_2_SEMANAS, subescala: "ansiedad" }, { texto: "cuest.gad7.g1" }),
      rotular({ key: "g2", tipo: "opciones", opciones: FRECUENCIA_2_SEMANAS, subescala: "ansiedad" }, { texto: "cuest.gad7.g2" }),
      rotular({ key: "p1", tipo: "opciones", opciones: FRECUENCIA_2_SEMANAS, subescala: "depresion" }, { texto: "cuest.phq9.p1" }),
      rotular({ key: "p2", tipo: "opciones", opciones: FRECUENCIA_2_SEMANAS, subescala: "depresion" }, { texto: "cuest.phq9.p2" }),
      rotular(
        { key: "funcional", tipo: "opciones", opciones: DIFICULTAD_PHQ, opcional: true, puntua: false },
        { texto: "cuest.phq9.funcional" },
      ),
    ],
    // El corte que importa no es el del total sino el de cada subescala (≥3); el total da la banda.
    corte: 6,
    corteOperador: "gte",
    interpretar(total, { subescalas = [] } = {}) {
      const banda = total >= 9 ? "graves" : total >= 6 ? "moderados" : total >= 3 ? "leves" : "minimos";
      const sub = (key) => resultadoCribado((subescalas.find((s) => s.key === key)?.total ?? 0) >= 3);
      return {
        nivel: total >= 9 ? "alto" : total >= 6 ? "medio" : "bajo",
        label: tq(`cuest.sintomas.${banda}`),
        detalle: tq("cuest.phq4.detalle", { ansiedad: sub("ansiedad"), depresion: sub("depresion") }),
      };
    },
  },

  // PHQ-8 (D140) — el PHQ-9 sin la pregunta 9, que es lo que trae el Google Form de Migue. Es un
  // instrumento validado por derecho propio (pensado justamente para cuando no hay quien atienda
  // en el momento una respuesta de riesgo), con corte ≥10. El corte peruano ≥7 es del PHQ-9 y no
  // se trae: no está estudiado sobre ocho ítems.
  phq8: {
    get nombre() { return tq("cuest.phq8.nombre"); },
    version: "1.0",
    get descripcion() { return tq("cuest.phq8.descripcion"); },
    get tituloPublico() { return tq("cuest.phq9.titulo"); },
    get subtituloPublico() { return tq("cuest.frec2sem.enunciado"); },
    licencia: {
      estado: "libre",
      get nota() { return tq("cuest.libreNota"); },
      traduccion: TRADUCCION_SIN_VALIDAR,
      get fuente() { return tq("cuest.phq8.fuente"); },
    },
    items: [
      ...Array.from({ length: 8 }, (_, i) => rotular(
        { key: `p${i + 1}`, tipo: "opciones", opciones: FRECUENCIA_2_SEMANAS },
        { texto: `cuest.phq9.p${i + 1}` },
      )),
      rotular(
        { key: "funcional", tipo: "opciones", opciones: DIFICULTAD_PHQ, opcional: true, puntua: false },
        { texto: "cuest.phq9.funcional" },
      ),
    ],
    corte: 10,
    corteOperador: "gte",
    interpretar(total) {
      const banda = total >= 20 ? "graves" : total >= 15 ? "moderadamenteGraves" : total >= 10 ? "moderados" : total >= 5 ? "leves" : "minimos";
      return {
        nivel: total >= 10 ? "alto" : total >= 5 ? "medio" : "bajo",
        label: tq(`cuest.sintomas.${banda}`),
        detalle: tq("cuest.phq8.detalle", { res: resultadoCribado(total >= 10) }),
      };
    },
  },

  // PSQI (D142) — calidad de sueño. En su propio archivo porque puntúa por componentes y no
  // sumando ítems: ver src/config/psqi.js.
  psqi: PSQI,

  // D160 — función por región, para el informe a traumatología. Ver src/config/cuestionariosFuncion.js.
  odi: ODI,
  ndi: NDI,
  quickdash: QUICKDASH,
  lefs: LEFS,
};

/** Los que se pueden mandar hoy. Derivado, para no mantener una segunda lista a mano. */
// ⚠️ Sin spread sobre `c`: congelaría los rótulos en el idioma de arranque (D127). Se delega.
export const CUESTIONARIOS_LISTA = Object.entries(CUESTIONARIOS).map(([key, c]) =>
  Object.defineProperties({ key }, {
    nombre: { get: () => c.nombre, enumerable: true },
    descripcion: { get: () => c.descripcion, enumerable: true },
    tituloPublico: { get: () => c.tituloPublico, enumerable: true },
    subtituloPublico: { get: () => c.subtituloPublico, enumerable: true },
    version: { value: c.version, enumerable: true },
    licencia: { value: c.licencia, enumerable: true },
    items: { value: c.items, enumerable: true },
    corte: { value: c.corte, enumerable: true },
    corteOperador: { value: c.corteOperador || "gt", enumerable: true },
    subescalas: { value: c.subescalas || [], enumerable: true },
    interpretar: { value: c.interpretar, enumerable: true },
  }));

/** El rango de un ítem: el de la escala en las numéricas, el de sus opciones en las demás. */
// D142 — dos tipos más, los del PSQI: `hora` (minutos desde la medianoche) y `cantidad` (un
// entero libre entre `min` y `max`, en la unidad en que se guarda; `factor` es lo que el formulario
// multiplica antes de mandar, p. ej. horas → minutos).
export function rangoItem(item) {
  if (item.tipo === "numerica") return { min: item.min ?? 0, max: item.max ?? 10 };
  if (item.tipo === "hora") return { min: 0, max: 24 * 60 - 1 };
  if (item.tipo === "cantidad") return { min: item.min ?? 0, max: item.max };
  const valores = item.opciones.map((o) => o.valor);
  return { min: Math.min(...valores), max: Math.max(...valores) };
}

/**
 * Lo que el paciente contestó, en sus términos: "7/10" en una escala, la etiqueta en una lista,
 * "23:30" en una hora y "6,5 h" o "45 min" en una cantidad (D142).
 */
export function etiquetaRespuesta(item, valor) {
  if (item.tipo === "numerica") return `${valor}/${rangoItem(item).max}`;
  if (item.tipo === "hora") return formatearHora(valor);
  if (item.tipo === "cantidad") return `${(valor / (item.factor || 1)).toLocaleString(idiomaInfo(idiomaInstalacion()).locale)} ${item.sufijo}`;
  return item.opciones.find((o) => o.valor === valor)?.label ?? String(valor);
}

const sinRespuesta = (v) => v === undefined || v === null || v === "";

/**
 * Calcula el puntaje de una toma. Función PURA — no toca la base ni descifra nada.
 *
 * `respuestas` es { itemKey: valor }. Se ignora cualquier clave que no esté en la definición
 * (un ítem que se sacó del cuestionario después de que alguien lo contestara) y cualquier valor
 * fuera de rango: un puntaje mal calculado en silencio es peor que uno que no se muestra.
 *
 * Devuelve `null` si falta alguna respuesta obligatoria: un total parcial de un instrumento
 * validado no significa nada, y mostrarlo al lado de uno completo invitaría a compararlos. Los
 * ítems `opcional` pueden faltar; los que no `puntua` se validan pero no suman.
 */
export function puntuar(cuestionarioKey, respuestas) {
  const def = CUESTIONARIOS[cuestionarioKey];
  if (!def || !respuestas) return null;

  let total = 0;
  let min = 0;
  let max = 0;
  const porSubescala = new Map((def.subescalas || []).map((s) => [s.key, { key: s.key, label: s.label, total: 0, max: 0 }]));

  for (const item of def.items) {
    if (sinRespuesta(respuestas[item.key])) {
      if (item.opcional) continue;
      return null;
    }
    const bruto = Number(respuestas[item.key]);
    const { min: piso, max: techo } = rangoItem(item);
    if (!Number.isFinite(bruto) || bruto < piso || bruto > techo) return null;
    // D142: un instrumento con `calcular()` propio (el PSQI) solo usa este recorrido para validar.
    if (item.puntua === false || def.calcular) continue;

    // Los ítems invertidos están redactados en la dirección contraria al resto: sin dar vuelta
    // el valor, el total sumaría señales opuestas y el número no significaría nada.
    const aporta = item.invertido ? techo - bruto : bruto;
    total += aporta;
    // El piso importa en los que no arrancan de 0 (el TSKd va de 10 a 40): sin él, la ficha
    // mostraría "10/40" como si fuera un puntaje bajo pero no mínimo.
    min += item.invertido ? 0 : piso;
    max += techo;
    const sub = porSubescala.get(item.subescala);
    if (sub) {
      sub.total += aporta;
      sub.max += techo;
    }
  }

  if (def.calcular) {
    const calculado = def.calcular(respuestas);
    if (!calculado) return null;
    return { min: 0, ...calculado, ...def.interpretar(calculado.total, calculado) };
  }

  const subescalas = [...porSubescala.values()];
  return { total, min, max, subescalas, ...def.interpretar(total, { subescalas }) };
}

/** Si el total pasa el corte del instrumento, con su operador (`>` o `≥`). Sin corte, nunca. */
export function superaCorte(def, total) {
  if (!def || def.corte === null || def.corte === undefined) return false;
  return def.corteOperador === "gte" ? total >= def.corte : total > def.corte;
}

/**
 * Una respuesta que tiene que verse aparte del puntaje (hoy, la pregunta 9 del PHQ-9). Devuelve el
 * texto del aviso o null. Se calcula aunque la toma esté incompleta: una respuesta de riesgo no
 * deja de serlo porque falte otra pregunta.
 */
export function alertaDe(cuestionarioKey, respuestas) {
  const def = CUESTIONARIOS[cuestionarioKey];
  return def?.alerta && respuestas ? def.alerta(respuestas) : null;
}

/** Valida una respuesta cruda del formulario antes de guardarla. Devuelve null si no sirve. */
export function normalizarRespuestas(cuestionarioKey, crudas) {
  const def = CUESTIONARIOS[cuestionarioKey];
  if (!def || !crudas || typeof crudas !== "object") return null;

  const limpias = {};
  for (const item of def.items) {
    if (sinRespuesta(crudas[item.key]) && item.opcional) continue;
    const valor = Number(crudas[item.key]);
    if (!Number.isInteger(valor)) return null;

    // Todo lo que no es lista cerrada (escala, hora, cantidad) se valida por rango.
    if (item.tipo !== "opciones") {
      const { min, max } = rangoItem(item);
      if (valor < min || valor > max) return null;
    } else if (!item.opciones.some((o) => o.valor === valor)) {
      return null;
    }
    limpias[item.key] = valor;
  }
  return limpias;
}

// ── CUESTIONARIOS DENTRO DE LA PRECONSULTA (D140) ───────────────────────────────────────────
//
// La preconsulta vestibular trae la batería entera de la investigación de Migue (DHI, NPQ, TSKd,
// CSI, PHQ-4, PHQ-8). No se guardan como bloques sino como TOMAS de cuestionario, en la misma
// tabla que las que llegan por link: es lo que permite comparar el DHI del ingreso contra el del
// alta. Nacen sin episodio y se enganchan cuando Felipe confirma la preconsulta.

/** El nombre del campo de un ítem de un cuestionario dentro de la preconsulta. */
export const nombreCampoCuestionario = (cuestionarioKey, itemKey) => `cq:${cuestionarioKey}:${itemKey}`;

/**
 * Saca de un envío plano (FormData) las tomas de los cuestionarios `keys`. Función PURA: la usan
 * la ruta pública (antes de sellar), la carga manual y la persistencia (sobre lo que trae el sobre).
 *
 * Un instrumento se guarda entero o no se guarda: un total parcial no significa nada (ver puntuar()).
 *
 * @param {boolean} p.estricto   - true: incompleto o inválido devuelve `error`. false: se descarta.
 * @param {boolean} p.requeridos - false: un cuestionario sin NINGUNA respuesta se saltea sin error
 *                                 (la carga manual de Felipe). Uno empezado tiene que estar completo.
 * @returns {{ error: string|null, tomas: Array<{ cuestionarioKey, version, respuestas }> }}
 */
export function extraerCuestionarios({ data = {}, keys = [], estricto = true, requeridos = true } = {}) {
  const tomas = [];
  for (const key of keys) {
    const def = CUESTIONARIOS[key];
    if (!def) continue;

    const crudas = {};
    let alguna = false;
    let repetida = false;
    for (const item of def.items) {
      const v = data[nombreCampoCuestionario(key, item.key)];
      if (Array.isArray(v)) repetida = true;
      // Vacío → undefined y no "": Number("") es 0, y 0 es una respuesta válida en casi todos.
      const texto = v === undefined || v === null ? "" : String(v).trim();
      if (texto !== "") alguna = true;
      crudas[item.key] = texto === "" ? undefined : texto;
    }

    if (!alguna && !requeridos) continue;
    const respuestas = repetida ? null : normalizarRespuestas(key, crudas);
    if (!respuestas) {
      if (estricto) return { error: tq("cuest.errorIncompleto", { cuestionario: def.nombre }), tomas: [] };
      continue;
    }
    tomas.push({ cuestionarioKey: key, version: def.version, respuestas });
  }
  return { error: null, tomas };
}
