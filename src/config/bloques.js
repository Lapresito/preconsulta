// BLOQUES VARIABLES DE LA PRECONSULTA (D136, migración 0041).
//
// La preconsulta tiene dos partes que se guardan distinto, y esa separación es la decisión que
// sostiene todo lo demás:
//
//   · El NÚCLEO — identidad, antecedentes, motivo, dolor, body chart. Vive en columnas de
//     `consultas` y `consulta_narrativa`, y es lo que usan el dashboard, los reportes, la
//     deduplicación y el episodio. Desde acá no se toca.
//   · Los BLOQUES — preguntas que dependen de QUÉ formulario es y de lo que el paciente va
//     contestando: el painDETECT aparece solo si el dolor lleva 3 meses o más; el bloque
//     vestibular, solo en la preconsulta de mareo. Viven en `consultas.bloques` (jsonb, capa B) y
//     el texto libre en `consulta_narrativa.bloques_enc` (cifrado, capa C).
//
// Agregar una pregunta, o un bloque entero, es agregarlo acá: sin migración, sin columna, sin
// vista nueva. La contracara es que lo que vive en `bloques` no entra solo al dashboard; si un
// dato de un bloque tiene que graficarse, se decide caso por caso.
//
// LAS DEFINICIONES VIAJAN EN EL CÓDIGO, no en la base: el proceso público las necesita para
// dibujar el formulario y no tiene base (mismo criterio que cuestionarios.js). El día que el
// fisioterapeuta pueda editarlas desde el panel, habrá que publicarlas como hoy se publican los
// links.
//
// EL PUNTAJE Y LAS SEÑALES NO SE GUARDAN, SE DERIVAN AL LEER (mismo criterio que D114): si mañana
// se corrige un corte, todas las preconsultas ya recibidas se releen con el criterio nuevo.
//
// ⚠️ Las señales ASISTEN, no diagnostican (D16/D60): nunca marcan una bandera del triage ni
// cambian nada del episodio. Son texto para que Felipe lo lea y decida.
//
// 📚 De dónde sale cada criterio: docs/tecnico/BIBLIOGRAFIA-CLINICA.md §10 y §11.
import { traductor, idiomaInstalacion } from "../i18n/index.js";
import { cumple, nombreCampo } from "../../public/condiciones.js";
import { FORM_TYPES } from "./formTypes.js";
import { pretriaje, psfs } from "./bloquesPretriaje.js";
import { cierreActividad, cierreFarmacos, cierreReflexion } from "./bloquesCierre.js";
import { CUESTIONARIOS, CUESTIONARIOS_LISTA, puntuar, alertaDe, etiquetaRespuesta } from "./cuestionarios.js";

export { nombreCampo };

const tb = (clave, vars) => traductor(idiomaInstalacion())(clave, vars);

/** Largo máximo de una respuesta de texto dentro de un bloque. */
export const LARGO_TEXTO_BLOQUE = 300;

// Getters y no valores: el idioma cambia en caliente (D127). Misma trampa que catalogos.js — un
// spread sobre un objeto ya rotulado congelaría el idioma de arranque.
function rotular(base, claves) {
  const o = { ...base };
  for (const [prop, clave] of Object.entries(claves)) {
    Object.defineProperty(o, prop, { get: () => tb(clave), enumerable: true, configurable: true });
  }
  return o;
}

const opcion = (valor, clave, extra = {}) => rotular({ valor, ...extra }, { label: clave });
const opciones = (claveBase, valores) => valores.map((v) => opcion(v, `${claveBase}.${v}`));

function itemDe(bloque, key) {
  return bloque.items.find((i) => i.key === key);
}

// ── painDETECT (criba UFPC #8: completo, dentro de la rama crónica) ──────────────────────────
//
// Se pregunta SOLO si el paciente dijo que el dolor lleva 3 meses o más: es la rama que pidió el
// dueño ("si responde que sí a dolor hace más de 3 meses → preguntas para dolor crónico").
//
// La intensidad "ahora" NO se vuelve a preguntar: ya la dio en la escala del núcleo, y pedirla dos
// veces invita a que las dos respuestas no coincidan. Se muestra al lado, sacada de ahí.
//
// Puntaje (Freynhagen 2006): siete ítems sensoriales de 0 a 5, más el patrón temporal (−1 a +1),
// más 2 si el dolor irradia. Rango −1 a 38. Las tres intensidades no puntúan.
const SENSORIALES = ["ardor", "hormigueo", "roce", "electrico", "temperatura", "entumecimiento", "presion"];

