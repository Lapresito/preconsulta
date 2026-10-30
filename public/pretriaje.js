// PRETRIAGE DE BANDERAS ROJAS EN LA PRECONSULTA (D141) — LA REGLA.
//
// UN SOLO ARCHIVO PARA LOS DOS LADOS, igual que public/condiciones.js. El navegador lo usa al
// terminar el formulario para decirle al paciente, en el momento, si tiene que ir a una
// emergencia; el servidor lo importa (src/config/bloques.js) para mostrarle a Felipe lo mismo en
// la ficha, la bandeja y la campanita. Con dos copias, el paciente leería "andá a emergencia" y
// Felipe vería un "sin banderas", o al revés.
//
// Sin dependencias, sin DOM y SIN TEXTO: devuelve keys. Los rótulos los resuelve quien muestra
// (el servidor con i18n, el navegador con los textos que le pasa la vista). Es lo que permite
// que la regla no sepa en qué idioma está la instalación.
//
// QUÉ HACE. Lee lo que el paciente contestó —la zona del dolor, la edad, el sexo, los
// antecedentes y las preguntas del bloque `pretriaje`— y arma SOSPECHAS, no banderas sueltas:
// el marco de la IFOMPT (Finucane 2020) insiste en que una bandera aislada vale poco y que lo que
// cambia la conducta es la combinación. Cada sospecha trae su nivel, la evidencia que la prendió
// y las banderas del triage de la sesión que correspondería tildar.
//
// NIVELES — los dos primeros son los del glosario del mismo marco:
//   emergencia → derivar EL MISMO DÍA, no empezar tratamiento.
//   urgente    → derivar dentro de los 5 días, no empezar tratamiento hasta descartarlo.
//   atencion   → una bandera sola: no deriva, pero Felipe la tiene que preguntar en la consulta.
//
// ⚠️ ASISTE, NO DIAGNOSTICA (D16/D60). Nada de esto marca una bandera del triage ni toca el
// episodio: es una lectura para que Felipe decida. Y es un CRIBADO hecho con lo que el paciente
// sabe contestar solo — sin examen físico, que es donde se confirma casi todo.
//
// 📚 De dónde sale cada regla, y cuáles son decisión nuestra: docs/tecnico/BIBLIOGRAFIA-CLINICA.md §12.

export const NIVELES = ["atencion", "urgente", "emergencia"];

// Grupos de zonas (keys de ZONAS_CONSULTA, src/config/catalogos.js) que abren cada módulo.
// Viven acá porque los usan las dos mitades: el bloque para decidir qué preguntar y esta regla
// para decidir qué significa lo contestado.
export const ZONAS_COLUMNA = ["cuello", "espalda_alta", "espalda_baja"];
export const ZONAS_LUMBOPELVICAS = ["espalda_baja", "cadera"];
export const ZONAS_CERVICALES = ["cuello", "cabeza"];
export const ZONAS_TORACICAS = ["espalda_alta", "hombro"];
export const ZONAS_ARTICULARES = ["hombro", "brazo_codo", "muneca_mano", "cadera", "rodilla", "tobillo_pie"];
export const ZONAS_TVP = ["pierna", "rodilla", "tobillo_pie"];
export const ZONAS_APOYO = ["cadera", "pierna", "rodilla", "tobillo_pie"];

// Cánceres con predilección por metástasis ósea (Finucane 2020, tablas 8 y 13: mama, próstata,
// pulmón, riñón, tiroides) más los hematológicos, por el mieloma, que el mismo marco nombra como
// diagnóstico diferencial del dolor dorsal.
export const CANCER_OSEO = ["mama", "prostata", "pulmon", "rinon", "tiroides", "hematologico"];

