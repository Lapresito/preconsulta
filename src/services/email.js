import { Resend } from "resend";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { RESEND_API_KEY, MAIL_DESTINO, MAIL_REMITENTE, MAIL_MODO, CORREOS_DIR } from "../config/index.js";
import { esc } from "../utils/esc.js";

// D127 — el idioma de la INSTALACIÓN. Este módulo no corre dentro de una request con `res` a
// mano, así que no puede usar `res.locals.t`: pregunta por el idioma configurado, que es el
// mismo que ve Felipe en el panel y el paciente en el formulario.
import { traductor, idiomaInstalacion, idiomaInfo } from "../i18n/index.js";
import { textoActividad, textoZonas } from "../config/catalogos.js";

const te = (clave, vars) => traductor(idiomaInstalacion())(clave, vars);

// ⚠️ El cliente se crea CUANDO SE MANDA, no al importar el módulo.
//
// `new Resend("")` lanza "Missing API key" apenas se evalúa el archivo, y este módulo lo importan
// los dos servidores: sin key, ninguno de los dos arranca. En el instalador que se les manda a los
// fisioterapeutas la key va vacía A PROPÓSITO (no se reparte la cuenta de Resend), así que
// construirlo arriba hacía que el programa no levantara en la primera instalación. Pasó tal cual
// al probar el staging.
//
// Con MAIL_MODO=consola nunca se llega a esta función, así que la key ni se mira.
let resend = null;
function cliente() {
  if (!resend) {
    // i18n-exento: error de CONFIGURACIÓN. Lo ve quien instala, en la terminal — con
    // MAIL_MODO=consola ni siquiera se llega hasta acá.
    if (!RESEND_API_KEY) throw new Error("Falta RESEND_API_KEY: no se puede mandar correo real.");
    resend = new Resend(RESEND_API_KEY);
  }
  return resend;
}

// Con el correo simulado, deja en disco los PDF que habrían ido adjuntos. Sin esto, quien prueba
// el flujo de preconsulta en el instalador no ve nada al final y lo reporta como que "no llega
// nada": el correo real necesita una RESEND_API_KEY que no se reparte con el programa.
//
// Solo los PDF, a propósito. Las imágenes del body chart y los archivos que sube el paciente ya
// se pueden ver en el panel; el PDF es lo único que hoy no tiene otra forma de mirarse.
//
// Best-effort: que no se pueda escribir un archivo no puede hacer fallar el envío. Y nada de
// nombres de archivo en el log — llevan el nombre del paciente (D31).
function guardarPdfsSimulados(attachments) {
  const pdfs = (attachments ?? []).filter((a) => a.filename?.toLowerCase().endsWith(".pdf"));
  if (pdfs.length === 0) return 0;

  try {
    const destino = path.resolve(CORREOS_DIR);
    mkdirSync(destino, { recursive: true });
    // Prefijo con fecha para que queden ordenados y no se pisen entre pruebas del mismo paciente.
    const sello = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    for (const pdf of pdfs) {
      const nombre = `${sello}_${path.basename(pdf.filename)}`;
      writeFileSync(path.join(destino, nombre), Buffer.from(pdf.content, pdf.encoding ?? "base64"));
    }
    return pdfs.length;
  } catch {
    return 0;
  }
}

