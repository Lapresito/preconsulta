// Catálogos de la captura estructurada (Plan A, fase A3). Los códigos de enfermedades e
// implantes son EXACTAMENTE los que hoy captura el formulario — ampliarlos es una decisión
// clínica de Felipe, no técnica (ver docs/tecnico/TODO.md).
//
// ── LOS RÓTULOS SE TRADUCEN; LAS KEYS NO, NUNCA (D127) ──────────────────────────────────────
//
// Las keys ("lumbalgia", "ce_esfinteres", "mod_sueno") están GUARDADAS EN LA BASE. Traducirlas
// dejaría huérfano todo lo ya clasificado: un episodio con motivo_categoria='lumbalgia' dejaría
// de encontrarse el día que el panel se pone en inglés. Lo que se traduce es lo que se lee en
// pantalla, y nada más.
//
// POR QUÉ UN GETTER Y NO UN VALOR. Este módulo se evalúa UNA sola vez, cuando el proceso
// arranca; el idioma se cambia en caliente desde la tuerca. Con `label: t("...")` los catálogos
// quedarían congelados en el idioma que estaba puesto al arrancar hasta reiniciar el programa.
// El getter resuelve en cada lectura, que es exactamente lo que hace falta.
//
// Los getters son `enumerable`, así que `{...m}`, `Object.entries` y `JSON.stringify` siguen
// funcionando igual que con un valor — con una trampa: **el spread congela**. Todo lo DERIVADO
// de un catálogo (FLAGS_TRIAGE, los mapas *_LABEL) tiene que rearmarse perezosamente también,
// o vuelve el mismo bug por la puerta de atrás.
import { traductor, idiomaInstalacion } from "../i18n/index.js";
// D154 — los grupos de zonas del pretriage: deciden qué grupos del triage son pertinentes.
import { ZONAS_CERVICALES, ZONAS_TORACICAS, ZONAS_ARTICULARES, ZONAS_TVP } from "../../public/pretriaje.js";

const tc = (clave) => traductor(idiomaInstalacion())(clave);

/** Una entrada `{ key, label, ...extra }` cuyo rótulo se resuelve al leerlo. */
function rot(key, clave, extra = {}) {
  return Object.defineProperty({ key, ...extra }, "label", {
    get: () => tc(clave), enumerable: true, configurable: true,
  });
}

/** Un mapa `{ key: rótulo }` que se resuelve al leerlo — reemplaza a los LABEL_* fijos. */
function mapaRot(keys, claveDe) {
  const o = {};
  for (const k of keys) {
    Object.defineProperty(o, k, { get: () => tc(claveDe(k)), enumerable: true, configurable: true });
  }
  return o;
}

/** Igual que `rot`, pero con un segundo rótulo `corto` (el de los gráficos). */
function rotCorto(key, clave, claveCorto, extra = {}) {
  return Object.defineProperty(rot(key, clave, extra), "corto", {
    get: () => tc(claveCorto), enumerable: true, configurable: true,
  });
}

export const RANGOS_ETARIOS = ["0-17", "18-29", "30-39", "40-49", "50-59", "60-69", "70+"];

// Deriva el rango etario desde la edad calculada — misma lógica que va a usar el seed
// sintético (A4) para no generar datos inconsistentes entre edad_anios y rango_etario.
export function rangoEtarioDeEdad(edad) {
  if (edad === "" || edad === null || edad === undefined || Number.isNaN(edad)) return null;
  const n = Number(edad);
  if (n < 18) return "0-17";
  if (n < 30) return "18-29";
  if (n < 40) return "30-39";
  if (n < 50) return "40-49";
  if (n < 60) return "50-59";
  if (n < 70) return "60-69";
  return "70+";
}

export const DEPARTAMENTOS = [
  "Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores", "Florida",
  "Lavalleja", "Maldonado", "Montevideo", "Paysandú", "Río Negro", "Rivera", "Rocha",
  "Salto", "San José", "Soriano", "Tacuarembó", "Treinta y Tres",
];

// Ampliado a pedido de Felipe (docx PROYECTO ASISTENTE DE CONSULTA, corrección 17/8) — antes solo
// tenía diabetes/hipertensión/asma. Epilepsia se agrega en particular porque es contraindicación
// de realidad virtual en rehabilitación (todavía no hay módulo de RV, pero el dato ya vale la pena
// capturarlo). Trastornos psicológicos van como dos ítems (ansiedad/depresión), no uno genérico,
// mismo criterio granular que el resto de la lista — "otro" sigue cubriendo lo que falte.
//
// D135 · criba #3 (decidido por Felipe 2026-09-13): entra hipotiroidismo. Era la única enfermedad de
// la criba que no estaba explícita y caía en "otro".
//
// D141 (2026-10-20): entra `cancer`, pedido del dueño. No es una enfermedad más de la lista: es la
// bandera roja con más peso de todo el triage (Downie 2013, Finucane 2020), y hasta acá solo
// aparecía si el paciente la escribía en "otro". Al marcarla se abre TIPOS_CANCER.
export const ENFERMEDADES = [
  "diabetes", "hipertension", "asma", "epoc", "obesidad", "dislipemia",
  "cardiovascular", "epilepsia", "ansiedad", "depresion", "hipotiroidismo", "cancer", "otro",
];

// Qué cáncer tuvo o tiene (D141). Los cinco primeros son los que el marco de banderas rojas de la
// IFOMPT nombra por su predilección por la metástasis ósea (mama, próstata, pulmón, riñón,
// tiroides); `hematologico` cubre el mieloma, que el mismo marco pone como diferencial del dolor
// dorsal. Los demás son los frecuentes que no tienen esa predilección: sirven para que el paciente
// encuentre el suyo sin escribir, y para que el pretriage NO los trate igual que a los primeros.
// Se guardan como filas de `consulta_condiciones` con tipo "cancer" — sin migración.
export const TIPOS_CANCER = [
  "mama", "prostata", "pulmon", "rinon", "tiroides", "hematologico", "colorrectal", "piel", "otro",
].map((k) => rot(k, `cat.cancer.${k}`));
export const LABEL_TIPO_CANCER = mapaRot(TIPOS_CANCER.map((c) => c.key), (k) => `cat.cancer.${k}`);