const INTENSIDAD_0_5 = [0, 1, 2, 3, 4, 5].map((n) => opcion(String(n), `bq.intensidad.${n}`, { puntos: n }));

// Los cuatro dibujos del patrón temporal, como PATHS de un SVG de 120×44 con el eje en y=40 (sin
// dolor). D141: pasan de líneas quebradas a CURVAS, a pedido del dueño — los dientes de sierra
// confundían, porque el original dibuja ondas y crisis redondeadas, no picos. Siguen siendo
// redibujos y no las imágenes del cuestionario: el painDETECT tiene titular de licencia (ver
// BIBLIOGRAFIA-CLINICA §10) y copiar sus gráficos es reproducir el instrumento.
//
// Cada trazo se arma con dos piezas: una ONDA suave (el dolor de fondo) y una CRISIS (una campana
// que sube desde el fondo hasta el pico y vuelve). Escritos a mano serían cuatro tiras de números
// que nadie puede revisar a ojo.
function onda(x0, x1, base, amp, n) {
  const paso = (x1 - x0) / n;
  let d = "";
  for (let i = 0; i < n; i++) {
    const xa = x0 + paso * i;
    const y = base + (i % 2 === 0 ? -amp : amp);
    d += ` C ${xa + paso * 0.35},${y} ${xa + paso * 0.65},${y} ${xa + paso},${base}`;
  }
  return d;
}
function crisis(x0, ancho, base, pico) {
  return ` C ${x0 + ancho * 0.3},${base} ${x0 + ancho * 0.35},${pico} ${x0 + ancho / 2},${pico}` +
    ` C ${x0 + ancho * 0.65},${pico} ${x0 + ancho * 0.7},${base} ${x0 + ancho},${base}`;
}
const TRAZOS = {
  // Dolor de fondo alto, que sube y baja apenas.
  persistente_leve: `M 0,18${onda(0, 120, 18, 3, 6)}`,
  // El mismo fondo alto, y sobre él tres crisis que llegan arriba de todo.
  persistente_crisis: `M 0,20${onda(0, 14, 20, 2, 1)}${crisis(14, 22, 20, 3)}${onda(36, 50, 20, 2, 1)}` +
    `${crisis(50, 22, 20, 3)}${onda(72, 86, 20, 2, 1)}${crisis(86, 22, 20, 3)}${onda(108, 120, 20, 2, 1)}`,
  // Crisis que arrancan y terminan EN el eje: entre una y otra no duele.
  crisis_sin_dolor: `M 0,40 L 10,40${crisis(10, 24, 40, 6)} L 48,40${crisis(48, 24, 40, 5)} L 86,40${crisis(86, 24, 40, 7)} L 120,40`,
  // Crisis más seguidas sobre un dolor de fondo bajo, que nunca llega al eje.
  crisis_con_dolor: `M 0,31 L 6,31${crisis(6, 20, 31, 6)} L 32,31${crisis(32, 20, 31, 5)} L 58,31${crisis(58, 20, 31, 7)}` +
    ` L 84,31${crisis(84, 20, 31, 5)} L 120,31`,
};