// ÚNICO punto de salida de correo del sistema (L0). Cambiar de proveedor es reescribir esta
// función y nada más — no hace falta abstraerlo más que esto.
//
// MAIL_MODO=consola imprime en el log en vez de mandar: es el default en desarrollo, para no
// gastar cuota de Resend ni llenar la casilla en cada prueba. Mismo criterio que el seed
// sintético, que nunca manda mails a propósito. Ver docs/tecnico/IMPLEMENTADO.md (etapa Local-Online).
async function enviar({ tipo, from, to, subject, html, attachments }) {
  if (MAIL_MODO !== "real") {
    // ⚠️ Nada de `subject` ni `to` acá: el asunto lleva el NOMBRE DEL PACIENTE
    // ("Nueva Preconsulta — Juan Pérez") y `to` es una casilla de correo. Este log está hecho
    // para salir de la máquina y que Felipe se lo mande a Joaco (D31), así que solo va el tipo
    // de mail y cuántos adjuntos tenía — alcanza para diagnosticar, no identifica a nadie.
    const guardados = guardarPdfsSimulados(attachments);
    console.log(`[mail:${MAIL_MODO}] no enviado — tipo=${tipo} adjuntos=${attachments?.length ?? 0} pdf_guardados=${guardados}`);
    return;
  }
  // El SDK de Resend no lanza excepción en errores de la API (ej. restricción de sandbox):
  // los devuelve en `error`. Si no se chequea, el server responde "enviado" aunque no llegue nada.
  const { error } = await cliente().emails.send({ from, to, subject, html, attachments });
  if (error) throw new Error(`Resend: ${error.message}`);
}

export async function sendConsultaEmail({ nombre, telefono, consulta }) {
  await enviar({
    tipo: "consulta",
    from: `PMS <${MAIL_REMITENTE}>`,
    to: MAIL_DESTINO,
    subject: `Nueva consulta — ${nombre}`,
    html: `
      <h2>Nueva consulta desde la web</h2>
      <p><b>Nombre:</b> ${esc(nombre)}</p>
      <p><b>Teléfono:</b> ${esc(telefono) || "-"}</p>
      <p><b>Consulta:</b></p>
      <p>${esc(consulta).replace(/\n/g, "<br>")}</p>
    `,
  });
}

// Claves, no textos: el asunto se resuelve al mandar el mail, en el idioma configurado.
const ASUNTO_TURNO = {
  reservado: "mail.turnoReservado",
  cancelado: "mail.turnoCancelado",
  reprogramado: "mail.turnoReprogramado",
};

const MENSAJE_PACIENTE_TURNO = {
  reservado: "mail.quedoReservado",
  cancelado: "mail.quedoCancelado",
  reprogramado: "mail.quedoReprogramado",
};

const asuntoTurno = (tipo) => te(ASUNTO_TURNO[tipo] || "mail.turnoActualizado");
const mensajeTurno = (tipo) => te(MENSAJE_PACIENTE_TURNO[tipo] || "mail.seActualizo");

function formatoFechaHora(inicio) {
  if (!inicio) return null;
  const d = new Date(inicio);
  const loc = idiomaInfo(idiomaInstalacion()).locale;
  return te("mail.aLas", {
    fecha: d.toLocaleDateString(loc, { weekday: "long", day: "2-digit", month: "2-digit" }),
    hora: d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" }),
  });
}

/**
 * Agenda (fase 1b): aviso de correo cuando algo cambia en un turno público —reservar, cancelar,
 * reprogramar—. Lo llama SOLO `src/routes/reserva.js` (proceso público), en el mismo request que
 * sella el sobre: es el único momento en que este proceso ve el nombre/mail del paciente en texto
 * plano (D20), así que es también el único momento en que le puede escribir directo.
 *
 * Dos destinatarios independientes:
 *   · Felipe/Joaco (`MAIL_DESTINO`), siempre — mismo criterio que el resto de los avisos del
 *     sistema.
 *   · El paciente, SOLO si `contactoEmail` viene con algo — hoy eso únicamente pasa en un turno
 *     S2 (sin ficha) que dejó su mail al reservar. Un turno S1 (con ficha) no tiene forma de que
 *     el público conozca su mail —vive cifrado en la base local—, así que no hay a quién
 *     escribirle desde acá; queda anotado en TODO.md como asimetría conocida, no como bug.
 */
