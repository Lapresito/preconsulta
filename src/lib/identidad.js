// Normalización de los datos con los que se decide si dos registros son la MISMA persona.
//
// POR QUÉ EXISTE. Hasta ahora la unicidad del paciente colgaba de un solo hilo:
// `blindIndex(telefono)` sobre `telefono.replace(/\D/g, "")`. Eso tenía dos fallas medidas y
// reproducidas (ver docs/tecnico/TODO.md):
//
//   · Sin teléfono, `derivarDatos` devuelve "-", así que TODOS los pacientes sin teléfono
//     compartían blind index y se fusionaban en uno solo. Dos personas distintas terminaban con
//     una sola historia clínica.
//   · "099111222" y "+598 99 111 222" daban índices distintos: la misma persona, dos fichas.
//
// La regla de oro de este módulo: **normalizar es preparar la comparación, no decidirla.** Acá
// nadie fusiona nada. Estas funciones dicen "esto se parece"; quién decide si es la misma persona
// es Felipe, mirando la advertencia. Fusionar historias clínicas en silencio es muy difícil de
// deshacer —cada paciente tiene su propia DEK— y si se erra, mezcla el historial de dos personas.

// ── Teléfono ──────────────────────────────────────────────────────────────────────────────

/**
 * Prefijos telefónicos por país. Se arranca con los que tienen sentido para un consultorio en
 * Uruguay; agregar uno es agregar una línea.
 *
 * `troncal` es el 0 que se marca dentro del país y se omite con prefijo internacional: en Uruguay
 * el celular se escribe "099 111 222" pero internacionalmente es "+598 99 111 222". Sin sacarlo,
 * el mismo número da dos índices distintos — que es exactamente el bug B.
 */
export const PAISES = [
  { codigo: "UY", nombre: "Uruguay", prefijo: "598", troncal: "0" },
  { codigo: "AR", nombre: "Argentina", prefijo: "54", troncal: "0" },
  { codigo: "BR", nombre: "Brasil", prefijo: "55", troncal: "0" },
  { codigo: "CL", nombre: "Chile", prefijo: "56", troncal: "0" },
  { codigo: "PY", nombre: "Paraguay", prefijo: "595", troncal: "0" },
  { codigo: "ES", nombre: "España", prefijo: "34", troncal: "" },
  // Sin troncal: en EE.UU. el "1" es el código de país, no un prefijo que se marque de más.
  { codigo: "US", nombre: "Estados Unidos", prefijo: "1", troncal: "" },
];

export const PAIS_POR_DEFECTO = "UY";

const paisDe = (codigo) => PAISES.find((p) => p.codigo === codigo) || null;

/**
 * Lleva un teléfono a una forma canónica `<prefijo><nacional>`, sin signos ni espacios y sin el 0
 * troncal. Es lo único que debería alimentar un blind index de teléfono.
 *
 * Devuelve `null` —nunca un placeholder tipo "-"— cuando no hay un teléfono utilizable. Ese null
 * es la corrección del bug A: sin número no hay identificador, y "sin identificador" no puede
 * comportarse como un identificador compartido por todos.
 *
 * @param {string} valor        Lo que escribió la persona, en cualquier formato.
 * @param {string} codigoPais   País del formulario. Solo se usa si el número no trae prefijo.
 */
export function normalizarTelefono(valor, codigoPais = PAIS_POR_DEFECTO) {
  if (valor === null || valor === undefined) return null;

  const crudo = String(valor).trim();
  if (!crudo) return null;

  const traiaMas = crudo.startsWith("+") || crudo.startsWith("00");
  let digitos = crudo.replace(/\D/g, "");
  if (crudo.startsWith("00")) digitos = digitos.replace(/^00/, "");
  if (!digitos) return null;

  const pais = paisDe(codigoPais) || paisDe(PAIS_POR_DEFECTO);

  // Con "+" explícito el número ya es internacional: se respeta tal cual, aunque el país del
  // formulario diga otra cosa (un paciente uruguayo puede dejar un teléfono de España).
  if (traiaMas) return digitos;

  // Sin "+": puede venir igual con el prefijo del país adelante ("598099111222"). Se saca para no
  // duplicarlo, pero SOLO el prefijo del país elegido — no el de cualquier país de la lista.
  //
  // ⚠️ Probar contra todos era un bug: el prefijo de EE.UU. es "1", así que cualquier número que
  // empezara con 1 perdía su primer dígito. Un celular argentino "11 2345 6789" terminaba como
  // "54123456789" en vez de "541123456789" — misma persona, dos fichas, que es justo lo que este
  // módulo existe para evitar.
  //
  // También se exige que lo que queda siga pareciendo un número, para no mutilar uno corto que
  // casualmente arranca con los mismos dígitos.
  if (digitos.startsWith(pais.prefijo) && digitos.length - pais.prefijo.length >= 6) {
    digitos = digitos.slice(pais.prefijo.length);
  }

  if (pais.troncal && digitos.startsWith(pais.troncal) && digitos.length > 6) {
    digitos = digitos.slice(pais.troncal.length);
  }

  if (digitos.length < 6) return null; // demasiado corto para ser un teléfono real
  return `${pais.prefijo}${digitos}`;
}