const paindetect = {
  key: "paindetect",
  version: "1.0",
  get titulo() { return tb("bq.paindetect.titulo"); },
  get intro() { return tb("bq.paindetect.intro"); },
  mostrarSi: { campo: "dolorCronico", igual: "Sí" },
  items: [
    rotular({ key: "peor4sem", tipo: "escala", min: 0, max: 10, requerido: true },
      { texto: "bq.paindetect.peor4sem", anclaBaja: "bq.anclaSinDolor", anclaAlta: "bq.anclaMaximo" }),
    rotular({ key: "promedio4sem", tipo: "escala", min: 0, max: 10, requerido: true },
      { texto: "bq.paindetect.promedio4sem", anclaBaja: "bq.anclaSinDolor", anclaAlta: "bq.anclaMaximo" }),
    rotular({
      key: "curso", tipo: "trayectoria", requerido: true,
      opciones: [
        opcion("persistente_leve", "bq.paindetect.curso.persistente_leve", { puntos: 0, trazo: TRAZOS.persistente_leve }),
        opcion("persistente_crisis", "bq.paindetect.curso.persistente_crisis", { puntos: -1, trazo: TRAZOS.persistente_crisis }),
        opcion("crisis_sin_dolor", "bq.paindetect.curso.crisis_sin_dolor", { puntos: 1, trazo: TRAZOS.crisis_sin_dolor }),
        opcion("crisis_con_dolor", "bq.paindetect.curso.crisis_con_dolor", { puntos: 1, trazo: TRAZOS.crisis_con_dolor }),
      ],
    }, { texto: "bq.paindetect.curso" }),
    rotular({
      key: "irradia", tipo: "opcion", requerido: true,
      opciones: [opcion("si", "comun.si", { puntos: 2 }), opcion("no", "comun.no", { puntos: 0 })],
    }, { texto: "bq.paindetect.irradia" }),
    rotular({ key: "irradia_donde", tipo: "texto", mostrarSi: { campo: "paindetect.irradia", igual: "si" } },
      { texto: "bq.paindetect.irradiaDonde" }),
    ...SENSORIALES.map((k, i) => rotular(
      // D141 — deslizador y no botones, a pedido del dueño: como la escala de intensidad del
      // núcleo, se lee como "cuánto" de un vistazo.
      // D154 — arranca en "Nunca" (`porDefecto`), a pedido del dueño: siete deslizadores que había
      // que tocar uno por uno aunque la respuesta fuera "nunca" eran siete clics de más. La
      // contracara, aceptada: un "nunca" ya no distingue "lo pensó" de "no lo tocó".
      { key: k, tipo: "deslizador", requerido: true, opciones: INTENSIDAD_0_5, porDefecto: "0" },
      i === 0 ? { texto: `bq.paindetect.${k}`, antes: "bq.paindetect.sensaciones" } : { texto: `bq.paindetect.${k}` },
    )),
  ],

  /** La intensidad de ahora sale de la escala del núcleo: no se pregunta dos veces. */
  filasContexto({ escalaDolor } = {}) {
    return Number.isInteger(escalaDolor) ? [{ texto: tb("bq.paindetect.ahora"), valor: `${escalaDolor}/10` }] : [];
  },

  puntuar(respuestas = {}) {
    let total = 0;
    for (const key of ["curso", "irradia", ...SENSORIALES]) {
      const puntos = itemDe(paindetect, key).opciones.find((o) => o.valor === respuestas[key])?.puntos;
      // Incompleto → sin puntaje. Mismo criterio que puntuar() de los cuestionarios: un total
      // parcial de un instrumento validado no significa nada.
      if (puntos === undefined) return null;
      total += puntos;
    }
    const nivel = total >= 19 ? "alto" : total >= 13 ? "medio" : "bajo";
    const label = tb(nivel === "alto" ? "bq.paindetect.positivo" : nivel === "medio" ? "bq.paindetect.dudoso" : "bq.paindetect.negativo");
    return { total, min: -1, max: 38, nivel, label, detalle: tb("bq.paindetect.detalle") };
  },
};

// ── Datos sociodemográficos (D140) ──────────────────────────────────────────────────────────
//
// Estado civil y nivel educativo. Nacieron dentro del bloque vestibular (eran variables de la
// investigación de Migue) y Felipe pidió dos cosas: que vayan arriba, pegados a los datos
// personales, y que los pregunte también la preconsulta común. `lugar: "identidad"` es lo que
// los dibuja ahí en vez de al final.
//
// D146 (pedido del dueño, 2026-10-24): **adentro** de "Datos personales", sin encabezado propio
// ("Algunos datos más sobre usted" sobraba como sección aparte), y **opcionales**. `integrado` es
// lo que le dice a la vista que no abra una sección nueva. El título sigue existiendo: es el que
// usa la ficha para rotular las respuestas.
const sociodemografico = {
  key: "sociodemografico",
  version: "1.0",
  lugar: "identidad",
  integrado: true,
  get titulo() { return tb("bq.socio.titulo"); },
  intro: null,
  mostrarSi: null,
  items: [
    rotular({ key: "estado_civil", tipo: "opcion", requerido: false,
      opciones: opciones("bq.socio.estadoCivil", ["soltero", "casado", "conviviente", "divorciado", "separado", "viudo"]) },
    { texto: "bq.socio.estadoCivil" }),
    rotular({ key: "nivel_educativo", tipo: "opcion", requerido: false,
      opciones: opciones("bq.socio.nivelEducativo", ["primaria", "secundaria", "tecnico", "universitario", "posgrado"]) },
    { texto: "bq.socio.nivelEducativo" }),
  ],
};

