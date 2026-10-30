// Registro de tipos de formulario. **Fuente única del nombre de cada uno**: hasta 2026-08-25 el
// label vivía acá pero tres pantallas lo pisaban a mano, y el formulario intermedio terminó
// llamándose de tres maneras distintas según dónde se lo mirara. Ahora nadie escribe el nombre
// de un formulario en una vista: se lee de acá.
//
// Campos de cada tipo:
//   label      — el nombre que ve Felipe en el panel.
//   tituloPublico / subtituloPublico — el encabezado que ve el PACIENTE al abrir el formulario.
//                Todos los tipos comparten los mismos campos y el mismo endpoint (D15/0021): lo
//                único que cambia entre uno y otro es este encabezado y con qué `tipo` se guarda
//                la consulta.
//   momento    — cuándo se usa en el tratamiento. Es lo que ordena el selector de la ficha, y
//                lo que hace que el conjunto se entienda como conjunto en vez de como una bolsa.
//   desdeEpisodio — se genera desde un episodio puntual, nunca desde el selector genérico.
// ── LOS RÓTULOS SE TRADUCEN; LAS KEYS NO (D127) ─────────────────────────────────────────────
// Mismo criterio y misma trampa que en catalogos.js: getters, no valores, porque este módulo se
// evalúa una vez al arrancar y el idioma cambia en caliente. Y ojo con el spread, que congela:
// FORM_TYPES_SUELTOS se rearma abajo con getters propios en vez de `{ key, ...ft }`.
import { traductor, idiomaInstalacion } from "../i18n/index.js";

const tf = (clave) => traductor(idiomaInstalacion())(clave);

/** Define `label`/`tituloPublico`/`subtituloPublico` como getters sobre un tipo de formulario. */
function tipo(key, extra, conTitulo = true) {
  const o = Object.defineProperty(extra, "label", {
    get: () => tf(`form.${key}.label`), enumerable: true, configurable: true,
  });
  if (!conTitulo) return o;
  Object.defineProperty(o, "tituloPublico", {
    get: () => tf(`form.${conTitulo === true ? key : conTitulo}.titulo`), enumerable: true, configurable: true,
  });
  Object.defineProperty(o, "subtituloPublico", {
    get: () => tf(`form.${key}.sub`), enumerable: true, configurable: true,
  });
  return o;
}

