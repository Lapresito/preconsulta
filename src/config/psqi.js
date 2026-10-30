// PSQI — Índice de Calidad de Sueño de Pittsburgh (D142). Buysse et al., Psychiatry Res 1989.
//
// Vive en su propio archivo y no adentro de cuestionarios.js porque es el primer instrumento que
// NO se puntúa sumando ítems: las 19 preguntas forman siete COMPONENTES de 0 a 3, y varios salen
// de cuentas (minutos → banda, horas en cama → eficiencia). Por eso trae su propio `calcular()`,
// que `puntuar()` usa en lugar de la suma. Todo lo demás —validación, interpretación, el
// criterio de derivar al leer (D114)— es el del motor.
//
// Las reglas de los componentes son las de la hoja de puntuación del original ("Scoring
// Instructions", © 1989 Universidad de Pittsburgh), cotejadas el 2026-10-20. Ver
// docs/tecnico/BIBLIOGRAFIA-CLINICA.md §9.9 — incluidas las dos bandas que el original deja
// con un hueco (exactamente 85 % de eficiencia, exactamente 6 o 7 horas) y cómo se cerraron.
//
// ⚠️ Mismas advertencias que todo cuestionarios.js: la traducción es NUESTRA (hay versiones
// validadas en español y en portugués que no son este texto) y el uso requiere permiso de la
// Universidad de Pittsburgh.
//
// No importa nada de cuestionarios.js: este archivo lo importa él, y un import de vuelta haría
// que `rotular` todavía no exista cuando se evalúan los ítems de acá.
import { traductor, idiomaInstalacion } from "../i18n/index.js";

const tq = (clave, vars) => traductor(idiomaInstalacion())(clave, vars);

/** Mismo helper que cuestionarios.js: getters, para que el rótulo siga al idioma vigente (D127). */
function rotular(base, claves) {
  const o = { ...base };
  for (const [prop, clave] of Object.entries(claves)) {
    Object.defineProperty(o, prop, { get: () => tq(clave), enumerable: true, configurable: true });
  }
  return o;
}

const opciones = (prefijo) => [0, 1, 2, 3].map((valor) => rotular({ valor }, { label: `${prefijo}.${valor}` }));
const FRECUENCIA_MES = opciones("cuest.psqi.frecMes");
const CALIDAD = opciones("cuest.psqi.calidad");
const PROBLEMA = opciones("cuest.psqi.problema");
const COMPANIA = opciones("cuest.psqi.compania");

// Las razones de la pregunta 5. La "j" ("otra razón") es opcional: si no hay otra razón, el
// original la puntúa 0. Lo que el paciente quiera describir va al comentario del final.
const RAZONES_5 = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
// La pregunta 10 la contesta (o la pasa) la pareja o compañero de cuarto. El original NO la
// puntúa; se guarda porque los ronquidos y las pausas respiratorias son lo que Felipe lee para
// pensar en una derivación por apnea.
const PAREJA_10 = ["a", "b", "c", "d", "e"];

const COMPONENTES = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"];

/** Banda de 0 a 3 a partir de una suma: 0 → 0, y después de a `ancho` puntos. */
const bandaDeSuma = (suma, ancho) => (suma === 0 ? 0 : Math.min(3, Math.ceil(suma / ancho)));

const MINUTOS_DIA = 24 * 60;