// ── Malos hábitos (D154) ────────────────────────────────────────────────────────────────────
//
// Pedido del dueño: al final del historial, después de la actividad física, alcoholismo, tabaquismo
// u otro con texto libre. Nada obligatorio —tampoco el texto de "Otro"—: es un dato que el paciente
// da si quiere, y uno vacío no significa "no tiene". Sin "Ninguno" por lo mismo.
//
// `lugar: "actividad"` + `integrado`: se dibuja dentro de la sección del historial, justo debajo
// de la actividad física (los bloques de ese lugar van después de ella), sin sección propia.
const habitos = {
  key: "habitos",
  version: "1.0",
  lugar: "actividad",
  integrado: true,
  get titulo() { return tb("bq.habitos.titulo"); },
  intro: null,
  mostrarSi: null,
  items: [
    rotular({ key: "habitos", tipo: "casillas", requerido: false,
      opciones: opciones("bq.habitos.opcion", ["alcohol", "tabaco", "otro"]) },
    { texto: "bq.habitos.pregunta" }),
    rotular({ key: "otro_cual", tipo: "texto", requerido: false, mostrarSi: { campo: "habitos.habitos", incluye: "otro" } },
      { texto: "bq.habitos.otroCual" }),
  ],
};

// ── Comentario final (D140) ─────────────────────────────────────────────────────────────────
// El "¿Desea dejar algún comentario?" con el que cierra el formulario de Migue. Va al final de
// todo, después de los cuestionarios, que es donde el paciente ya sabe qué le faltó decir.
const comentario = {
  key: "comentario",
  version: "1.0",
  lugar: "cierre",
  get titulo() { return tb("bq.comentario.titulo"); },
  intro: null,
  mostrarSi: null,
  items: [rotular({ key: "texto", tipo: "texto" }, { texto: "bq.comentario.texto" })],
};

// ── Preconsulta vestibular (el triaje de la investigación de Migue) ─────────────────────────
//
// Adaptado del Google Form que pasó Migue para su investigación de mareo crónico. Los
// cuestionarios de las pantallas siguientes de ese formulario NO van acá: son instrumentos del
// motor de cuestionarios y el tipo de formulario los declara aparte (`cuestionarios`, D140).
//
// Lo que ese formulario preguntaba y el núcleo ya cubre NO se repite acá: nombre, edad, sexo y
// fecha salen de la identidad; diabetes e hipertensión, de la lista de enfermedades; los días de
// ejercicio, de la actividad física (con los mismos rangos a propósito, ver D135).
const V = "bq.vestibular";
const TIEMPOS_CRONICO = ["3_6m", "6_12m", "1_2a", "mas_2a"];
const CASI_DIARIO = ["diario", "varias_semana"];

// Dos criterios de la definición de MPPP de la Bárány Society (Staab 2017) que el paciente puede
// contestar solo. NO alcanzan para diagnosticar —faltan los demás criterios y descartar otras
// causas—: alcanzan para que Felipe sepa qué mirar en la entrevista.
const cumpleTemporalMppp = (r) => TIEMPOS_CRONICO.includes(r.tiempo_sintomas) && CASI_DIARIO.includes(r.frecuencia);