export const FORM_TYPES = {
  // Los dos comparten el título público ("Preconsulta") y el subtítulo del genérico: para el
  // paciente son el mismo formulario, lo que cambia es qué campos trae.
  //
  // `bloques` (D136): las preguntas variables que lleva el formulario, de src/config/bloques.js.
  // El painDETECT va en todos los que comparten el formulario común: se abre solo si el paciente
  // dice que el dolor lleva 3 meses o más. Los datos sociodemográficos (D140) van en los ingresos
  // de adultos; no en el del niño (el estado civil de un niño no es un dato) ni en el
  // personalizado, que tiene los campos que eligió Felipe y no le agrega obligatorios por su cuenta.
  //
  // D141 — el PRETRIAGE de banderas rojas y la PSFS van en todos los formularios del paciente,
  // incluido el intermedio: una bandera roja puede aparecer en cualquier momento del tratamiento,
  // y la PSFS es una medida de resultado que solo sirve si se repite. El vestibular lleva el
  // pretriage (sus preguntas generales valen para cualquiera) pero no la PSFS: su batería ya mide
  // la función con el DHI.
  generico: tipo("generico", { momento: "ingreso", enabled: true, bloques: ["sociodemografico", "pretriaje", "paindetect", "psfs", "habitos"] }),
  personalizado: tipo("personalizado", { momento: "ingreso", enabled: true, bloques: ["pretriaje", "paindetect", "psfs", "habitos"] }, "generico"),

  // Variantes por segmento (2026-08-25). Estaban declaradas y APAGADAS desde la Etapa 1, ocupando
  // cuatro de las siete líneas del desplegable en gris. Se encienden con el MISMO formulario que
  // el genérico y un encabezado propio — que es exactamente lo que hoy las diferencia de verdad.
  //
  // ⚠️ La diferenciación de CAMPOS por segmento sigue pendiente y es decisión clínica de Felipe
  // (a un niño le contesta un adulto y cambia el consentimiento; a un adulto mayor conviene
  // preguntarle por caídas y polifarmacia; a un joven, por deporte y carga). Ver TODO.md. Hasta
  // entonces esto es honesto: mismo formulario, distinto encabezado, y el tipo queda registrado
  // para poder segmentar la estadística desde ya.
  adulto_mayor: tipo("adulto_mayor", { momento: "ingreso", enabled: true, bloques: ["sociodemografico", "pretriaje", "paindetect", "psfs", "habitos"] }, "generico"),
  joven: tipo("joven", { momento: "ingreso", enabled: true, bloques: ["sociodemografico", "pretriaje", "paindetect", "psfs", "habitos"] }, "generico"),
  ninio: tipo("ninio", { momento: "ingreso", enabled: true, bloques: ["pretriaje", "paindetect", "psfs"] }, "generico"),

  // Preconsulta VESTIBULAR / mareo crónico (D137, 2026-09-14). La primera variante con campos
  // propios de verdad: adapta al formato del programa el triaje de la investigación de Migue.
  // Felipe la elige al generar el link — es para quien ya se sabe que viene por mareo, no una rama
  // que se abre sola.
  //
  // `campos`: qué campos del NÚCLEO muestra. Sin body chart ni escala de dolor común (no todo el
  // que tiene mareo tiene dolor: el bloque pregunta si le duele, dónde y cuánto), sin la pregunta
  // de dolor crónico (el bloque pregunta hace cuánto tiene síntomas) y sin fármacos ni diagnóstico
  // en texto libre (el bloque los pregunta con opciones, que es lo que la investigación necesita).
  //
  // `cuestionarios` (D140): la batería de las pantallas siguientes del formulario de Migue, en su
  // orden. Se contestan adentro de la preconsulta y se guardan como tomas de cuestionario
  // (extraerCuestionarios en src/config/cuestionarios.js), no como bloques.
  vestibular: tipo("vestibular", {
    momento: "ingreso", enabled: true, bloques: ["sociodemografico", "pretriaje", "vestibular", "habitos", "comentario"],
    cuestionarios: ["dhi", "npq", "tskd", "csi", "phq4", "phq8"], motivoCategoria: "mareo_vestibular",
    campos: ["nombres", "apellidos", "fechaNacimiento", "telefono", "ocupacion", "residencia", "familia",
      "enfermedades", "implantes", "cirugias", "lesiones", "motivo", "actividad", "adjuntos"],
  }),

  // Formulario INTERMEDIO (migración 0021): el mismo formulario, llenado en el MEDIO del
  // tratamiento, para poder comparar contra el ingreso y ver si mejoró. Se guarda con
  // `tipo='intermedio'` para que no cuente como un ingreso nuevo en el dashboard.
  intermedio: tipo("intermedio", { momento: "durante", desdeEpisodio: true, enabled: true, bloques: ["pretriaje", "paindetect", "psfs"] }),

  // C7 (módulo clínico). Label "Feedback y fin de tratamiento" (2026-08-24, pedido del dueño) —
  // reemplaza "Postconsulta": el motivo "Después de la sesión" del formulario intermedio hacía
  // exactamente lo mismo con otro nombre. El código interno sigue siendo "postconsulta" — no se
  // renombra la clave, solo el label, para no tocar filtros ni reportes que ya guardan ese valor.
  // Cuestionarios validados (D114). Es UN tipo de formulario, no uno por instrumento: cuál se
  // manda lo dice `links.cuestionario_key`. Si fuera un tipo por instrumento, agregar un
  // cuestionario nuevo obligaría a tocar este registro, el selector y los guards de ruta.
  //
  // `desdeEpisodio` porque siempre sale de un episodio abierto —un cuestionario suelto, sin un
  // problema clínico al que referirse, no significa nada— y porque es lo que lo mantiene fuera
  // del selector genérico de /admin/links y fuera del guard de /preconsulta/:token.
  // Sin título ni subtítulo propios: los pone cada cuestionario (src/config/cuestionarios.js),
  // que es lo único que distingue al Örebro de la Tampa para quien lo abre.
  cuestionario: tipo("cuestionario", { momento: "durante", desdeEpisodio: true, enabled: true }, false),

  //
  // D147 (2026-10-24, pedido del dueño): el cierre pasa al formulario COMÚN, como el intermedio,
  // "para terminar de ver la evolución". Del núcleo solo trae lo que se compara contra el ingreso
  // —actividad física, intensidad del dolor y body chart (pintar es opcional)— y sus bloques. La
  // PSFS no está en `bloques`: repite las actividades del ingreso, que llegan cifradas en el link
  // (ver bloquesCierre.js). Ya no pregunta adherencia ni mejoría percibida.
  // D153 — el LINK DE TAREAS para el paciente: rutina, recomendaciones y los links a los cuestionarios
  // y formularios que se le pidieron, en una sola página. No es un formulario (no se contesta ni se
  // "usa"), pero es un link más para viajar por la misma publicación. `enabled: false` lo deja fuera
  // de todos los selectores y de POST /admin/links: se genera solo desde la sesión. `desdeEpisodio`
  // hace que /preconsulta/:token no lo abra como un ingreso.
  paquete: tipo("paquete", { momento: "durante", desdeEpisodio: true, enabled: false }, false),
  // D163/D164 — un quiz y un juego del link de tareas. Como el paquete: nunca en un selector, se
  // crean solo desde la sesión, y se pueden hacer muchas veces (no se "usan").
  quiz: tipo("quiz", { momento: "durante", desdeEpisodio: true, enabled: false }, false),
  juego: tipo("juego", { momento: "durante", desdeEpisodio: true, enabled: false }, false),

  postconsulta: tipo("postconsulta", {
    momento: "cierre", desdeEpisodio: true, enabled: true,
    campos: ["actividad", "escalaDolor", "bodyChart"],
    bloques: ["cierreActividad", "cierreFarmacos", "cierreReflexion"],
  }),
};