export const PSQI = {
  get nombre() { return tq("cuest.psqi.nombre"); },
  version: "1.0",
  get descripcion() { return tq("cuest.psqi.descripcion"); },
  get tituloPublico() { return tq("cuest.psqi.titulo"); },
  get subtituloPublico() { return tq("cuest.psqi.subtitulo"); },
  licencia: {
    // Pittsburgh pide completar un formulario de permiso incluso para uso no comercial, y el
    // comercial necesita licencia de su oficina de transferencia tecnológica.
    estado: "requiere_autorizacion",
    get nota() { return tq("cuest.psqi.nota"); },
    traduccion: { es: "propia_sin_validar", en: "propia_sin_validar_retrotraducida", pt: "propia_sin_validar" },
    get fuente() { return tq("cuest.psqi.fuente"); },
  },
  // Los siete componentes como subescalas: la ficha y /admin/cuestionarios ya saben mostrarlas.
  subescalas: COMPONENTES.map((key) => rotular({ key }, { label: `cuest.psqi.sub.${key}` })),
  items: [
    // Horas como minutos desde la medianoche (0-1439): el motor guarda enteros.
    rotular({ key: "p1", tipo: "hora" }, { texto: "cuest.psqi.p1" }),
    rotular({ key: "p2", tipo: "cantidad", min: 0, max: 720 }, { texto: "cuest.psqi.p2", unidad: "cuest.psqi.unidadMinutos", sufijo: "cuest.psqi.sufijoMinutos" }),
    rotular({ key: "p3", tipo: "hora" }, { texto: "cuest.psqi.p3" }),
    // Se pregunta en horas (con cuartos) y se guarda en minutos: `factor` es la conversión que
    // hace el formulario antes de mandar.
    rotular({ key: "p4", tipo: "cantidad", min: 0, max: MINUTOS_DIA, factor: 60, paso: 0.25 }, { texto: "cuest.psqi.p4", unidad: "cuest.psqi.unidadHoras", sufijo: "cuest.psqi.sufijoHoras" }),
    ...RAZONES_5.map((letra) => rotular(
      { key: `p5${letra}`, tipo: "opciones", opciones: FRECUENCIA_MES, ...(letra === "j" ? { opcional: true } : {}) },
      letra === "a" ? { texto: `cuest.psqi.p5${letra}`, antes: "cuest.psqi.p5" } : { texto: `cuest.psqi.p5${letra}` },
    )),
    rotular({ key: "p6", tipo: "opciones", opciones: CALIDAD }, { texto: "cuest.psqi.p6" }),
    rotular({ key: "p7", tipo: "opciones", opciones: FRECUENCIA_MES }, { texto: "cuest.psqi.p7" }),
    rotular({ key: "p8", tipo: "opciones", opciones: FRECUENCIA_MES }, { texto: "cuest.psqi.p8" }),
    rotular({ key: "p9", tipo: "opciones", opciones: PROBLEMA }, { texto: "cuest.psqi.p9" }),
    rotular({ key: "p10", tipo: "opciones", opciones: COMPANIA, puntua: false }, { texto: "cuest.psqi.p10" }),
    ...PAREJA_10.map((letra) => rotular(
      { key: `p10${letra}`, tipo: "opciones", opciones: FRECUENCIA_MES, opcional: true, puntua: false },
      letra === "a" ? { texto: `cuest.psqi.p10${letra}`, antes: "cuest.psqi.p10antes" } : { texto: `cuest.psqi.p10${letra}` },
    )),
  ],
  // >5 = "mal dormidor" (Buysse 1989: sensibilidad 89,6 %, especificidad 86,5 %).
  // ⚠️ Validado para el original en inglés, no para esta traducción.
  corte: 5,

  /**
   * Los siete componentes y el total global (0-21). Función PURA. `puntuar()` la llama con las
   * respuestas ya validadas contra los rangos de los ítems.
   *
   * Devuelve null si las horas no permiten calcular la eficiencia (acostarse y levantarse a la
   * misma hora): un componente inventado haría un total que no es el del instrumento.
   */
  calcular(r) {
    const n = (key) => Number(r[key] ?? 0);

    // C2 — latencia: los minutos de la pregunta 2 pasados a banda, más la 5a.
    const minutos = n("p2");
    const latencia = minutos <= 15 ? 0 : minutos <= 30 ? 1 : minutos <= 60 ? 2 : 3;

    // C3 — duración. El original dice ">7 / 6-7 / 5-6 / <5 horas": 7 y 6 justas caen en 1.
    const dormido = n("p4");
    const duracion = dormido > 7 * 60 ? 0 : dormido >= 6 * 60 ? 1 : dormido >= 5 * 60 ? 2 : 3;

    // C4 — eficiencia: horas dormidas sobre horas en cama. Levantarse "antes" que acostarse es
    // cruzar la medianoche, de ahí el módulo. Dormir más de lo que se estuvo en cama es una
    // respuesta inconsistente; se topea en 100 % como hacen las implementaciones de referencia.
    const enCama = (n("p3") - n("p1") + MINUTOS_DIA) % MINUTOS_DIA;
    if (enCama === 0) return null;
    const eficiencia = Math.min(100, (dormido / enCama) * 100);
    // El original dice ">85 % / 75-84 % / 65-74 % / <65 %": 85 % justo se toma como 0.
    const efic = eficiencia >= 85 ? 0 : eficiencia >= 75 ? 1 : eficiencia >= 65 ? 2 : 3;

    const perturbaciones = RAZONES_5.slice(1).reduce((s, letra) => s + n(`p5${letra}`), 0);

    const valores = {
      c1: n("p6"),
      c2: bandaDeSuma(latencia + n("p5a"), 2),
      c3: duracion,
      c4: efic,
      c5: bandaDeSuma(perturbaciones, 9),
      c6: n("p7"),
      c7: bandaDeSuma(n("p8") + n("p9"), 2),
    };
    const subescalas = this.subescalas.map((s) => ({ key: s.key, label: s.label, total: valores[s.key], max: 3 }));
    return {
      total: subescalas.reduce((s, c) => s + c.total, 0),
      max: 21,
      subescalas,
      eficiencia: Math.round(eficiencia),
      horasEnCama: Math.round((enCama / 60) * 10) / 10,
    };
  },

  interpretar(total, { eficiencia } = {}) {
    const detalle = tq("cuest.psqi.detalle") + (eficiencia !== undefined ? ` ${tq("cuest.psqi.eficiencia", { n: eficiencia })}` : "");
    return total > 5
      ? { nivel: "alto", label: tq("cuest.psqi.mala"), detalle }
      : { nivel: "bajo", label: tq("cuest.psqi.buena"), detalle };
  },
};

/** "23:30" para una hora guardada como minutos desde la medianoche. */
export function formatearHora(minutos) {
  const h = Math.floor(minutos / 60), m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