// ── Zonas del dolor que marca el PACIENTE (D141) ─────────────────────────────────────────────
//
// Reemplazan, en el formulario del paciente, al desplegable de "categoría del motivo". Esa lista
// mezclaba zonas con cosas que el paciente no sabe clasificar ("neurológico", "post-quirúrgico",
// "lesión deportiva"); lo que sí sabe decir es DÓNDE le duele, y es eso lo que necesita el
// pretriage para saber qué preguntar (lumbar → cauda equina; cuello → vascular; pierna → TVP).
// Los rótulos llevan los sinónimos con que la gente lo nombra ("espalda baja, cintura, lumbago").
//
// La categoría de motivo NO desaparece: es de Felipe, la fija al confirmar (motivo_categoria_pro).
// Lo que deja de pasar es que el paciente la elija; ahora se sugiere sola a partir de la zona.
export const ZONAS_CONSULTA = [
  "cabeza", "cuello", "espalda_alta", "espalda_baja", "hombro", "brazo_codo", "muneca_mano",
  "cadera", "rodilla", "pierna", "tobillo_pie", "otra",
].map((k) => rot(k, `cat.zona.${k}`));
export const LABEL_ZONA_CONSULTA = mapaRot(ZONAS_CONSULTA.map((z) => z.key), (k) => `cat.zona.${k}`);

// La categoría de motivo que SUGIERE cada zona. `pierna` y `otra` no sugieren ninguna: no hay
// una categoría que les corresponda y adivinar sería peor que dejarla para Felipe.
const MOTIVO_DE_ZONA = {
  cabeza: "cefalea", cuello: "cervicalgia", espalda_alta: "dorsalgia", espalda_baja: "lumbalgia",
  hombro: "hombro", brazo_codo: "codo", muneca_mano: "muneca_mano", cadera: "cadera",
  rodilla: "rodilla", tobillo_pie: "tobillo_pie",
};

/**
 * La categoría sugerida para un conjunto de zonas: solo si TODAS apuntan a la misma. Con dos zonas
 * distintas (cuello y lumbar) no hay una categoría que sea "la" del motivo, y elegir la primera
 * inventaría una jerarquía — queda vacía y la decide Felipe al confirmar.
 */
export function motivoDeZonas(zonas = []) {
  const motivos = [...new Set(zonas.map((z) => MOTIVO_DE_ZONA[z]).filter(Boolean))];
  const sinMotivo = zonas.some((z) => !MOTIVO_DE_ZONA[z]);
  return motivos.length === 1 && !sinMotivo ? motivos[0] : null;
}
export const IMPLANTES = ["marcapasos", "stent", "otro"];

// Los motivos DE FÁBRICA. Borrador de Claude, no de Felipe — igual que FLAGS_TRIAGE. Desde
// 2026-08-27 (D125) Felipe puede sumar los suyos, que viven en la tabla `motivos_personalizados`
// y se registran acá al arrancar el proceso local (ver registrarMotivos, más abajo).
//
// D137 (2026-09-14): entra `mareo_vestibular`, el motivo que trae preseleccionado la preconsulta
// vestibular. Antes el mareo caía en "neurológico" o en "otro".
//
// Estos de fábrica NO se copian a la base: el proceso público los necesita para renderizar el
// formulario del paciente y no tiene acceso a la base local. Ver la migración 0035.
export const MOTIVO_CATEGORIAS = [
  "lumbalgia", "cervicalgia", "dorsalgia", "hombro", "codo", "muneca_mano", "cadera",
  "rodilla", "tobillo_pie", "lesion_deportiva", "post_quirurgico", "mareo_vestibular", "cefalea", "neurologico",
  "otro",
].map((k) => rot(k, `cat.motivo.${k}`));

// ── Motivos agregados por Felipe (D125) ──────────────────────────────────────────────────────
//
// El registro vive ACÁ y no en un servicio porque este archivo es el único lugar que todo el
// código ya importa para preguntar por motivos — y porque tiene que seguir sin depender de la
// base: `reportFields.js` lo importa, y `test/reportBuilder.test.js` importa reportFields sin
// Postgres corriendo. Quien lee de la base es src/services/motivos.js, que llama a
// registrarMotivos() al arrancar el proceso local; el proceso público nunca lo llama y se queda
// con los de fábrica, que es exactamente lo que tiene que ofrecerle al paciente.
//
// Es un módulo con estado, que normalmente sería un olor. Acá es deliberado: la alternativa era
// pasarle la lista por parámetro a las ~20 funciones y vistas que hoy hacen `MOTIVO_LABEL[key]`,
// o volver async cada lugar que necesita un label. El proceso local es uno solo y de un solo
// usuario; el estado se carga una vez al arrancar y se refresca cuando se agrega uno.
let motivosAgregados = [];

/** Reemplaza la lista de agregados (no la suma): la fuente de verdad es la base. */
export function registrarMotivos(lista = []) {
  motivosAgregados = lista
    .filter((m) => m && m.key && m.label)
    // Un agregado nunca puede pisar uno de fábrica: la key es lo que está guardado en las
    // consultas ya clasificadas, y dos labels distintos para la misma key serían dos verdades.
    .filter((m) => !MOTIVO_CATEGORIAS.some((f) => f.key === m.key))
    .map((m) => ({ key: m.key, label: m.label, agregado: true }));
}

/** La lista COMPLETA: los de fábrica primero, los agregados después. */
export function motivosDisponibles() {
  return [...MOTIVO_CATEGORIAS, ...motivosAgregados];
}

export function existeMotivo(key) {
  return motivosDisponibles().some((m) => m.key === key);
}

/**
 * El label de una key. Devuelve la key cruda si no la conoce — que es lo correcto: si un episodio
 * quedó clasificado con un motivo que después desapareció del catálogo, mostrar la key es feo
 * pero honesto; mostrar "Otro" o vacío sería perder el dato.
 */
export function labelMotivo(key) {
  if (!key) return null;
  return motivosDisponibles().find((m) => m.key === key)?.label || key;
}

/**
 * Normaliza un texto para COMPARAR motivos: minúsculas, sin tildes, sin puntuación, espacios
 * colapsados. Es lo que evita que "Lumbalgía" cree un motivo nuevo al lado de "Lumbalgia".
 *
 * Mismo criterio que `normalizarNombre` en src/lib/identidad.js (normalizar es preparar la
 * comparación, no decidirla), repetido acá y no importado para que catalogos.js siga sin
 * dependencias.
 */
