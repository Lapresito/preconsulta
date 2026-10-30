// El pretriage y los deslizadores de los bloques, del lado del formulario del paciente (D141).
//
// Es un MÓDULO aparte de public/index.js porque necesita importar la regla del pretriage
// (public/pretriaje.js), la misma que usa el servidor, y index.js es un script clásico. Le deja
// a index.js dos funciones en `window`: la que revisa lo que falta antes de enviar y la que
// calcula el nivel del pretriage para el aviso al paciente.
import { evaluarPretriaje, edadDeFecha } from "./pretriaje.js";
import { nombreCampo } from "./condiciones.js";

const form = document.getElementById("preConsultaForm");

/** Todos los valores con ese name que se mandarían (lo deshabilitado no cuenta). */
function valores(nombre) {
  return Array.from(form.elements)
    .filter((el) => el.name === nombre && !el.disabled)
    .filter((el) => (el.type === "checkbox" || el.type === "radio" ? el.checked : el.value !== ""))
    .map((el) => el.value);
}

// ── Deslizadores ─────────────────────────────────────────────────────────────────────────────
// El range no tiene name: lo que viaja es el hidden de al lado, que recién se llena cuando el
// paciente lo mueve —o ya viene lleno, si la pregunta tiene `porDefecto` (D154)—. Ver la partial
// bloques-formulario.ejs.
for (const caja of form?.querySelectorAll("[data-deslizador]") || []) {
  const oculto = caja.querySelector('input[type="hidden"]');
  const rango = caja.querySelector('input[type="range"]');
  const etiqueta = caja.querySelector("[data-deslizador-valor]");
  const marcas = Array.from(caja.querySelectorAll(".bq-deslizador-marcas span")).map((s) => s.textContent);
  const lista = JSON.parse(rango.dataset.valores || "[]");
  const sinResponder = etiqueta.dataset.sinResponder || etiqueta.textContent;
  const pintar = () => {
    if (oculto.value === "") {
      rango.classList.add("bq-sin-tocar");
      etiqueta.textContent = sinResponder;
      return;
    }
    rango.classList.remove("bq-sin-tocar");
    rango.value = String(Math.max(0, lista.indexOf(oculto.value)));
    etiqueta.textContent = marcas[Number(rango.value)] || "";
  };
  // `input` mientras arrastra, `change` por teclado; los dos fijan la respuesta.
  const fijar = () => {
    oculto.value = lista[Number(rango.value)] ?? "";
    caja.classList.remove("bq-falta");
    pintar();
    form.dispatchEvent(new Event("change"));
  };
  rango.addEventListener("input", fijar);
  rango.addEventListener("change", fijar);
  // Un clic sobre el pulgar SIN moverlo (quería "nunca", que es donde ya está) no dispara `input`.
  rango.addEventListener("pointerup", () => { if (oculto.value === "") fijar(); });
  form.addEventListener("reset", () => setTimeout(() => { oculto.value = oculto.dataset.porDefecto || ""; pintar(); }, 0));
  pintar();
}

/**
 * Lo que falta antes de enviar y que el navegador no sabe exigir solo: un grupo de casillas
 * obligatorio (las zonas) y un deslizador obligatorio (un hidden). Devuelve el primer elemento
 * que falta, para llevarle la vista, o null.
 */
window.pretriajeFaltante = function pretriajeFaltante() {
  const zonas = form.querySelector("#zonasConsulta[data-requerido]");
  if (zonas && !valores("zonasConsulta").length) return { el: zonas, texto: document.getElementById("zonasRotulo")?.firstChild?.textContent?.trim() };
  for (const oculto of form.querySelectorAll('[data-deslizador] input[type="hidden"][data-requerido]')) {
    if (oculto.disabled || oculto.value !== "") continue;
    const caja = oculto.closest("[data-deslizador]");
    caja.classList.add("bq-falta");
    return { el: caja, texto: oculto.dataset.pregunta };
  }
  return null;
};

/** El nivel del pretriage de lo que se está por mandar: "emergencia" | "urgente" | "atencion" | null. */
window.pretriajeNivel = function pretriajeNivel() {
  if (!form.querySelector('[data-bloque="pretriaje"]')) return null;
  const r = {};
  const prefijo = nombreCampo("pretriaje", "");
  for (const el of form.elements) {
    if (!el.name || !el.name.startsWith(prefijo) || el.disabled) continue;
    const key = el.name.slice(prefijo.length);
    if (r[key] !== undefined) continue;
    const v = valores(el.name);
    r[key] = el.type === "checkbox" ? v : v[0];
  }
  return evaluarPretriaje({
    r,
    zonas: valores("zonasConsulta"),
    edad: edadDeFecha(form.elements.namedItem("fechaNacimiento")?.value),
    genero: valores("genero")[0] || null,
    // El formato de cable de enfermedades es el rótulo en español (ver catalogos.js): para la
    // regla solo importa si está el cáncer.
    enfermedades: valores("enfermedades").includes("Cáncer") ? ["cancer"] : [],
    cancerTipos: valores("cancerTipos"),
  }).nivel;
};