// Los síntomas de cauda equina que, solos y nuevos, alcanzan para la emergencia (GIRFT 2023).
const CE_ESFINTERES = ["orina", "intestino", "silla_montar", "sexual"];
const CE_FLAG = { orina: "ce_esfinteres", intestino: "ce_esfinteres", silla_montar: "ce_silla_montar", sexual: "ce_sexual" };
const CERVICAL_VASCULAR = ["vision", "habla", "caidas", "cara"];
const CEFALEA_EMERGENCIA = ["subito", "neuro", "fiebre_rigidez"];
const CEFALEA_URGENTE = ["esfuerzo", "posicion", "progresivo"];
const MALIGNIDAD_SISTEMICOS = ["peso", "sudor_nocturno", "cansancio", "bulto"];
const RIESGOS_INFECCION = ["inmunosupresion", "corticoides", "drogas_iv", "infeccion_reciente", "procedimiento"];
// D154 — la bandera del triage de la ficha que corresponde a cada respuesta de cefalea.
const CEFALEA_FLAG = {
  subito: "cf_estallido", neuro: "cf_neuro", fiebre_rigidez: "cf_fiebre_rigidez",
  esfuerzo: "cf_valsalva_posicional", posicion: "cf_valsalva_posicional", progresivo: "cf_progresiva", nuevo: "cf_nueva",
};
const cfFlags = (keys) => [...new Set(keys.map((k) => CEFALEA_FLAG[k]).filter(Boolean))];

/** Adónde se deriva cada sospecha cuando es urgente (keys de DESTINOS_DERIVACION). Emergencia va siempre a emergencia. */
export const DESTINO_SOSPECHA = {
  cauda_equina: "emergencia",
  fractura: "imagenologia",
  malignidad: "medico_cabecera",
  infeccion: "medico_cabecera",
  neuro: "neurologia",
  mielopatia: "neurologia",
  vascular: "emergencia",
  cefalea: "neurologia",
  cardiaca: "medico_cabecera",
  articulacion: "medico_cabecera",
  tvp: "medico_cabecera",
};

function lista(v) {
  if (Array.isArray(v)) return v.map(String).filter((x) => x !== "ninguno");
  if (v === undefined || v === null || v === "") return [];
  return [String(v)].filter((x) => x !== "ninguno");
}

const rango = (nivel) => NIVELES.indexOf(nivel);

/**
 * @param {object} p
 * @param {object} p.r            - respuestas del bloque `pretriaje` ({ itemKey: valor }).
 * @param {string[]} p.zonas      - keys de ZONAS_CONSULTA que marcó el paciente.
 * @param {number|null} p.edad
 * @param {string|null} p.genero  - "hombre" | "mujer" | "otro"
 * @param {string[]} p.enfermedades - CÓDIGOS (el de cáncer es "cancer").
 * @param {string[]} p.cancerTipos  - keys de TIPOS_CANCER.
 * @returns {{ nivel: string|null, sospechas: Array<{ key, nivel, evidencias: string[], flags: string[], derivarA: string }> }}
 */