export async function sendTurnoEmail({
  tipo, tituloPublico, comentarioPublico, inicio, duracionMinutos, contactoNombre, contactoEmail,
  clinica = null,
}) {
  const cuando = formatoFechaHora(inicio);
  const nombreTurno = tituloPublico || te("mail.turnoSinFicha");
  // D132: la sede, si el turno la tiene. Nombre y dirección juntos cuando hay dirección; solo el
  // nombre si todavía no se cargó. Se arma una vez y se usa en los DOS correos (el interno y el
  // del paciente), que necesitan exactamente el mismo dato.
  const donde = clinica
    ? esc(clinica.direccion ? `${clinica.nombre} — ${clinica.direccion}` : clinica.nombre)
    : null;

  await enviar({
    tipo: `turno_${tipo}`,
    from: `PMS <${MAIL_REMITENTE}>`,
    to: MAIL_DESTINO,
    subject: `${asuntoTurno(tipo)} — ${esc(nombreTurno)}`,
    html: `
      <h2>${esc(asuntoTurno(tipo))}</h2>
      <p><b>${te("mail.titulo")}</b> ${esc(nombreTurno)}</p>
      ${cuando ? `<p><b>${te("mail.cuando")}</b> ${esc(cuando)} (${duracionMinutos} min)</p>` : ""}
      ${donde ? `<p><b>${te("mail.donde")}</b> ${donde}</p>` : ""}
      ${comentarioPublico ? `<p><b>${te("mail.comentario")}</b> ${esc(comentarioPublico)}</p>` : ""}
      ${contactoNombre ? `<p><b>${te("mail.loCoordino")}</b> ${esc(contactoNombre)}${contactoEmail ? ` (${esc(contactoEmail)})` : ""}</p>` : ""}
    `,
  });

  if (!contactoEmail) return;

  // ⚠️ Este es el ÚNICO mail de este archivo que le llega a un paciente, y por eso es el único
  // que NO se firma "PMS": el paciente sacó turno con un fisioterapeuta, no con un programa.
  // Los otros dos van a `MAIL_DESTINO` (Felipe/Joaco) y ahí la firma del sistema sí sirve, que
  // es lo que dice de dónde salió el aviso. Mismo criterio que `pre.marca` y `pdf.marca`.
  await enviar({
    tipo: `turno_${tipo}_paciente`,
    from: `${te("lp.marca")} <${MAIL_REMITENTE}>`,
    to: contactoEmail,
    subject: te("mail.tuTurno", { estado: mensajeTurno(tipo) }),
    html: `
      <p>${te("mail.hola")}${contactoNombre ? ` ${esc(contactoNombre)}` : ""},</p>
      <p>${te("mail.tuTurnoCuerpo", { estado: mensajeTurno(tipo) })}${cuando ? te("mail.paraEl", { cuando: esc(cuando) }) : ""}.</p>
      ${donde && tipo !== "cancelado" ? `<p><b>${te("mail.donde")}</b> ${donde}</p>` : ""}
    `,
  });
}

function prefijoPretriaje(bloques = []) {
  const nivel = bloques.find((b) => b.pretriaje)?.pretriaje?.nivel;
  return nivel === "emergencia" || nivel === "urgente" ? `⚠️ ${te(`bq.pretriaje.nivel.${nivel}`).toUpperCase()} — ` : "";
}