export function normalizarMotivo(texto) {
  return String(texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** La key que le tocaría a un motivo nuevo con ese label. Slug, misma forma que los de fábrica. */
export function keyDeMotivo(texto) {
  return normalizarMotivo(texto).replace(/ /g, "_").slice(0, 40);
}

/**
 * Busca un motivo por lo que se escribió. Devuelve el motivo existente, o null si no hay ninguno.
 * Compara por LABEL normalizado y también por key, para que tanto "muñeca / mano" como
 * "muneca_mano" encuentren el mismo.
 */
export function buscarMotivoPorTexto(texto) {
  const norm = normalizarMotivo(texto);
  if (!norm) return null;
  return motivosDisponibles().find(
    (m) => normalizarMotivo(m.label) === norm || m.key === keyDeMotivo(texto)
  ) || null;
}

// Todavía no se deriva del body chart pintado (D6/A4) — declarado acá para que el seed
// sintético (A4) y el dashboard (A6) ya trabajen contra el vocabulario final.
export const REGIONES_DOLOR = [
  "cervical", "dorsal", "lumbar",
  "hombro_izq", "hombro_der", "codo_izq", "codo_der", "muneca_izq", "muneca_der",
  "cadera_izq", "cadera_der", "rodilla_izq", "rodilla_der", "tobillo_izq", "tobillo_der",
  "craneo", "abdomen", "toracica",
];

// Etiquetas legibles para REGIONES_DOLOR — las usa el selector de zona que Felipe confirma junto
// al motivo (atajo barato de D6, ver TODO.md). El código sigue siendo lo que se guarda/agrupa.
export const LABEL_REGION_DOLOR = mapaRot(REGIONES_DOLOR, (k) => `cat.region.${k}`);

// C5 (módulo clínico) — técnicas de tratamiento: se ELIGEN con checkboxes en la sesión, nunca
// se escriben (mismo patrón que MOTIVO_CATEGORIAS: código en la base, label en la UI).
//
// Revisada por Felipe el 31/8: salieron TENS, punción seca y ultrasonido —no son parte de lo que
// hace— y entraron entrevista motivacional, educación y realidad virtual. El recorte no es
// cosmético: cada casilla que sobra es una que hay que leer y descartar en cada sesión.
//
// `realidad_virtual` se deja aunque el módulo no exista todavía, y tiene un porqué: la
// preconsulta ya captura epilepsia JUSTAMENTE porque es contraindicación de RV en rehabilitación
// (ver ENFERMEDADES, más arriba). Con la técnica en el catálogo, el día que se implemente el
// módulo el dato para el aviso ya está cargado hacia atrás.
export const TECNICAS = [
  "terapia_manual", "movilizacion", "ejercicio_terapeutico", "vendaje",
  "entrevista_motivacional", "educacion", "realidad_virtual",
].map((k) => rot(k, `cat.tecnica.${k}`));

// D150 — las técnicas que agrega Felipe desde Edición (tabla `tecnicas_personalizadas`). Mismo
// registro en memoria que los motivos (ver registrarMotivos más abajo y services/tecnicas.js): las
// de fábrica no se copian a la base, y una agregada nunca pisa una de fábrica.
let tecnicasAgregadas = [];

export function registrarTecnicas(lista = []) {
  tecnicasAgregadas = lista
    .filter((x) => x && x.key && x.label && !TECNICAS.some((f) => f.key === x.key))
    .map((x) => ({ key: x.key, label: x.label, activa: x.activa !== false, agregada: true }));
}

/**
 * Las de fábrica primero, las agregadas después (por nombre). Con `soloActivas`, sin las dadas de
 * baja: es lo que ofrece el formulario de la sesión. Sin él, todas: es lo que necesita una sesión
 * vieja que registró una técnica que hoy está de baja.
 */
export function tecnicasDisponibles({ soloActivas = false } = {}) {
  return [...TECNICAS, ...tecnicasAgregadas.filter((x) => !soloActivas || x.activa)];
}

/** El label de una key; la key cruda si no la conoce (mismo criterio que labelMotivo). */
export function labelTecnica(key) {
  if (!key) return null;
  return tecnicasDisponibles().find((x) => x.key === key)?.label || key;
}

export function buscarTecnicaPorTexto(texto) {
  const norm = normalizarMotivo(texto);
  if (!norm) return null;
  return tecnicasDisponibles().find((x) => normalizarMotivo(x.label) === norm || x.key === keyDeMotivo(texto)) || null;
}

// Veces por semana de cada frecuencia. Tabla aparte y no un campo suelto en cada `rot()` para
// poder leerla de un vistazo: es una equivalencia numérica y se revisa comparando los números
// entre sí, no leyéndolos salteados entre rótulos.
const VECES_SEMANA = {
  "2_dia": 14,
  diaria: 7,
  "5_semana": 5,
  "4_semana": 4,
  dia_por_medio: 3.5,
  "3_semana": 3,
  "2_semana": 2,
  semanal: 1,
};

/**
 * Cada cuánto hace el paciente un ejercicio. Ordenadas de MÁS a MENOS frecuente, que es como se
 * lee un desplegable de dosis: se busca "diaria" arriba y se baja hasta encontrar la que va.
 *
 * D134 — se agregaron `2_dia`, `5_semana` y `4_semana`. Faltaban las tres y el salto de "3 veces
 * por semana" a "día por medio" dejaba afuera la mitad de las pautas reales de fuerza. `vecesSemana`
 * es la equivalencia numérica, y no es cosmética: es lo que permite GRAFICAR la frecuencia junto
 * al peso y las repeticiones cuando se compara lo prescrito con lo que el paciente reportó. Sin
 * un número, "pasó de 2_semana a 3_semana" no se puede dibujar.
 *
 * `dia_por_medio` vale 3,5 (siete días divididos dos) — es un promedio, no un redondeo: si se
 * pusiera 3 quedaría empatada con `3_semana`, que es una pauta distinta.
 */
export const FRECUENCIAS = [
  "2_dia", "diaria", "5_semana", "4_semana", "dia_por_medio", "3_semana", "2_semana", "semanal",
].map((k) => rot(k, `cat.frecuencia.${k}`, { vecesSemana: VECES_SEMANA[k] }));

export const LADOS = ["izq", "der"].map((k) => rot(k, `cat.lado.${k}`));

// ── Actividad física (D135 · criba #17) ──────────────────────────────────────────────────────
//
// Reemplaza la escala sedentario/moderada/intensa. El formato es el de la criba —nivel, qué hace
// y cuántos días— con una indicación de Felipe encima: "botones de seleccionar", nada de texto
// libre. Por eso las actividades son un catálogo y no un campo abierto.
//
// La frecuencia va en RANGOS y no en días exactos: son los mismos rangos (0 / 1-2 / 3-4 / 5-7)
// que usa el formulario vestibular de la investigación de Migue. Con el mismo vocabulario en los
// dos formularios, las respuestas se comparan sin reagrupar.
export const NIVELES_ACTIVIDAD = ["sedentario", "episodico", "saludable"].map(
  (k) => rot(k, `cat.nivelActividad.${k}`));

export const FRECUENCIAS_ACTIVIDAD = ["0", "1_2", "3_4", "5_7"].map(
  (k) => rot(k, `cat.frecActividad.${k}`));

export const TIPOS_ACTIVIDAD = [
  "caminar", "correr", "bicicleta", "natacion", "gimnasio", "yoga_pilates", "futbol",
  "deporte_equipo", "baile", "otro",
].map((k) => rot(k, `cat.tipoActividad.${k}`));

export const LABEL_NIVEL_ACTIVIDAD = mapaRot(NIVELES_ACTIVIDAD.map((n) => n.key), (k) => `cat.nivelActividad.${k}`);
export const LABEL_FREC_ACTIVIDAD = mapaRot(FRECUENCIAS_ACTIVIDAD.map((f) => f.key), (k) => `cat.frecActividad.${k}`);
export const LABEL_TIPO_ACTIVIDAD = mapaRot(TIPOS_ACTIVIDAD.map((a) => a.key), (k) => `cat.tipoActividad.${k}`);

// Un checkbox marcado solo llega como string suelto; varios, como array. Vacío, como nada.
const enLista = (v) => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]);
const enCatalogo = (catalogo, key) => catalogo.some((c) => c.key === key);