const vestibular = {
  key: "vestibular",
  version: "1.0",
  get titulo() { return tb(`${V}.titulo`); },
  get intro() { return tb(`${V}.intro`); },
  mostrarSi: null,
  items: [
    rotular({ key: "diagnostico_principal", tipo: "opcion", requerido: true,
      opciones: opciones(`${V}.dx`, ["mppp", "vppb", "neuritis", "migrana_vestibular", "vestibulopatia_bilateral", "meniere", "cervicogenico", "no_sabe", "otros"]) },
    { texto: `${V}.diagnostico` }),
    rotular({ key: "diagnostico_otro", tipo: "texto", mostrarSi: { campo: "vestibular.diagnostico_principal", igual: "otros" } },
      { texto: "bq.cual" }),
    rotular({ key: "tiempo_sintomas", tipo: "opcion", requerido: true,
      opciones: opciones(`${V}.tiempo`, ["menos_3m", "3_6m", "6_12m", "1_2a", "mas_2a"]) },
    { texto: `${V}.tiempo` }),
    rotular({ key: "desencadenante", tipo: "opcion", requerido: true,
      opciones: opciones(`${V}.des`, ["vppb", "neuritis", "migrana_vestibular", "crisis_ansiedad", "covid", "traumatismo", "sin_desencadenante", "no_sabe", "otros"]) },
    { texto: `${V}.desencadenante` }),
    rotular({ key: "desencadenante_otro", tipo: "texto", mostrarSi: { campo: "vestibular.desencadenante", igual: "otros" } },
      { texto: "bq.cual" }),
    rotular({ key: "frecuencia", tipo: "opcion", requerido: true,
      opciones: opciones(`${V}.frecuencia`, ["diario", "varias_semana", "semanal", "ocasional"]) },
    { texto: `${V}.frecuencia` }),
    rotular({ key: "caidas", tipo: "numero", min: 0, max: 100, requerido: true }, { texto: `${V}.caidas` }),
    // "Ninguno" es exclusivo. En el formulario, marcarlo desmarca y bloquea las demás
    // (public/bloques.js). Si igual llega junto con otra opción, gana la otra: es la lectura
    // menos dañina de una respuesta contradictoria — perder un diagnóstico sería peor.
    rotular({ key: "diagnosticos_sueno", tipo: "casillas", requerido: true, exclusiva: "ninguno",
      opciones: [...opciones(`${V}.sueno`, ["insomnio", "apnea"]), opcion("ninguno", "bq.ninguno")] },
    { texto: `${V}.diagnosticosSueno` }),
    rotular({ key: "medicacion", tipo: "casillas", requerido: true, exclusiva: "ninguno",
      opciones: [...opciones(`${V}.med`, ["betahistina", "antidepresivos", "ansioliticos", "otros"]), opcion("ninguno", "bq.ninguno")] },
    { texto: `${V}.medicacion` }),
    rotular({ key: "medicacion_otra", tipo: "texto", mostrarSi: { campo: "vestibular.medicacion", incluye: "otros" } },
      { texto: `${V}.medicacionOtra` }),
    rotular({ key: "entornos_visuales", tipo: "opcion", requerido: true,
      opciones: opciones("bq.frec", ["nunca", "rara_vez", "algunas_veces", "frecuentemente", "siempre"]) },
    { texto: `${V}.entornosVisuales` }),
    rotular({ key: "tiene_dolor", tipo: "opcion", requerido: true,
      opciones: [opcion("si", "comun.si"), opcion("no", "comun.no")] },
    { texto: `${V}.tieneDolor` }),
    rotular({ key: "dolor_zonas", tipo: "casillas", requerido: true, mostrarSi: { campo: "vestibular.tiene_dolor", igual: "si" },
      opciones: opciones(`${V}.zona`, ["cuello", "hombros", "espalda", "cabeza", "mandibula", "rodillas"]) },
    { texto: `${V}.dolorZonas` }),
    // `alimenta`: el valor va ADEMÁS a la columna del núcleo. El formulario vestibular no muestra
    // la escala de dolor común (no todo el que tiene mareo tiene dolor); sin esto, `escala_dolor`
    // quedaría vacío y el episodio no tendría contra qué comparar el dolor al alta.
    rotular({ key: "dolor_intensidad", tipo: "escala", min: 0, max: 10, requerido: true, alimenta: "escalaDolor",
      mostrarSi: { campo: "vestibular.tiene_dolor", igual: "si" } },
    { texto: `${V}.dolorIntensidad`, anclaBaja: "bq.anclaSinDolor", anclaAlta: "bq.anclaMaximo" }),
    rotular({ key: "calidad_sueno", tipo: "opcion", requerido: true,
      opciones: opciones(`${V}.calidadSueno`, ["muy_buena", "buena", "regular", "mala", "muy_mala"]) },
    { texto: `${V}.calidadSueno` }),
    // D140 — las tres escalas de la segunda pantalla del formulario de Migue. El mareo y la
    // inestabilidad van de 1 a 10 y no de 0 a 10, como en el original: quien llena esto tiene
    // mareo, y el formulario no ofrece "nada".
    rotular({ key: "escala_mareo", tipo: "escala", min: 1, max: 10, requerido: true },
      { texto: `${V}.escalaMareo`, antes: `${V}.escalasAntes`, anclaBaja: "bq.anclaMinimo", anclaAlta: "bq.anclaMaximoGenerico" }),
    rotular({ key: "escala_inestabilidad", tipo: "escala", min: 1, max: 10, requerido: true },
      { texto: `${V}.escalaInestabilidad`, anclaBaja: "bq.anclaMinimo", anclaAlta: "bq.anclaMaximoGenerico" }),
    rotular({ key: "dolor_cervical", tipo: "escala", min: 0, max: 10, requerido: true },
      { texto: `${V}.dolorCervical`, anclaBaja: "bq.anclaSinDolor", anclaAlta: "bq.anclaMaximo" }),
  ],

  senales(r = {}) {
    const senales = [];
    if (Number.isInteger(r.caidas) && r.caidas >= 1) {
      senales.push({ nivel: r.caidas >= 2 ? "alto" : "medio", texto: tb(`${V}.senal.caidas`, { n: r.caidas }) });
    }
    if (cumpleTemporalMppp(r)) senales.push({ nivel: "medio", texto: tb(`${V}.senal.temporal`) });
    if (["frecuentemente", "siempre"].includes(r.entornos_visuales)) senales.push({ nivel: "medio", texto: tb(`${V}.senal.visual`) });
    if (["mala", "muy_mala"].includes(r.calidad_sueno)) senales.push({ nivel: "bajo", texto: tb(`${V}.senal.sueno`) });
    return senales;
  },
  // Sin `sugerencias` desde D140: el DHI y el NPQ que sugería mandar ahora vienen adentro del
  // mismo formulario, junto con el resto de la batería.
};