export async function sendPreconsultaEmail({
  data,
  attachments,
  patientFiles = [],
  nombreCompleto,
  edad,
  telefono,
  enfermedadesText,
  implantesText,
  pdfBuffer,
  fields = null,
  bloques = [],
}) {
  const show = (key) => !fields || fields.includes(key);

  const bodyChartHTML =
    attachments.length > 0
      ? `<ul>${attachments.map((a) => `<li>${esc(a.filename)}</li>`).join("")}</ul><p>Las imágenes están adjuntas al correo.</p>`
      : "<p>(No se enviaron imágenes)</p>";

  const adjuntosHTML =
    patientFiles.length > 0
      ? `<h4>Documentación adjunta por el paciente:</h4><ul>${patientFiles.map((f) => `<li>${esc(f.filename)}</li>`).join("")}</ul>`
      : "";

  const html = `
    <h2>Nueva Preconsulta</h2>
    <p><b>Nombres y apellidos:</b> ${esc(nombreCompleto)}</p>
    ${show("fechaNacimiento") ? `<p><b>Fecha de nacimiento:</b> ${esc(data.fechaNacimiento)} ${edad ? `(${edad} años)` : ""}</p>` : ""}
    ${show("telefono") ? `<p><b>Teléfono:</b> ${esc(telefono)}</p>` : ""}
    ${show("ocupacion") ? `<p><b>Ocupación:</b> ${esc(data.ocupacion)}</p>` : ""}
    ${show("residencia") ? `<p><b>Residencia:</b> ${esc(data.residencia)}</p>` : ""}
    ${show("familia") ? `<p><b>Círculo familiar:</b> ${esc(data.familia)}</p>` : ""}
    ${show("enfermedades") ? `<p><b>Enfermedades:</b> ${esc(enfermedadesText)}</p>` : ""}
    ${show("implantes") ? `<p><b>Implantes:</b> ${esc(implantesText)}</p>` : ""}
    ${show("farmacos") ? `<p><b>Fármacos:</b> ${esc(data.farmacos)}</p>` : ""}
    ${show("cirugias") ? `<p><b>${esc(te("form.campo.cirugias"))}:</b> ${esc(data.cirugiasPrevias)}</p>` : ""}
    ${show("lesiones") ? `<p><b>${esc(te("form.campo.lesiones"))}:</b> ${esc(data.lesionesPrevias)}</p>` : ""}
    <p><b>${esc(te("pdf.actividad"))}:</b> ${esc(textoActividad(data))}</p>
    ${show("diagnostico") ? `<p><b>Diagnóstico médico:</b> ${esc(data.diagnostico)}</p>` : ""}
    ${show("motivo") ? `<p><b>Motivo de consulta:</b> ${esc(data.motivo)}</p>` : ""}
    ${show("motivo") && data.zonasConsulta ? `<p><b>${esc(te("pre.zonas"))}:</b> ${esc(textoZonas(data))}</p>` : ""}
    ${show("dolorCronico") ? `<p><b>Dolor hace más de 3 meses:</b> ${esc(data.dolorCronico)}</p>` : ""}
    ${show("bodyChart") ? `<h4>Body Chart:</h4>${bodyChartHTML}` : ""}
    ${show("adjuntos") ? adjuntosHTML : ""}
    ${bloques.map((b) => `<h4>${esc(b.titulo)}</h4>${b.puntaje ? `<p><b>${esc(te("pdf.puntaje"))}:</b> ${esc(`${b.puntaje.total} (${b.puntaje.min}–${b.puntaje.max}) · ${b.puntaje.label}`)}</p>` : ""}${b.senales.map((s) => `<p>⚠ ${esc(s.texto)}</p>`).join("")}<ul>${b.filas.map((f) => `<li><b>${esc(f.texto)}:</b> ${esc(f.valor)}</li>`).join("")}</ul>`).join("")}
  `;

  await enviar({
    tipo: "preconsulta",
    from: `Preconsulta Web <${MAIL_REMITENTE}>`,
    to: MAIL_DESTINO,
    // D141 — si el pretriage dio emergencia o urgencia, el asunto lo dice: es lo único del mail que
    // se lee sin abrirlo.
    subject: `${prefijoPretriaje(bloques)}Nueva Preconsulta — ${nombreCompleto}`,
    html,
    attachments: [
      ...attachments.map((a) => ({ filename: a.filename, content: a.content, encoding: "base64" })),
      ...patientFiles.map((f) => ({ filename: f.filename, content: f.content, encoding: "base64" })),
      { filename: `Preconsulta_${nombreCompleto.replace(/ /g, "_")}.pdf`, content: pdfBuffer.toString("base64"), encoding: "base64" },
    ],
  });
}