/**
 * Los tres campos de actividad física tal como se guardan, a partir del formulario crudo. Los tres
 * son opcionales: vacío vale siempre. Lo que no está en el catálogo se descarta acá — rechazar el
 * envío es trabajo de `actividadInvalida`, que corre antes; esto solo normaliza.
 */
export function actividadDeFormulario(data = {}) {
  return {
    actividadFisica: enCatalogo(NIVELES_ACTIVIDAD, data.actividadFisica) ? data.actividadFisica : null,
    actividadFrecuencia: enCatalogo(FRECUENCIAS_ACTIVIDAD, data.actividadFrecuencia) ? data.actividadFrecuencia : null,
    actividades: [...new Set(enLista(data.actividades))].filter((k) => enCatalogo(TIPOS_ACTIVIDAD, k)),
  };
}

/** Las zonas que marcó el paciente, normalizadas contra el catálogo y en su orden. */
export function zonasDeFormulario(data = {}) {
  const marcadas = new Set(enLista(data.zonasConsulta));
  return ZONAS_CONSULTA.map((z) => z.key).filter((k) => marcadas.has(k));
}

/**
 * Los tipos de cáncer marcados. Solo cuentan si además marcó "Cáncer" en enfermedades: la pregunta
 * no se le mostró a quien no lo marcó, y guardar una respuesta a algo que no se preguntó es lo que
 * el resto del formulario evita (D136).
 */
export function cancerDeFormulario(data = {}) {
  const enfermedades = enLista(data.enfermedades);
  if (!enfermedades.some((e) => codigoEnfermedad(e) === "cancer")) return [];
  return [...new Set(enLista(data.cancerTipos))].filter((k) => enCatalogo(TIPOS_CANCER, k));
}

/** Las zonas del dolor en una línea, para el PDF y el mail. "Otra" lleva lo que escribió. */
export function textoZonas(data = {}) {
  const otra = String(data.otraZona || "").trim().slice(0, 100);
  const partes = zonasDeFormulario(data).map((k) => (k === "otra" && otra ? `${LABEL_ZONA_CONSULTA[k]}: ${otra}` : LABEL_ZONA_CONSULTA[k]));
  return partes.join(", ") || "-";
}

/** true si llegó una zona o un tipo de cáncer fuera del catálogo. */
export function zonasOCancerInvalidos(data = {}) {
  if (enLista(data.zonasConsulta).some((k) => !enCatalogo(ZONAS_CONSULTA, k))) return true;
  return enLista(data.cancerTipos).some((k) => !enCatalogo(TIPOS_CANCER, k));
}

/** true si llegó algún valor de actividad que no es del catálogo. Mismo criterio que el departamento. */
export function actividadInvalida(data = {}) {
  const fuera = (valor, catalogo) => valor !== undefined && valor !== null && valor !== "" && !enCatalogo(catalogo, valor);
  if (fuera(data.actividadFisica, NIVELES_ACTIVIDAD)) return true;
  if (fuera(data.actividadFrecuencia, FRECUENCIAS_ACTIVIDAD)) return true;
  return enLista(data.actividades).some((k) => !enCatalogo(TIPOS_ACTIVIDAD, k));
}

/**
 * La actividad física en una línea, para el PDF y el mail. Recibe el formulario crudo (keys) o una
 * consulta guardada (mismas keys): los rótulos se resuelven acá, en el idioma de la instalación.
 */
export function textoActividad(data = {}) {
  const { actividadFisica, actividadFrecuencia, actividades } = actividadDeFormulario(data);
  const partes = [];
  if (actividadFisica) partes.push(LABEL_NIVEL_ACTIVIDAD[actividadFisica]);
  if (actividadFrecuencia) partes.push(LABEL_FREC_ACTIVIDAD[actividadFrecuencia]);
  // D141 — "Otra" lleva lo que el paciente escribió en lugar del rótulo genérico.
  const otra = String(data.otraActividad || "").trim();
  if (actividades.length) {
    partes.push(actividades.map((k) => (k === "otro" && otra ? otra : LABEL_TIPO_ACTIVIDAD[k])).join(", "));
  }
  return partes.join(" · ") || "-";
}

// C7 (módulo clínico) — opciones cerradas del formulario de postconsulta. Cerradas a propósito
// (no texto libre): son la capa B que el dashboard de Resultados (C8) va a poder agregar.
export const ADHERENCIA = [
  "nunca", "a_veces", "casi_siempre", "siempre",
].map((k) => rot(k, `cat.adherencia.${k}`));

// D116 — cuándo un feedback de cierre merece un aviso. Constante con nombre y no un número
// suelto en una vista: es un criterio clínico, y el día que Felipe lo quiera mover tiene que
// haber UN lugar donde moverlo.
//
// El umbral lo confirmó Felipe el 2026-08-26. Las otras dos condiciones del aviso no dependen de
// ningún umbral y se sostienen solas: que el paciente diga que está igual o peor, y que el dolor
// final no haya bajado respecto del ingreso.
//
// ⚠️ El aviso se DERIVA al leer, no se guarda como bandera (ver la nota en admin.js): si este
// número cambia, todos los feedbacks ya recibidos se releen con el criterio nuevo.
export const DOLOR_ALTO_FEEDBACK = 7;

export const MEJORA_PERCIBIDA = [
  "peor", "igual", "algo_mejor", "mucho_mejor", "resuelto",
].map((k) => rot(k, `cat.mejora.${k}`));

// Los checkboxes del formulario mandan las etiquetas visibles ("Diabetes", "Hipertensión"...),
// no los códigos. Cualquier valor no reconocido (incluida la opción "Otro") cae en "otro" —
// el texto libre correspondiente (otraEnfermedad/otroImplante) va cifrado en la capa C.
const ENFERMEDAD_LABEL_A_CODIGO = {
  Diabetes: "diabetes", Hipertensión: "hipertension", Asma: "asma", EPOC: "epoc",
  Obesidad: "obesidad", Dislipemia: "dislipemia", "Enfermedad cardiovascular": "cardiovascular",
  Epilepsia: "epilepsia", Ansiedad: "ansiedad", Depresión: "depresion",
  Hipotiroidismo: "hipotiroidismo", Cáncer: "cancer",
};
const IMPLANTE_LABEL_A_CODIGO = { Marcapasos: "marcapasos", Stent: "stent" };