// D141 — `pretriaje` y `psfs` viven en src/config/bloquesPretriaje.js (ver por qué allá).
// D147 — los del formulario de cierre viven en src/config/bloquesCierre.js.
export const BLOQUES = { sociodemografico, habitos, pretriaje, paindetect, psfs, vestibular, comentario, cierreActividad, cierreFarmacos, cierreReflexion };

/**
 * Los bloques que lleva un tipo de formulario, en orden. Un tipo sin bloques devuelve [].
 *
 * `lugar` (D140) dice dónde se dibuja cada bloque en el formulario: "identidad" (pegado a los
 * datos personales), "cuerpo" (después de la consulta actual, el de siempre) o "cierre" (al final,
 * después de los cuestionarios). Solo cambia el dibujo: se guardan y se validan todos igual.
 */
export function bloquesDeTipo(formType) {
  return (FORM_TYPES[formType]?.bloques || []).map((key) => BLOQUES[key]).filter(Boolean);
}

/** Las keys de los cuestionarios validados que un tipo de formulario trae adentro (D140). */
export function cuestionariosDeTipo(formType) {
  return (FORM_TYPES[formType]?.cuestionarios || []).filter((key) => CUESTIONARIOS[key]);
}

/** Lo mismo, como definiciones con su `key`: lo que necesita la vista para dibujarlos. */
export function definicionesCuestionariosDeTipo(formType) {
  return cuestionariosDeTipo(formType).map((key) => CUESTIONARIOS_LISTA.find((c) => c.key === key));
}

function comoLista(valor) {
  if (Array.isArray(valor)) return valor.map(String);
  if (valor === undefined || valor === null || valor === "") return [];
  return [String(valor)];
}

