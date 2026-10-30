// Muestra y oculta las preguntas de los bloques variables mientras el paciente contesta (D136).
//
// La regla es la misma que aplica el servidor al recibir el formulario: las dos leen
// public/condiciones.js. Una pregunta oculta queda DESHABILITADA, no solo invisible: así el
// navegador no la exige y FormData no la manda, que es exactamente lo que el servidor espera —
// valida contra lo que llegó, no contra lo que el formulario tenía dibujado.
import { cumple } from "./condiciones.js";

const form = document.getElementById("preConsultaForm");

/** El valor de un campo tal como lo mandaría el formulario. Lo deshabilitado no cuenta. */
function leer(nombre) {
  const campos = Array.from(form.elements).filter((el) => el.name === nombre && !el.disabled);
  if (!campos.length) return undefined;
  const tipo = campos[0].type;
  if (tipo === "radio") return campos.find((el) => el.checked)?.value;
  if (tipo === "checkbox") return campos.filter((el) => el.checked).map((el) => el.value);
  return campos[0].value;
}

// D140 — una opción exclusiva ("Ninguno") marcada bloquea a las demás de su grupo. Bloqueada y no
// solo desmarcada: si quedara habilitada, el paciente podría marcar "Insomnio" con "Ninguno" puesto
// y no entendería por qué el servidor se quedó con una sola de las dos.
function bloqueadoPorExclusiva(campo) {
  const grupo = campo.closest("[data-exclusiva]");
  if (!grupo || campo.value === grupo.dataset.exclusiva) return false;
  const exclusiva = Array.from(grupo.querySelectorAll("input")).find((el) => el.value === grupo.dataset.exclusiva);
  return Boolean(exclusiva && exclusiva.checked);
}

/** Al marcar la opción exclusiva, se desmarcan las demás del grupo. */
function aplicarExclusiva(campo) {
  const grupo = campo && campo.closest ? campo.closest("[data-exclusiva]") : null;
  if (!grupo || campo.value !== grupo.dataset.exclusiva || !campo.checked) return;
  for (const otro of grupo.querySelectorAll("input")) {
    if (otro !== campo) otro.checked = false;
  }
}

// El aviso al paciente de un ítem de cuestionario (la pregunta 9 del PHQ-9, D138), si alguno de
// los cuestionarios embebidos lo trae. Mismo criterio que la vista de /cuestionario/:token.
function aplicarAvisos() {
  for (const aviso of form.querySelectorAll("[data-aviso-campo]")) {
    const valor = leer(aviso.dataset.avisoCampo);
    aviso.classList.toggle("d-none", !(Number(valor) > Number(aviso.dataset.avisoMayor)));
  }
}

function aplicar() {
  // Se repite hasta que nada cambie: ocultar una pregunta puede apagar la condición de otra que
  // depende de ella. Cinco vueltas sobran — las cadenas de hoy tienen un solo nivel.
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    let cambio = false;

    for (const el of form.querySelectorAll("[data-mostrar-si]")) {
      const condicion = JSON.parse(el.dataset.mostrarSi || "null");
      const padreOculto = el.parentElement ? el.parentElement.closest("[data-mostrar-si].d-none") : null;
      const visible = !padreOculto && cumple(condicion, leer);
      if (el.classList.contains("d-none") === visible) {
        el.classList.toggle("d-none", !visible);
        cambio = true;
      }
    }

    for (const campo of form.querySelectorAll("input,select,textarea")) {
      if (!campo.closest("[data-mostrar-si]")) continue; // el núcleo del formulario no se toca
      const oculto = Boolean(campo.closest("[data-mostrar-si].d-none"));
      const apagado = oculto || bloqueadoPorExclusiva(campo);
      if (campo.disabled !== apagado) {
        campo.disabled = apagado;
        cambio = true;
      }
    }

    if (!cambio) break;
  }
}

if (form && form.querySelector("[data-bloque],[data-cuestionario]")) {
  form.addEventListener("change", (e) => {
    aplicarExclusiva(e.target);
    aplicar();
    aplicarAvisos();
  });
  // `reset` limpia los valores antes de terminar de despachar el evento: hay que esperar un tick.
  form.addEventListener("reset", () => setTimeout(() => { aplicar(); aplicarAvisos(); }, 0));
  aplicar();
  aplicarAvisos();
}