// ⚠️ El formulario del paciente manda el RÓTULO EN ESPAÑOL como `value` del checkbox, en los
// tres idiomas — es su formato de cable, no lo que se ve en pantalla (ver preconsulta.ejs, donde
// el `value=` quedó fijo a propósito y lo traducido es el `<label>`). Igual se acepta el código
// crudo por si alguna vez llega así: es barato y evita que un cambio del formulario mande todo
// a "otro" en silencio.
export function codigoEnfermedad(label) {
  if (ENFERMEDAD_LABEL_A_CODIGO[label]) return ENFERMEDAD_LABEL_A_CODIGO[label];
  return ENFERMEDADES.includes(label) ? label : "otro";
}

export function codigoImplante(label) {
  if (IMPLANTE_LABEL_A_CODIGO[label]) return IMPLANTE_LABEL_A_CODIGO[label];
  return IMPLANTES.includes(label) ? label : "otro";
}

// Para mostrar en la ficha/PDF (A5): el camino inverso, código → etiqueta legible.
export const LABEL_ENFERMEDAD = mapaRot(ENFERMEDADES, (k) => `cat.enfermedad.${k}`);

// Mismo criterio que DESTINO_DERIVACION_CORTO y MODULADOR_CORTO: la columna de etiquetas de
// `svg-barras` mide 130 px y recorta EN SILENCIO lo que no entra — "Enfermedad cardiovascular"
// quedaba cortada y se veía mal (pedido del dueño, 31/8). Esta versión es SOLO para el gráfico;
// el filtro y la ficha siguen usando LABEL_ENFERMEDAD, donde hay lugar y la precisión importa
// más que el ancho.
export const ENFERMEDAD_CORTO = mapaRot(ENFERMEDADES, (k) => `cat.enfermedadCorto.${k}`);
export const LABEL_IMPLANTE = mapaRot(IMPLANTES, (k) => `cat.implante.${k}`);

// Formulario INTERMEDIO (migración 0021): el mismo formulario de la preconsulta, llenado en el
// medio de un tratamiento. El motivo lo elige Felipe al generar el link y explica PARA QUÉ lo
// pidió — no cambia qué campos tiene el formulario, que son siempre los mismos. Es justamente
// eso lo que después permite comparar ingreso contra control y medir avance.
//
// "Después de la sesión" (postsesion) se sacó del catálogo (2026-08-24, pedido del dueño): era
// la misma idea que la postconsulta, renombrada ahora "Feedback y fin de tratamiento"
// (formTypes.js) — dos formularios para lo mismo confundían más de lo que ayudaban. No se borra
// una migración por esto: las filas viejas con motivo_intermedio='postsesion' en la base quedan
// tal cual, solo dejó de ofrecerse como opción nueva.
export const MOTIVOS_INTERMEDIO = [
  "presesion", "control",
].map((k) => rot(k, `cat.motivoIntermedio.${k}`));

// Agenda (fase 1a). Duraciones que Felipe puede elegir al coordinar. La primera sesión de un
// episodio dura más porque hay que conocer al paciente — de ahí el default distinto.
export const DURACIONES_SESION = [15, 30, 45, 60, 90]; // minutos
export const DURACION_DEFAULT_PRIMERA_SESION = 60;
export const DURACION_DEFAULT_SESION = 45;

// Triage, etapa 1 (D59/D60) — borrador armado por Claude a partir de criterios estándar de
// triage musculoesquelético, TODAVÍA SIN VALIDAR clínicamente por Felipe. Cada bandera es un
// catálogo editable (key/label) y no una columna: agregar, sacar o reformular una es cambiar
// este array, nunca una migración — es a propósito el primer paso hacia flags configurables por
// regla (pedido del dueño, ver docs/tecnico/TODO.md): hoy las marca Felipe a mano, el día de
// mañana las podría marcar un motor de condiciones sin cambiar dónde vive el resultado
// (episodios.flags_triage).
// Agrupadas por SOSPECHA, no en una lista plana: lo que cambia la conducta no es cuántas
// banderas hay sino de qué sospecha se trata — una cauda equina va a emergencia hoy, una sospecha
// de malignidad va a estudio. `urgencia` maneja esa diferencia y la UI la usa para ordenar y
// pintar.
//
// 📚 Fuente: Finucane et al., "International Framework for Red Flags for Potential Serious Spinal
//    Pathologies", JOSPT 2020. Detalle de qué se tomó y qué no: docs/tecnico/BIBLIOGRAFIA-CLINICA.md §1.
//    La distinción emergencia/urgente es NUESTRA, derivada de la urgencia que describe el marco.
// A dónde se deriva. Hasta 2026-08-26 esto era prosa dentro de `nota` ("Derivar a estudio
// médico"): alcanzaba para que Felipe leyera qué hacer, pero no para registrar qué hizo. Ahora el
// destino se GUARDA (`episodios.triage_derivado_a`), y por eso necesita keys.
//
// `sugeridoPara` no es una regla automática: es el default que el formulario propone según qué
// grupo de banderas se marcó. Felipe puede cambiarlo siempre — asiste, no decide (D60).
//
// `corto` es para los GRÁFICOS del dashboard, nada más: la columna de etiquetas de svg-barras
// mide 130px y recorta en silencio todo lo que no entra ("Emergencia / puerta de..."). El label
// largo sigue siendo el que se elige en el formulario y el que se lee en la ficha, donde hay
// lugar y donde la precisión importa más que el ancho.
const DESTINOS_KEYS = [
  "emergencia", "medico_cabecera", "imagenologia", "traumatologia", "neurologia", "otro",
];
const DESTINO_URGENCIA = { emergencia: "emergencia" };

export const DESTINOS_DERIVACION = DESTINOS_KEYS.map((k) => rotCorto(
  k, `cat.destino.${k}`, `cat.destinoCorto.${k}`,
  { urgencia: DESTINO_URGENCIA[k] || "urgente" },
));

// ⚠️ `mapaRot` y no `Object.fromEntries(...map(d => [d.key, d.label]))`: eso LEE el getter una
// vez, al arrancar, y congela el idioma de ese momento.
export const DESTINO_DERIVACION_LABEL = mapaRot(DESTINOS_KEYS, (k) => `cat.destino.${k}`);
export const DESTINO_DERIVACION_CORTO = mapaRot(DESTINOS_KEYS, (k) => `cat.destinoCorto.${k}`);