/** Lleva el valor crudo del formulario al que se guarda. `{ valor }`, `{ vacio }` o `{ invalido }`. */
function normalizarItem(item, crudo) {
  if (item.tipo === "casillas") {
    const lista = [...new Set(comoLista(crudo))];
    if (!lista.length) return { vacio: true };
    if (lista.some((v) => !item.opciones.some((o) => o.valor === v))) return { invalido: true };
    const valor = item.exclusiva && lista.length > 1 ? lista.filter((v) => v !== item.exclusiva) : lista;
    return { valor };
  }

  // Un campo de un solo valor que llegó repetido no es un tipeo: alguien armó el envío a mano.
  if (Array.isArray(crudo)) return { invalido: true };
  const texto = crudo === undefined || crudo === null ? "" : String(crudo).trim();
  if (texto === "") return { vacio: true };

  if (item.tipo === "opcion" || item.tipo === "trayectoria" || item.tipo === "deslizador") {
    return item.opciones.some((o) => o.valor === texto) ? { valor: texto } : { invalido: true };
  }
  if (item.tipo === "escala" || item.tipo === "numero") {
    if (!/^-?\d+$/.test(texto)) return { invalido: true };
    const n = Number(texto);
    return n >= item.min && n <= item.max ? { valor: n } : { invalido: true };
  }
  if (item.tipo === "texto") {
    return texto.length <= LARGO_TEXTO_BLOQUE ? { valor: texto } : { invalido: true };
  }
  return { invalido: true };
}

/**
 * Saca de un envío las respuestas de los bloques de su tipo de formulario. Función PURA: la usan
 * la ruta pública (para rechazar antes de sellar), la carga manual del panel y la persistencia
 * (que la vuelve a correr sobre lo que trae el sobre, porque lo que cruza el buzón es entrada
 * externa).
 *
 * Solo cuenta lo que CORRESPONDÍA preguntar: un bloque o una pregunta cuya condición no se
 * cumple se ignora aunque traiga valor. Es lo que impide guardar una respuesta a una pregunta que
 * el paciente nunca vio.
 *
 * @param {object}  p.data       - el formulario crudo
 * @param {string}  p.formType   - de qué tipo de formulario vino
 * @param {boolean} p.estricto   - true: un valor inválido o un obligatorio vacío devuelve `error`.
 *                                 false: se descartan en silencio (el sync: ya se validó al recibir).
 * @param {boolean} p.requeridos - false: no exige los obligatorios (la carga manual de Felipe,
 *                                 donde nada es obligatorio), pero sigue rechazando lo inválido.
 * @returns {{ error: string|null, cerrados: object, textos: object, alimenta: object }}
 */
export function extraerBloques({ data = {}, formType = "generico", estricto = true, requeridos = true } = {}) {
  const leer = (nombre) => data[nombre];
  const cerrados = {};
  const textos = {};
  const alimenta = {};

  for (const bloque of bloquesDeTipo(formType)) {
    if (!cumple(bloque.mostrarSi, leer)) continue;
    const respuestas = {};
    const libres = {};

    for (const item of bloque.items) {
      if (!cumple(item.mostrarSi, leer)) continue;
      const r = normalizarItem(item, data[nombreCampo(bloque.key, item.key)]);
      if (r.invalido) {
        if (estricto) return { error: tb("bq.error.invalido", { pregunta: item.texto }), cerrados: {}, textos: {}, alimenta: {} };
        continue;
      }
      if (r.vacio) {
        if (estricto && requeridos && item.requerido) {
          return { error: tb("bq.error.falta", { pregunta: item.texto }), cerrados: {}, textos: {}, alimenta: {} };
        }
        continue;
      }
      if (item.tipo === "texto") libres[item.key] = r.valor;
      else respuestas[item.key] = r.valor;
      if (item.alimenta) alimenta[item.alimenta] = r.valor;
    }

    if (Object.keys(respuestas).length || Object.keys(libres).length) {
      cerrados[bloque.key] = { version: bloque.version, respuestas };
    }
    if (Object.keys(libres).length) textos[bloque.key] = libres;
  }

  return { error: null, cerrados, textos, alimenta };
}

function valorLegible(item, valor) {
  if (item.tipo === "casillas") {
    return valor.map((v) => item.opciones.find((o) => o.valor === v)?.label ?? v).join(", ");
  }
  if (item.tipo === "opcion" || item.tipo === "trayectoria" || item.tipo === "deslizador") {
    return item.opciones.find((o) => o.valor === valor)?.label ?? String(valor);
  }
  if (item.tipo === "escala") return `${valor}/${item.max}`;
  return String(valor);
}

/**
 * Lo que se muestra de los bloques de una consulta: título, puntaje, señales, cuestionarios
 * sugeridos y las respuestas legibles. Recibe lo guardado (`consultas.bloques`) y el texto libre ya
 * descifrado. Función PURA — no descifra ni consulta nada.
 *
 * Un bloque guardado cuya definición ya no existe se muestra igual, sin puntaje: la respuesta del
 * paciente no deja de haber ocurrido porque se saque el bloque del código.
 */