export function evaluarPretriaje({ r = {}, zonas = [], edad = null, genero = null, enfermedades = [], cancerTipos = [] } = {}) {
  const enZona = (grupo) => zonas.some((z) => grupo.includes(z));
  const e = Number.isFinite(edad) ? edad : null;
  const sospechas = new Map();

  function marcar(key, nivel, evidencias = [], flags = []) {
    const s = sospechas.get(key) || { key, nivel, evidencias: [], flags: [] };
    if (rango(nivel) > rango(s.nivel)) s.nivel = nivel;
    for (const ev of evidencias) if (!s.evidencias.includes(ev)) s.evidencias.push(ev);
    for (const f of flags) if (!s.flags.includes(f)) s.flags.push(f);
    sospechas.set(key, s);
  }

  const sistemicos = lista(r.sistemicos);
  const factores = lista(r.factores);
  const fiebre = sistemicos.includes("fiebre");
  const trauma = r.trauma === "si";
  const cancer = enfermedades.includes("cancer");
  const columna = enZona(ZONAS_COLUMNA);

  // Síntomas neurológicos de cualquier módulo: los usan la infección (la tríada clásica es dolor
  // de columna + fiebre + déficit) y el traumatismo de columna.
  const ce = lista(r.ce_sintomas);
  const cervical = lista(r.cervical_neuro);
  const neuroColumna = [
    ...(ce.includes("ambas_piernas") ? ["ce_ambas_piernas"] : []),
    ...(r.debilidad_pierna === "si" ? ["debilidad_pierna"] : []),
    ...(cervical.includes("manos") ? ["cn_manos"] : []),
    ...(r.trauma_hormigueo === "si" ? ["cs_hormigueo"] : []),
  ];

  // ── Cauda equina (Finucane 2020 tablas 3-4; GIRFT 2023) ───────────────────────────────────
  if (enZona(ZONAS_LUMBOPELVICAS)) {
    const esfinteres = ce.filter((k) => CE_ESFINTERES.includes(k));
    if (esfinteres.length) {
      // "Ya lo tenía antes de este dolor" no lo descarta —una incontinencia de años igual puede
      // empeorar—, pero la saca de la emergencia: el criterio de GIRFT es la aparición reciente.
      const previo = r.ce_reciente === "previo";
      marcar("cauda_equina", previo ? "urgente" : "emergencia",
        [...esfinteres.map((k) => `ce_${k}`), ...(previo ? ["ce_previo"] : [])],
        esfinteres.map((k) => CE_FLAG[k]));
    }
    if (ce.includes("ambas_piernas")) {
      // Sola es "cauda equina en riesgo", no instalada: urgente. Con cualquiera de las otras ya
      // está en emergencia y esto solo suma evidencia.
      marcar("cauda_equina", "urgente", ["ce_ambas_piernas"], ["ce_bilateral"]);
    }
    if (r.debilidad_pierna === "si") marcar("neuro", "urgente", ["debilidad_pierna"], ["ne_motor"]);
  }

  // ── Cuello: patología vascular y mielopatía (IFOMPT cervical framework 2020) ──────────────
  if (enZona(ZONAS_CERVICALES)) {
    const vasculares = cervical.filter((k) => CERVICAL_VASCULAR.includes(k));
    const subito = r.inicio_subito === "si";
    if (vasculares.length) {
      marcar("vascular", "emergencia", [...vasculares.map((k) => `cn_${k}`), ...(subito ? ["inicio_subito"] : [])],
        ["va_neuro", ...(subito ? ["va_subito"] : [])]);
    }
    if (cervical.includes("mareo")) {
      // El mareo solo es muy común con dolor de cuello y casi nunca vascular; con un dolor que
      // empezó de golpe y distinto a todos, que es el rasgo típico de la disección, sí preocupa.
      marcar("vascular", subito ? "urgente" : "atencion", ["cn_mareo", ...(subito ? ["inicio_subito"] : [])],
        ["va_mareo", ...(subito ? ["va_subito"] : [])]);
    } else if (subito && !vasculares.length) {
      marcar("vascular", "atencion", ["inicio_subito"], ["va_subito"]);
    }
    const mielo = cervical.filter((k) => k === "manos" || k === "equilibrio");
    if (mielo.length) marcar("mielopatia", mielo.length === 2 ? "urgente" : "atencion", mielo.map((k) => `cn_${k}`), ["ne_mielopatia"]);
  }

  // ── Cefalea secundaria (SNNOOP10, Do 2019) ─────────────────────────────────────────────────
  if (zonas.includes("cabeza")) {
    const cf = lista(r.cefalea);
    const graves = cf.filter((k) => CEFALEA_EMERGENCIA.includes(k));
    if (graves.length) marcar("cefalea", "emergencia", graves.map((k) => `cf_${k}`), cfFlags(graves));
    const urgentes = cf.filter((k) => CEFALEA_URGENTE.includes(k));
    if (urgentes.length) marcar("cefalea", "urgente", urgentes.map((k) => `cf_${k}`), cfFlags(urgentes));
    if (cf.includes("nuevo")) marcar("cefalea", e !== null && e >= 50 ? "urgente" : "atencion", ["cf_nuevo", ...(e !== null && e >= 50 ? ["edad50"] : [])], ["cf_nueva"]);
    if (cancer) marcar("cefalea", "urgente", ["cancer"], ["cf_contexto"]);
    if (factores.includes("inmunosupresion")) marcar("cefalea", "urgente", ["inmunosupresion"], ["cf_contexto"]);
    if (trauma) marcar("cefalea", "urgente", ["trauma"], ["cf_contexto"]);
    if (fiebre && !cf.includes("fiebre_rigidez")) marcar("cefalea", "atencion", ["fiebre"]);
  }

  // ── Dolor de origen cardíaco referido al hombro o la espalda alta ─────────────────────────
  if (enZona(ZONAS_TORACICAS)) {
    const esfuerzo = r.cardio_esfuerzo === "si";
    if (r.cardio_sintomas === "si") marcar("cardiaca", "emergencia", ["cardio_sintomas", ...(esfuerzo ? ["cardio_esfuerzo"] : [])], ["ca_sintomas", ...(esfuerzo ? ["ca_esfuerzo"] : [])]);
    else if (esfuerzo) marcar("cardiaca", "urgente", ["cardio_esfuerzo"], ["ca_esfuerzo"]);
  }

  // ── Articulación caliente: artritis séptica hasta que se demuestre lo contrario ───────────
  // D154 — hinchada, caliente y roja se preguntan POR SEPARADO (antes era una sola pregunta que
  // exigía las tres a la vez). La fuente (BIBLIOGRAFIA §12) habla de articulación caliente e
  // hinchada, aun sin fiebre: esas dos juntas, o cualquiera con fiebre, son la emergencia. El resto
  // es decisión nuestra: dos signos que no son ese par → urgente; uno solo → atención.
  const signosArt = enZona(ZONAS_ARTICULARES) ? lista(r.articulacion) : [];
  if (signosArt.length) {
    const evid = [...signosArt.map((k) => `art_${k}`), ...(fiebre ? ["fiebre"] : [])];
    const par = signosArt.includes("hinchada") && signosArt.includes("caliente");
    const nivel = par || fiebre ? "emergencia" : signosArt.length >= 2 ? "urgente" : "atencion";
    marcar("articulacion", nivel, evid, signosArt.map((k) => `ar_${k}`));
  }

  // ── Trombosis venosa profunda (factores de Wells, sin el examen) ──────────────────────────
  if (enZona(ZONAS_TVP) && r.pantorrilla === "si") {
    const riesgos = lista(r.tvp_riesgo).map((k) => `tvp_${k}`);
    if (cancer) riesgos.push("cancer");
    marcar("tvp", riesgos.length ? "emergencia" : "urgente", ["pantorrilla", ...riesgos], ["tv_hinchazon", ...(riesgos.length ? ["tv_riesgo"] : [])]); // i18n-exento: keys de nivel y de evidencia, no texto
  }

  // ── Fractura (Finucane 2020 tablas 8-10; reglas de Ottawa; regla canadiense de columna) ──
  // Edad de riesgo de fractura vertebral: mujeres de 65 o más, hombres de 75 o más (tabla 8).
  // "Otro" usa el corte de 65: ante la duda, el más protector.
  const edadRiesgo = e !== null && (genero === "hombre" ? e >= 75 : e >= 65);
  const osteo = factores.includes("osteoporosis");
  const cortico = factores.includes("corticoides");
  const riesgoOseo = [
    ...(edadRiesgo ? ["riesgo_edad_sexo"] : []),
    ...(osteo ? ["osteoporosis"] : []),
    ...(cortico ? ["corticoides"] : []),
  ];

  if (trauma) {
    const tipo = r.trauma_tipo;
    if (tipo === "alto_impacto") marcar("fractura", "urgente", ["fr_alto_impacto"], ["fr_trauma"]);
    if ((tipo === "bajo_impacto" || tipo === "esfuerzo") && riesgoOseo.length) {
      marcar("fractura", "urgente", [tipo === "esfuerzo" ? "fr_esfuerzo" : "fr_bajo_impacto", ...riesgoOseo],
        ["fr_trauma_menor", ...(tipo === "esfuerzo" ? ["fr_subito"] : [])]);
    } else if (tipo === "esfuerzo") {
      marcar("fractura", "atencion", ["fr_esfuerzo"], ["fr_subito"]);
    }
    if (r.trauma_deformidad === "si") marcar("fractura", "emergencia", ["fr_deformidad"], ["fr_deformidad"]);
    // Una contusión sola es un golpe y queda en "atención"; si ya hay otra señal de fractura, no
    // baja el nivel (marcar() se queda con el mayor) y suma evidencia (tabla 10).
    if (r.trauma_moreton === "si") marcar("fractura", "atencion", ["fr_moreton"]);
    if (enZona(ZONAS_APOYO) && r.apoyo === "no") marcar("fractura", "urgente", ["fr_no_apoya"], ["fr_no_apoya"]);
    if (zonas.includes("rodilla") && e !== null && e >= 55) marcar("fractura", "urgente", ["fr_trauma_rodilla", "edad55"]);
    if (zonas.includes("cuello")) {
      if (r.trauma_hormigueo === "si") marcar("fractura", "emergencia", ["fr_trauma_cuello", "cs_hormigueo"], ["fr_trauma"]);
      if (tipo === "alto_impacto" || (e !== null && e >= 65)) {
        marcar("fractura", "urgente", ["fr_trauma_cuello", ...(e !== null && e >= 65 ? ["edad65"] : [])], ["fr_trauma"]);
      }
    }
    if (columna && neuroColumna.length) marcar("fractura", "emergencia", ["trauma", ...neuroColumna], ["fr_trauma"]);
  }
  // Dolor dorsal en alguien con cáncer u osteoporosis: el marco lo pone en sospecha alta aun sin
  // golpe (tabla 9) — el 70 % de las fracturas no traumáticas y de las metástasis son dorsales.
  if (zonas.includes("espalda_alta") && (cancer || osteo || cortico)) {
    marcar("fractura", "urgente", ["zona_dorsal", ...(cancer ? ["cancer"] : []), ...(osteo ? ["osteoporosis"] : []), ...(cortico ? ["corticoides"] : [])]);
  }

  // ── Malignidad (Finucane 2020 tablas 13-14; Downie 2013) ──────────────────────────────────
  // El antecedente de cáncer es la única bandera que por sí sola sube la probabilidad. Lo demás
  // vale en combinación: una sola señal es "atención", dos o más ya es "urgente".
  const debiles = [
    ...sistemicos.filter((k) => MALIGNIDAD_SISTEMICOS.includes(k)).map((k) => (k === "sudor_nocturno" ? "sudor" : k)),
    ...(r.dolor_nocturno === "no_cede" ? ["nocturno"] : []),
  ];
  const flagsMalig = [
    ...(debiles.includes("peso") ? ["ma_peso"] : []),
    ...(debiles.includes("nocturno") ? ["ma_nocturno"] : []),
  ];
  if (cancer) {
    const oseo = !cancerTipos.length || cancerTipos.some((k) => CANCER_OSEO.includes(k));
    const evid = [oseo ? "cancer_oseo" : "cancer", ...debiles];
    const sitioOseo = columna || zonas.includes("cadera");
    marcar("malignidad", (sitioOseo && oseo) || debiles.length ? "urgente" : "atencion", evid, ["ma_cancer", ...flagsMalig]);
  } else if (debiles.length) {
    // La edad sola no es bandera: suma solo cuando ya hay otra.
    const conEdad = e !== null && e >= 50 ? [...debiles, "edad50"] : debiles;
    marcar("malignidad", conEdad.length >= 2 ? "urgente" : "atencion", conEdad,
      [...flagsMalig, ...(conEdad.includes("edad50") ? ["ma_edad"] : [])]);
  }

  // ── Infección (Finucane 2020 tablas 18-19) ─────────────────────────────────────────────────
  const riesgosInf = factores.filter((k) => RIESGOS_INFECCION.includes(k));
  const flagsInf = [
    ...(riesgosInf.some((k) => ["inmunosupresion", "corticoides", "drogas_iv"].includes(k)) ? ["in_inmuno"] : []),
    ...(riesgosInf.includes("procedimiento") ? ["in_procedimiento"] : []),
  ];
  if (fiebre) {
    if (columna && neuroColumna.length) {
      marcar("infeccion", "emergencia", ["fiebre", ...neuroColumna, ...riesgosInf], ["in_fiebre", ...flagsInf]);
    } else if (riesgosInf.length || columna) {
      marcar("infeccion", "urgente", ["fiebre", ...riesgosInf], ["in_fiebre", ...flagsInf]);
    } else {
      marcar("infeccion", "atencion", ["fiebre"], ["in_fiebre"]);
    }
  } else if (columna && riesgosInf.some((k) => k === "procedimiento" || k === "drogas_iv" || k === "inmunosupresion")) {
    marcar("infeccion", "atencion", riesgosInf, flagsInf);
  }

  const lista_ = [...sospechas.values()]
    .map((s) => ({ ...s, derivarA: s.nivel === "emergencia" ? "emergencia" : DESTINO_SOSPECHA[s.key] }))
    .sort((a, b) => rango(b.nivel) - rango(a.nivel));
  return { nivel: lista_.length ? lista_[0].nivel : null, sospechas: lista_ };
}

/** La edad en años a partir de "AAAA-MM-DD", o null. Misma cuenta que src/lib/edad.js. */
export function edadDeFecha(fecha, hoy = new Date()) {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) return null;
  const [a, m, d] = String(fecha).split("-").map(Number);
  let edad = hoy.getFullYear() - a;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) edad--;
  return edad >= 0 ? edad : null;
}