// Los que se generan desde un episodio y no desde el selector genérico de /admin/links.
// Derivado del registro de arriba: agregar un tipo nuevo con `desdeEpisodio` alcanza para que
// quede excluido de ese selector, sin tener que acordarse de tocar también esta lista.
export const FORM_TYPES_DE_EPISODIO = Object.entries(FORM_TYPES)
  .filter(([, ft]) => ft.desdeEpisodio)
  .map(([key]) => key);

// Los que SÍ se ofrecen en el selector genérico de /admin/links: habilitados y no de episodio.
// Hasta 2026-08-25 esa vista filtraba a mano solo `postconsulta` y dejaba pasar `intermedio`,
// que después el server rechazaba con un 400 — un callejón sin salida alcanzable con dos clics.
// ⚠️ Sin `{ key, ...ft }`: el spread LEE el getter del label una vez, al importar, y congela el
// idioma de arranque. Se delega en el registro de arriba, que sigue vivo.
export const FORM_TYPES_SUELTOS = Object.entries(FORM_TYPES)
  .filter(([, ft]) => ft.enabled && !ft.desdeEpisodio)
  .map(([key, ft]) => Object.defineProperties({ key }, {
    label: { get: () => ft.label, enumerable: true },
    momento: { value: ft.momento, enumerable: true },
    enabled: { value: ft.enabled, enumerable: true },
  }));

export const MOMENTOS_FORMULARIO = ["ingreso", "durante", "cierre"].map((key) =>
  Object.defineProperties({ key }, {
    label: { get: () => tf(`form.momento.${key}`), enumerable: true },
    ayuda: { get: () => tf(`form.momentoAyuda.${key}`), enumerable: true },
  }));