export function vistaBloques(cerrados, textos, contexto = {}) {
  const lista = [];
  for (const [key, guardado] of Object.entries(cerrados || {})) {
    const def = BLOQUES[key];
    const respuestas = guardado?.respuestas || {};
    const libres = (textos && textos[key]) || {};

    if (!def) {
      lista.push({ key, titulo: key, version: guardado?.version ?? null, versionVigente: null, puntaje: null, pretriaje: null, senales: [], sugerencias: [], filas: [] });
      continue;
    }

    const filas = def.filasContexto ? def.filasContexto(contexto) : [];
    for (const item of def.items) {
      const valor = item.tipo === "texto" ? libres[item.key] : respuestas[item.key];
      if (valor === undefined || valor === null || valor === "" || (Array.isArray(valor) && !valor.length)) continue;
      filas.push({ texto: item.texto, valor: valorLegible(item, valor) });
    }

    lista.push({
      key,
      titulo: def.titulo,
      version: guardado?.version ?? null,
      versionVigente: def.version,
      puntaje: def.puntuar ? def.puntuar(respuestas, contexto) : null,
      // D141 — solo el pretriage: la lectura estructurada (nivel, sospechas, banderas sugeridas)
      // que la ficha muestra arriba de todo. Las señales son la misma cosa en texto.
      pretriaje: def.evaluar ? def.evaluar(respuestas, contexto) : null,
      senales: def.senales ? def.senales(respuestas, contexto) : [],
      // Un cuestionario que no está cargado no se sugiere: sería mandar a buscar algo que no existe.
      sugerencias: (def.sugerencias ? def.sugerencias(respuestas, contexto) : [])
        .filter((s) => CUESTIONARIOS[s.cuestionario])
        .map((s) => ({ ...s, nombre: CUESTIONARIOS[s.cuestionario].nombre })),
      filas,
    });
  }
  return lista;
}

/**
 * Las tomas de cuestionario que vinieron DENTRO de una preconsulta (D140), con la misma forma que
 * vistaBloques() para que la ficha, el PDF y el mail las muestren con el mismo dibujo. Recibe
 * `[{ cuestionarioKey, version, respuestas }]` y el tipo de formulario, que da el orden: todas las
 * tomas de una preconsulta tienen la misma fecha, y la base no garantiza otro. Función PURA.
 *
 * Las subescalas van como primeras filas: en el DHI o el PHQ-4 el total solo no dice dónde está
 * el problema.
 */
export function vistaTomas(tomas = [], formType = null) {
  const orden = cuestionariosDeTipo(formType);
  const posicion = (t) => (orden.includes(t.cuestionarioKey) ? orden.indexOf(t.cuestionarioKey) : orden.length);
  return [...tomas].sort((a, b) => posicion(a) - posicion(b)).map((t) => {
    const def = CUESTIONARIOS[t.cuestionarioKey];
    if (!def) {
      return { key: t.cuestionarioKey, titulo: t.cuestionarioKey, version: t.version ?? null, versionVigente: null, puntaje: null, senales: [], sugerencias: [], filas: [] };
    }
    const p = puntuar(t.cuestionarioKey, t.respuestas);
    const alerta = alertaDe(t.cuestionarioKey, t.respuestas);
    const filas = (p?.subescalas || []).map((s) => ({ texto: s.label, valor: `${s.total}/${s.max}` }));
    for (const item of def.items) {
      const v = t.respuestas?.[item.key];
      if (v === undefined || v === null) continue;
      filas.push({ texto: item.texto, valor: etiquetaRespuesta(item, v) });
    }
    return {
      key: t.cuestionarioKey,
      titulo: def.nombre,
      version: t.version ?? null,
      versionVigente: def.version,
      puntaje: p ? { total: p.total, min: p.min, max: p.max, nivel: p.nivel, label: p.label, detalle: p.detalle } : null,
      senales: alerta ? [{ nivel: "alto", texto: alerta }] : [],
      sugerencias: [],
      filas,
    };
  });
}

/** El JSON de `bloques_enc` ya descifrado. Un texto roto no voltea la ficha: se trata como vacío. */
export function parsearTextosBloques(claro) {
  if (!claro) return {};
  try {
    const o = JSON.parse(claro);
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}