// ── Nombre ────────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza para COMPARAR, no para mostrar: minúsculas, sin tildes, sin puntuación y con los
 * espacios colapsados. "Felipe  Mondada" y "felipe mondada" tienen que dar lo mismo.
 *
 * Las tildes se sacan porque nadie escribe el nombre igual dos veces: "Nuñez", "Núñez", "Nunez".
 * Se pierde precisión (Peña y Pena colapsan) y está bien: esto genera una SUGERENCIA para que
 * Felipe mire, no una fusión automática.
 */
export function normalizarNombre(valor) {
  if (!valor) return "";
  return String(valor)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Las palabras de un nombre o apellido, normalizadas y sin repetir. Es lo que se indexa. */
export function tokensNombre(valor) {
  const limpio = normalizarNombre(valor);
  if (!limpio) return [];
  return [...new Set(limpio.split(" ").filter((t) => t.length > 1))];
}

const compartenToken = (a, b) => {
  const ta = tokensNombre(a);
  const tb = tokensNombre(b);
  return ta.some((t) => tb.includes(t));
};

/**
 * ¿Estos dos nombres pueden ser de la misma persona?
 *
 * Exige coincidencia **en el nombre de pila Y en el apellido**, con al menos una palabra en cada
 * uno. Alcanza con una palabra por lado porque la gente escribe su nombre completo una vez y el
 * corto la siguiente: "Felipe Joaquín Mondada" y "Felipe Mondada" son la misma persona.
 *
 * ⚠️ Que estén SEPARADOS es lo que hace que esto sirva. Con el nombre completo en una sola bolsa,
 * "Ana Pérez" y "Ana Gómez" comparten una palabra y parecen candidatas; con la distinción, no lo
 * son — comparten el nombre de pila, que en un consultorio no distingue a nadie. Y al revés,
 * "Ana Pérez" y "Carlos Pérez" comparten apellido: casi siempre familia, no duplicado.
 *
 * Si esto disparara por nombre de pila o por apellido sueltos, todos los "Juan" y todos los
 * "Pérez" se sugerirían entre sí, y una advertencia que salta siempre es una que se ignora —
 * justo el día que aparece el duplicado de verdad.
 */
export function nombresCompatibles(a, b) {
  return compartenToken(a.nombres, b.nombres) && compartenToken(a.apellidos, b.apellidos);
}

/**
 * Funde dos versiones de un nombre (o de un apellido) quedándose con toda la información.
 *
 * Se usa cuando Felipe confirma que dos registros son la misma persona. Regla del dueño:
 * **nunca se pierde un dato ni se pisa uno por otro.** Dos casos:
 *
 *   "Ana Perez"  +  "Ana Gimena Perez"   →  "Ana Gimena Perez"
 *      El segundo contiene al primero: es la misma persona escribiendo su nombre completo.
 *
 *   "Ana Perez"  +  "Andrea Perez"       →  "Ana Perez Andrea"
 *      No se contienen. Reemplazar sería perder "Ana", descartar sería perder "Andrea". Si
 *      Felipe confirmó que son la misma persona, las dos versiones son suyas: se suman. Queda
 *      raro a la vista, y eso es bueno — es visible y se corrige a mano en la ficha, a
 *      diferencia de un dato borrado, que no deja rastro de que existió.
 *
 * Conserva las palabras ORIGINALES (con tildes y mayúsculas); normaliza solo para comparar.
 */
export function fundirNombre(actual, entrante) {
  const a = (actual || "").trim();
  const b = (entrante || "").trim();
  if (!a) return b || null;
  if (!b) return a;

  const ta = tokensNombre(a);
  const tb = tokensNombre(b);

  // El orden importa: si los dos dicen lo mismo (distinta capitalización o tildes), gana EL QUE
  // YA ESTABA. Pisarlo no agrega información y le cambia el nombre al paciente por nada.
  if (tb.every((t) => ta.includes(t))) return a; // el que estaba ya lo decía todo
  if (ta.every((t) => tb.includes(t))) return b; // el entrante agrega palabras

  const nuevas = b.split(/\s+/).filter((palabra) => {
    const [norm] = tokensNombre(palabra);
    return norm && !ta.includes(norm);
  });
  return [a, ...nuevas].join(" ");
}

// ── Fecha de nacimiento ───────────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" o vacío. Se compara exacta: una fecha de nacimiento no se escribe "parecida". */
export function normalizarFechaNac(valor) {
  if (!valor) return null;
  const m = String(valor).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// ── Documento de identidad (D148) ─────────────────────────────────────────────────────────
//
// Desde 2026-10-24 (pedido del dueño) el documento es lo que distingue a un paciente de otro: dos
// formularios con el mismo documento son la misma persona, y la base no deja que dos pacientes
// vivos lo compartan. NO reemplaza al id de la base ni se muestra en el dashboard; el detector de
// duplicados sigue estando "por las dudas" (pacientes viejos, carga manual sin documento).

export const TIPOS_DOCUMENTO = ["ci", "pasaporte", "otro"];

/**
 * Dígito verificador de la cédula uruguaya. Pesos 2-9-8-7-6-3-4 sobre los 7 dígitos de la base (con
 * ceros a la izquierda si tiene 6) y dígito = (10 − suma mód 10) mód 10. Ejemplo: 1.234.567-2.
 * El decreto 501/1978 fija el módulo 10; los pesos se verificaron contra validadores publicados.
 */
export function digitoVerificadorCI(base) {
  const d = String(base).padStart(7, "0").split("").map(Number);
  const suma = [2, 9, 8, 7, 6, 3, 4].reduce((acc, peso, i) => acc + peso * d[i], 0);
  return (10 - (suma % 10)) % 10;
}

/**
 * Lleva un documento a su forma canónica `<tipo>:<número>`, que es lo que alimenta el índice ciego.
 * CI: solo dígitos, 7 u 8 con el verificador ("1.234.567-2" → "ci:12345672"). Pasaporte y otros:
 * letras y números en mayúscula, sin espacios ni signos. Devuelve null si no hay nada utilizable.
 */
export function normalizarDocumento(tipo, valor) {
  if (!TIPOS_DOCUMENTO.includes(tipo) || valor === undefined || valor === null) return null;
  const crudo = String(valor).trim();
  if (!crudo) return null;
  const numero = tipo === "ci" ? crudo.replace(/\D/g, "") : crudo.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return numero ? `${tipo}:${numero}` : null;
}

/**
 * Por qué un documento no sirve, o null si está bien. Devuelve una CLAVE de i18n, no un texto: la usan
 * el formulario público, la carga manual y la ficha, y cada uno la traduce en su idioma.
 */
export function errorDocumento(tipo, valor) {
  if (!TIPOS_DOCUMENTO.includes(tipo)) return "err.documentoTipo";
  const canon = normalizarDocumento(tipo, valor);
  if (!canon) return "err.documentoFalta";
  const numero = canon.slice(tipo.length + 1);
  if (tipo === "ci") {
    if (numero.length < 7 || numero.length > 8) return "err.documentoCiLargo";
    if (digitoVerificadorCI(numero.slice(0, -1)) !== Number(numero.slice(-1))) return "err.documentoCiDigito";
  } else if (numero.length < 5 || numero.length > 20) {
    return "err.documentoLargo";
  }
  return null;
}

/** Para mostrar: "1.234.567-2" en una CI; tal cual en los demás. */
export function formatoDocumento(canon) {
  if (!canon) return "";
  const [tipo, numero] = [canon.slice(0, canon.indexOf(":")), canon.slice(canon.indexOf(":") + 1)];
  if (tipo !== "ci") return numero;
  const base = numero.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${base}-${numero.slice(-1)}`;
}

// ── Qué cuenta como "puede ser la misma persona" ──────────────────────────────────────────

/**
 * Compara dos identidades y devuelve qué coincide, qué difiere, y si eso alcanza para preguntarle
 * a Felipe.
 *
 * La matriz la fijó el dueño (2026-08-08):
 *
 *   teléfono                      → pregunta
 *   nombre + apellido + fecha nac → pregunta
 *   nombre + apellido             → pregunta
 *   solo apellido                 → NO (familia, no duplicado)
 *   solo nombre de pila           → NO (todos los "Juan")
 *   solo fecha de nacimiento      → NO (mucha gente nace el mismo día)
 *
 * `diferencias` es tan importante como `coincidencias`: una advertencia que dice solo "coincide el
 * nombre" obliga a ir a buscar; una que además dice "pero el teléfono y la fecha son distintos" se
 * descarta de un vistazo. Es lo que evita que el aviso se vuelva ruido.
 *
 * Ninguna combinación fusiona sola. Ni siquiera el teléfono: en un consultorio se comparte — la
 * madre que completa por el hijo, la pareja, el adulto mayor que deja el número de la hija.
 */
export function compararIdentidades(a, b) {
  // D148 — el documento manda: igual es la misma persona; distinto es una diferencia que se muestra
  // aunque coincida todo lo demás (la madre y el hijo que comparten teléfono y apellido).
  const mismoDocumento = Boolean(a.documento && b.documento && a.documento === b.documento);
  const mismoTelefono = Boolean(a.telefono && b.telefono && a.telefono === b.telefono);
  const mismoNombre = compartenToken(a.nombres, b.nombres);
  const mismoApellido = compartenToken(a.apellidos, b.apellidos);
  const mismaFechaNac = Boolean(a.fechaNac && b.fechaNac && a.fechaNac === b.fechaNac);
  const nombreCompleto = mismoNombre && mismoApellido;

  let fuerza = null;
  if (mismoDocumento) fuerza = "documento";
  else if (mismoTelefono) fuerza = "telefono";
  else if (nombreCompleto && mismaFechaNac) fuerza = "fuerte";
  else if (nombreCompleto) fuerza = "posible";

  const coincidencias = [];
  if (mismoDocumento) coincidencias.push("documento");
  if (mismoTelefono) coincidencias.push("teléfono");
  if (nombreCompleto) coincidencias.push("nombre y apellido");
  else if (mismoApellido) coincidencias.push("apellido");
  else if (mismoNombre) coincidencias.push("nombre");
  if (mismaFechaNac) coincidencias.push("fecha de nacimiento");

  // Solo se listan las diferencias de datos que EXISTEN en los dos lados: "no coincide el
  // teléfono" cuando uno de los dos no tiene teléfono no es una diferencia, es un dato faltante,
  // y presentarlo como diferencia empujaría a descartar un duplicado real.
  const diferencias = [];
  if (a.documento && b.documento && !mismoDocumento) diferencias.push("documento");
  if (a.telefono && b.telefono && !mismoTelefono) diferencias.push("teléfono");
  if (a.fechaNac && b.fechaNac && !mismaFechaNac) diferencias.push("fecha de nacimiento");
  if (!mismoApellido && a.apellidos && b.apellidos) diferencias.push("apellido");
  if (!mismoNombre && a.nombres && b.nombres) diferencias.push("nombre");

  return { fuerza, coincidencias, diferencias };
}

/** Etiqueta de la advertencia. Vive acá para que la UI no invente sus propias explicaciones. */
export const MOTIVO_COINCIDENCIA = {
  documento: "mismo documento",
  telefono: "mismo teléfono",
  fuerte: "mismo nombre y misma fecha de nacimiento",
  posible: "mismo nombre y apellido",
};

// ── WhatsApp (D153) ───────────────────────────────────────────────────────────────────────

/**
 * El link de "click to chat" de WhatsApp para un teléfono ya normalizado (`<prefijo><nacional>`,
 * ver normalizarTelefono) y un mensaje. null sin teléfono: el botón no se ofrece.
 * wa.me abre WhatsApp Web en la computadora y la app en el teléfono.
 */
export function urlWhatsapp(telefonoNormalizado, mensaje) {
  if (!telefonoNormalizado || !/^\d{8,15}$/.test(telefonoNormalizado)) return null;
  return `https://wa.me/${telefonoNormalizado}?text=${encodeURIComponent(mensaje || "")}`;
}