// Campos que se pueden incluir/excluir cuando form_type = "personalizado".
// El label es lo que ve el admin al armar el link; la key es el name del input en el form.
export const CUSTOMIZABLE_FIELDS = [
  Object.defineProperty({ key: "nombres" }, "label", { get: () => tf("form.campo.nombres"), enumerable: true }),
  Object.defineProperty({ key: "apellidos" }, "label", { get: () => tf("form.campo.apellidos"), enumerable: true }),
  Object.defineProperty({ key: "fechaNacimiento" }, "label", { get: () => tf("form.campo.fechaNacimiento"), enumerable: true }),
  Object.defineProperty({ key: "telefono" }, "label", { get: () => tf("form.campo.telefono"), enumerable: true }),
  Object.defineProperty({ key: "ocupacion" }, "label", { get: () => tf("form.campo.ocupacion"), enumerable: true }),
  Object.defineProperty({ key: "residencia" }, "label", { get: () => tf("form.campo.residencia"), enumerable: true }),
  Object.defineProperty({ key: "familia" }, "label", { get: () => tf("form.campo.familia"), enumerable: true }),
  Object.defineProperty({ key: "enfermedades" }, "label", { get: () => tf("form.campo.enfermedades"), enumerable: true }),
  Object.defineProperty({ key: "implantes" }, "label", { get: () => tf("form.campo.implantes"), enumerable: true }),
  Object.defineProperty({ key: "farmacos" }, "label", { get: () => tf("form.campo.farmacos"), enumerable: true }),
  Object.defineProperty({ key: "cirugias" }, "label", { get: () => tf("form.campo.cirugias"), enumerable: true }),
  Object.defineProperty({ key: "lesiones" }, "label", { get: () => tf("form.campo.lesiones"), enumerable: true }),
  Object.defineProperty({ key: "actividad" }, "label", { get: () => tf("form.campo.actividad"), enumerable: true }),
  Object.defineProperty({ key: "diagnostico" }, "label", { get: () => tf("form.campo.diagnostico"), enumerable: true }),
  Object.defineProperty({ key: "motivo" }, "label", { get: () => tf("form.campo.motivo"), enumerable: true }),
  Object.defineProperty({ key: "dolorCronico" }, "label", { get: () => tf("form.campo.dolorCronico"), enumerable: true }),
  Object.defineProperty({ key: "escalaDolor" }, "label", { get: () => tf("form.campo.escalaDolor"), enumerable: true }),
  Object.defineProperty({ key: "bodyChart" }, "label", { get: () => tf("form.campo.bodyChart"), enumerable: true }),
  Object.defineProperty({ key: "adjuntos" }, "label", { get: () => tf("form.campo.adjuntos"), enumerable: true }),
];

/**
 * Qué campos del núcleo muestra un formulario (D136). `null` = todos.
 *
 * Un link "personalizado" trae su propia lista (la armó Felipe al generarlo) y manda esa; si no,
 * decide el tipo. La vista (`show()`), la guarda del servidor, el PDF y el mail usan esta misma
 * función: si cada uno decidiera por su lado, el servidor exigiría campos que la vista no mostró.
 */
export function camposDe(formType, customFields = null) {
  if (Array.isArray(customFields)) return customFields;
  return FORM_TYPES[formType]?.campos || null;
}

// Los tipos que Felipe puede elegir al cargar un ingreso a mano (/admin/nuevo-ingreso, D137). Solo
// los que cambian QUÉ se pregunta: adulto mayor, joven y niño hoy son el mismo formulario con otro
// encabezado, y ofrecerlos acá sería elegir entre tres opciones idénticas.
export const TIPOS_CARGA_MANUAL = ["generico", "vestibular"];

export const VENCIMIENTO_OPCIONES = [3, 7]; // días