export const GRUPOS_FLAGS_TRIAGE = [
  {
    key: "cauda_equina",
    get label() { return tc("cat.flagGrupo.cauda_equina"); },
    urgencia: "emergencia",
    derivarA: "emergencia",
    get nota() { return tc("cat.flagNota.cauda_equina"); },
    items: [
      rot("ce_esfinteres", "cat.flag.ce_esfinteres"),
      rot("ce_silla_montar", "cat.flag.ce_silla_montar"),
      rot("ce_sexual", "cat.flag.ce_sexual"),
      rot("ce_bilateral", "cat.flag.ce_bilateral"),
    ],
  },
  {
    key: "fractura",
    get label() { return tc("cat.flagGrupo.fractura"); },
    urgencia: "urgente",
    derivarA: "imagenologia",
    get nota() { return tc("cat.flagNota.fractura"); },
    items: [
      rot("fr_trauma", "cat.flag.fr_trauma"),
      rot("fr_trauma_menor", "cat.flag.fr_trauma_menor"),
      rot("fr_subito", "cat.flag.fr_subito"),
      rot("fr_deformidad", "cat.flag.fr_deformidad", { urgencia: "emergencia" }),
      rot("fr_no_apoya", "cat.flag.fr_no_apoya"),
    ],
  },
  {
    key: "malignidad",
    get label() { return tc("cat.flagGrupo.malignidad"); },
    urgencia: "urgente",
    derivarA: "medico_cabecera",
    get nota() { return tc("cat.flagNota.malignidad"); },
    items: [
      rot("ma_cancer", "cat.flag.ma_cancer"),
      rot("ma_peso", "cat.flag.ma_peso"),
      rot("ma_nocturno", "cat.flag.ma_nocturno"),
      rot("ma_edad", "cat.flag.ma_edad"),
    ],
  },
  {
    key: "infeccion",
    get label() { return tc("cat.flagGrupo.infeccion"); },
    urgencia: "urgente",
    derivarA: "medico_cabecera",
    get nota() { return tc("cat.flagNota.infeccion"); },
    items: [
      rot("in_fiebre", "cat.flag.in_fiebre"),
      rot("in_inmuno", "cat.flag.in_inmuno"),
      rot("in_procedimiento", "cat.flag.in_procedimiento"),
    ],
  },
  {
    key: "neuro",
    get label() { return tc("cat.flagGrupo.neuro"); },
    urgencia: "urgente",
    derivarA: "neurologia",
    get nota() { return tc("cat.flagNota.neuro"); },
    items: [
      rot("ne_motor", "cat.flag.ne_motor"),
    ],
  },
  // ── D154: los grupos que faltaban para que el triage de la ficha diga lo mismo que el pretriage ──
  // Hasta acá el triage era el marco de Finucane, que es de COLUMNA: a un dolor de rodilla, de cabeza
  // o de hombro no le ofrecía nada, mientras que la preconsulta ya preguntaba por artritis séptica,
  // TVP, cefalea secundaria, origen cardíaco y patología vascular cervical. Ahora hay un grupo por
  // cada sospecha del pretriage (public/pretriaje.js), con las mismas fuentes (BIBLIOGRAFIA §12), y
  // el pretriage sugiere estas banderas igual que las de columna.
  //
  // `zonas`: qué zonas de consulta lo vuelven pertinente (null = todas). La ficha muestra primero
  // los grupos de la zona del paciente y pliega el resto. Son los mismos grupos de zonas del pretriage.
  //
  // `urgencia` de un ítem pisa la del grupo, y `urgenciaDe()` la deriva de la combinación: una
  // cefalea "en estallido" es emergencia aunque el grupo sea urgente, y una articulación es
  // emergencia cuando está hinchada Y caliente, no por una sola de las dos (BIBLIOGRAFIA §12).
  {
    key: "mielopatia",
    get label() { return tc("cat.flagGrupo.mielopatia"); },
    urgencia: "urgente",
    derivarA: "neurologia",
    zonas: ZONAS_CERVICALES,
    get nota() { return tc("cat.flagNota.mielopatia"); },
    items: [
      rot("ne_mielopatia", "cat.flag.ne_mielopatia"),
    ],
  },
  {
    key: "vascular",
    get label() { return tc("cat.flagGrupo.vascular"); },
    urgencia: "emergencia",
    derivarA: "emergencia",
    zonas: ZONAS_CERVICALES,
    get nota() { return tc("cat.flagNota.vascular"); },
    items: [
      rot("va_neuro", "cat.flag.va_neuro"),
      rot("va_subito", "cat.flag.va_subito"),
      rot("va_mareo", "cat.flag.va_mareo", { urgencia: "urgente" }),
    ],
  },
  {
    key: "cefalea",
    get label() { return tc("cat.flagGrupo.cefalea"); },
    urgencia: "urgente",
    derivarA: "neurologia",
    zonas: ["cabeza"],
    get nota() { return tc("cat.flagNota.cefalea"); },
    items: [
      rot("cf_estallido", "cat.flag.cf_estallido", { urgencia: "emergencia" }),
      rot("cf_neuro", "cat.flag.cf_neuro", { urgencia: "emergencia" }),
      rot("cf_fiebre_rigidez", "cat.flag.cf_fiebre_rigidez", { urgencia: "emergencia" }),
      rot("cf_valsalva_posicional", "cat.flag.cf_valsalva_posicional"),
      rot("cf_progresiva", "cat.flag.cf_progresiva"),
      rot("cf_nueva", "cat.flag.cf_nueva"),
      rot("cf_contexto", "cat.flag.cf_contexto"),
    ],
  },
  {
    key: "cardiaca",
    get label() { return tc("cat.flagGrupo.cardiaca"); },
    urgencia: "urgente",
    derivarA: "medico_cabecera",
    zonas: ZONAS_TORACICAS,
    get nota() { return tc("cat.flagNota.cardiaca"); },
    items: [
      rot("ca_esfuerzo", "cat.flag.ca_esfuerzo"),
      rot("ca_sintomas", "cat.flag.ca_sintomas", { urgencia: "emergencia" }),
    ],
  },
  {
    key: "articulacion",
    get label() { return tc("cat.flagGrupo.articulacion"); },
    urgencia: "urgente",
    derivarA: "emergencia",
    zonas: ZONAS_ARTICULARES,
    get nota() { return tc("cat.flagNota.articulacion"); },
    urgenciaDe: (k) => (k.includes("ar_hinchada") && k.includes("ar_caliente") ? "emergencia" : "urgente"),
    items: [
      rot("ar_hinchada", "cat.flag.ar_hinchada"),
      rot("ar_caliente", "cat.flag.ar_caliente"),
      rot("ar_roja", "cat.flag.ar_roja"),
    ],
  },
  {
    key: "tvp",
    get label() { return tc("cat.flagGrupo.tvp"); },
    urgencia: "urgente",
    derivarA: "medico_cabecera",
    zonas: ZONAS_TVP,
    get nota() { return tc("cat.flagNota.tvp"); },
    urgenciaDe: (k) => (k.includes("tv_hinchazon") && k.includes("tv_riesgo") ? "emergencia" : "urgente"),
    items: [
      rot("tv_hinchazon", "cat.flag.tv_hinchazon"),
      rot("tv_riesgo", "cat.flag.tv_riesgo"),
    ],
  },
];

const RANGO_URGENCIA = { urgente: 1, emergencia: 2 };

/**
 * D154 — la urgencia de un grupo según QUÉ se tildó: `urgenciaDe()` si el grupo la define, si no la
 * mayor entre la del grupo y la de cada ítem tildado. Sin nada tildado, la del grupo.
 */
export function urgenciaDeGrupo(grupo, flags = []) {
  const marcados = grupo.items.filter((it) => flags.includes(it.key)).map((it) => it.key);
  if (grupo.urgenciaDe && marcados.length) return grupo.urgenciaDe(marcados);
  return marcados.reduce((u, k) => {
    const del = grupo.items.find((it) => it.key === k)?.urgencia || grupo.urgencia;
    return RANGO_URGENCIA[del] > RANGO_URGENCIA[u] ? del : u;
  }, grupo.urgencia);
}

/** D154 — ¿el grupo corresponde a alguna de estas zonas? Sin zonas conocidas, todos corresponden. */
export function grupoPertinente(grupo, zonas = []) {
  return !grupo.zonas || !zonas.length || zonas.some((z) => grupo.zonas.includes(z));
}

// Lista plana derivada — la usan la validación del server y el mapa de labels, para no repetir
// el recorrido de los grupos en cada lugar que necesita "¿esta key existe?".
// ⚠️ Sin spread: `{ ...it }` copiaría el rótulo YA RESUELTO y congelaría el idioma de arranque.
// Cada entrada se rearma con sus propios getters, apuntando a las mismas claves que el grupo.
export const FLAGS_TRIAGE = GRUPOS_FLAGS_TRIAGE.flatMap((g) =>
  g.items.map((it) => Object.defineProperty(
    rot(it.key, `cat.flag.${it.key}`, { grupo: g.key, urgencia: it.urgencia || g.urgencia }),
    "grupoLabel", { get: () => tc(`cat.flagGrupo.${g.key}`), enumerable: true, configurable: true },
  ))
);

// ── Fenotipado del dolor (docx "PROYECTO ASISTENTE DE CONSULTA", bloque de las tres puertas) ──
//
// Las tres puertas del docx son, textualmente, los sistemas de gradación publicados por la IASP.
// Se implementan con SUS criterios y SU lógica de gradación, no con una aproximación:
//
//   · Neuropático  → Finnerup et al., "Neuropathic pain: an updated grading system for research
//                    and clinical practice", PAIN 2016;157(8):1599-1606. Es SECUENCIAL: cada
//                    nivel exige el anterior (posible → probable → definido).
//   · Nociplástico → Kosek et al., "Chronic nociplastic pain affecting the musculoskeletal
//                    system: clinical criteria and grading system", PAIN 2021;162(11):2629-2634.
//                    "Posible" exige los CUATRO criterios; "probable" suma hipersensibilidad
//                    referida y comorbilidades.
//   · Nociceptivo  → indicadores clínicos de Smart et al. (Delphi de expertos + validación
//                    discriminativa, Man Ther 2010-2012). No tiene gradación formal: es un
//                    patrón que se reconoce por acumulación de indicadores.
//
// ⚠️ Esto ASISTE, no diagnostica (misma filosofía que D16 con la nota clínica): el sistema
// muestra qué criterios se cumplen y qué grado sale de ahí, y Felipe decide. Nunca bloquea.
//
// 📚 La bibliografía completa —qué se tomó de cada fuente, y qué decisiones son NUESTRAS y no de
//    la fuente— está en docs/tecnico/BIBLIOGRAFIA-CLINICA.md §2, §3 y §4. Ese documento es de
//    lectura obligatoria antes de tocar cualquier criterio o umbral de acá abajo.

export const CRITERIOS_NEUROPATICO = [
  rot("np_lesion", "cat.np.np_lesion", { nivel: "posible" }),
  rot("np_distribucion", "cat.np.np_distribucion", { nivel: "posible" }),
  rot("np_signos", "cat.np.np_signos", { nivel: "probable" }),
  rot("np_prueba", "cat.np.np_prueba", { nivel: "definido" }),
];

// D154 — "Sin disestesias" pasó a "Disestesias", a pedido del dueño: una casilla que se tilda
// cuando algo NO está se leía al revés. Ahora se tilda si las hay, y el criterio de Smart sigue
// siendo el mismo —la AUSENCIA de disestesias suma al patrón nociceptivo—: `inverso` es lo que
// le dice a perfilNociceptivo() que cuente la casilla sin tildar.
export const CRITERIOS_NOCICEPTIVO = [
  "nc_localizado", "nc_mecanico", "nc_predecible", "nc_hallazgos", "nc_proporcional",
  "nc_disestesias", "nc_evolucion",
].map((k) => rot(k, `cat.nc.${k}`, k === "nc_disestesias" ? { inverso: true } : {}));

export const CRITERIOS_NOCIPLASTICO = [
  // Los cuatro obligatorios de Kosek 2021 para "posible". `duracion` no se tilda: se deriva de
  // la temporalidad que ya se registró arriba (D59) — preguntarlo dos veces invita a que se
  // contradigan entre sí.
  rot("npl_distribucion", "cat.npl.npl_distribucion", { obligatorio: true }),
  rot("npl_no_explicado", "cat.npl.npl_no_explicado", { obligatorio: true }),
  rot("npl_hipersensibilidad", "cat.npl.npl_hipersensibilidad", { obligatorio: true }),
  // Los que elevan "posible" a "probable".
  rot("npl_hipersensibilidad_referida", "cat.npl.npl_hipersensibilidad_referida", { eleva: true }),
  rot("npl_comorbilidades", "cat.npl.npl_comorbilidades", { eleva: true }),
];

// Los "moduladores" del docx. No definen el mecanismo — explican por qué dos personas con el
// mismo mecanismo evolucionan distinto, y son los que orientan el plan de tratamiento.
const MODULADORES_KEYS = [
  "mod_sueno", "mod_miedo", "mod_catastrofismo", "mod_autoeficacia",
  "mod_estres", "mod_funcion", "mod_actividad", "mod_contexto",
];

export const MODULADORES_DOLOR = MODULADORES_KEYS.map(
  (k) => rotCorto(k, `cat.mod.${k}`, `cat.modCorto.${k}`)
);

// Mismo criterio que DESTINO_DERIVACION_CORTO: la etiqueta larga es la que se tilda en el
// formulario y la que se lee en la ficha; esta es solo para que el gráfico no la recorte.
export const MODULADOR_CORTO = mapaRot(MODULADORES_KEYS, (k) => `cat.modCorto.${k}`);

/**
 * Grado neuropático (Finnerup 2016). SECUENCIAL a propósito: sin los dos criterios de entrada no
 * hay grado, por más que estén tildados los de abajo — marcar "prueba diagnóstica" sin
 * distribución plausible no hace un dolor neuropático definido, hace un criterio mal tildado.
 */
export function gradoNeuropatico(criterios = []) {
  const tiene = (k) => criterios.includes(k);
  if (!tiene("np_lesion") || !tiene("np_distribucion")) return null;
  if (!tiene("np_signos")) return "posible";
  return tiene("np_prueba") ? "definido" : "probable";
}

/**
 * Grado nociplástico (Kosek 2021). Exige >3 meses — por eso recibe `temporalidad`, que ya se
 * deriva de la duración registrada (D59): la regla del docx ("si tiene menos de tres meses,
 * descartar nociplástico crónico") queda implementada acá y en un solo lugar.
 */
export function gradoNociplastico(criterios = [], temporalidad = null) {
  if (temporalidad !== "cronico") return null;
  const tiene = (k) => criterios.includes(k);
  const obligatorios = CRITERIOS_NOCIPLASTICO.filter((c) => c.obligatorio).map((c) => c.key);
  if (!obligatorios.every(tiene)) return "poco_probable";
  const elevan = CRITERIOS_NOCIPLASTICO.filter((c) => c.eleva).map((c) => c.key);
  return elevan.every(tiene) ? "probable" : "posible";
}

/**
 * Nociceptivo: sin gradación formal en la literatura, se reconoce por acumulación de
 * indicadores. El corte en 4 de 7 es una convención NUESTRA para poder mostrar algo, no un
 * umbral publicado — por eso se etiqueta "predominante"/"parcial" y nunca "definido".
 */
export function perfilNociceptivo(criterios = []) {
  const positivos = criterios.filter((k) => CRITERIOS_NOCICEPTIVO.some((c) => c.key === k && !c.inverso)).length;
  // D154 — sin ningún indicador positivo tildado, la puerta no se evaluó: que falten las
  // disestesias no alcanza para decir "1 de 7". Con alguno, un inverso SIN tildar suma.
  if (positivos === 0) return null;
  const inversos = CRITERIOS_NOCICEPTIVO.filter((c) => c.inverso && !criterios.includes(c.key)).length;
  const n = positivos + inversos;
  return { n, total: CRITERIOS_NOCICEPTIVO.length, grado: n >= 4 ? "predominante" : "parcial" };
}

/**
 * El "mecanismo predominante" del docx: una LECTURA de los tres grados, no un diagnóstico.
 *
 * Vivía dentro de decorarTriage() en admin.js, que es la ficha del paciente. Desde que el
 * dashboard agrupa episodios POR mecanismo (D118) hacían falta los dos, y dos copias de esta
 * regla es exactamente el problema que el resto del fenotipado evita guardando criterios en vez
 * de grados: la ficha diría "mixto" y el dashboard lo contaría como "neuropático".
 *
 * Devuelve la KEY (o null). El label sale de LABEL_MECANISMO — nunca al revés.
 *
 * "Mixto" cuando hay más de un mecanismo con evidencia fuerte, en vez de elegir uno: el docx lo
 * marca como probablemente muy frecuente, y quedarse con el primero de la lista sería inventar
 * una jerarquía que ninguna de las tres fuentes propone.
 */
export function mecanismoPredominante({ gradoNeuro = null, gradoNopl = null, perfilNoci = null } = {}) {
  const fuertes = [];
  if (gradoNeuro === "probable" || gradoNeuro === "definido") fuertes.push("neuropatico");
  if (gradoNopl === "probable" || gradoNopl === "posible") fuertes.push("nociplastico");
  if (perfilNoci?.grado === "predominante") fuertes.push("nociceptivo");
  return fuertes.length > 1 ? "mixto" : (fuertes[0] || null);
}

export const LABEL_MECANISMO = mapaRot(
  ["neuropatico", "nociceptivo", "nociplastico", "mixto", "sin_patron"],
  (k) => `cat.mecanismo.${k}`,
);

// Los episodios evaluados a los que ningún mecanismo les da evidencia fuerte. No es un error ni
// un caso raro: es "se evaluó y no hay un patrón claro todavía", y contarlos aparte evita que el
// gráfico sugiera que todo episodio tiene mecanismo asignado.
export const MECANISMO_SIN_PATRON = "sin_patron";

export const LABEL_GRADO_NEUROPATICO = mapaRot(
  ["posible", "probable", "definido"], (k) => `cat.gradoNeuro.${k}`);
export const LABEL_GRADO_NOCIPLASTICO = mapaRot(
  ["poco_probable", "posible", "probable"], (k) => `cat.gradoNopl.${k}`);
export const LABEL_GRADO_NOCICEPTIVO = mapaRot(
  ["parcial", "predominante"], (k) => `cat.gradoNoci.${k}`);

export const UNIDADES_DURACION = [
  "dias", "semanas", "meses",
].map((k) => rot(k, `cat.duracion.${k}`));

// Corte clínico agudo/crónico: > 3 meses (docx). Un solo lugar para derivarlo desde
// duracion_valor/duracion_unidad (D59) — nunca se guarda aparte, para no arriesgar que quede
// desactualizado si la duración se corrige después.
//
// D117 — el corte pasa a ser CONSTANTE EXPORTADA porque desde 2026-08-26 lo necesitan tres capas:
// esta función (ficha e historia), `reportFields.js` (que lo interpola en la expresión SQL del
// campo "temporalidad") y `analiticaRepo` (que lo manda como parámetro). Las tres leen de acá;
// ninguna vuelve a escribir el 3.
//
// La CONVERSIÓN a meses, en cambio, sí queda en dos lugares —acá y en la migración 0034, que
// precalcula `duracion_meses` en la vista— porque una vista SQL no puede importar JavaScript. Es
// aritmética de unidades, no criterio clínico: si mañana cambia el corte se toca solo esta
// constante, y la vista sigue sirviendo sin migración nueva.
export const CORTE_CRONICO_MESES = 3;

export const MESES_POR_UNIDAD = { dias: 1 / 30, semanas: 1 / 4.345, meses: 1 };

/** Duración en meses, o null si no hay una duración utilizable. Sin criterio clínico adentro. */
export function duracionEnMeses(valor, unidad) {
  if (valor === null || valor === undefined || valor === "" || !unidad) return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) return null;
  const factor = MESES_POR_UNIDAD[unidad];
  if (factor === undefined) return null;
  return n * factor;
}

export function temporalidadDeDuracion(valor, unidad) {
  const meses = duracionEnMeses(valor, unidad);
  if (meses === null) return null;
  return meses > CORTE_CRONICO_MESES ? "cronico" : "agudo";
}
