// Preconsulta GENERAL, versión independiente: el mismo formulario que la de PMS (pretriage,
// painDETECT, PSFS, hábitos, body chart, adjuntos), sin links, sin buzón y sin base.
//
// Copiada de src/routes/preconsulta.js de PMS y recortada a un solo camino: validar → PDF →
// mail a Felipe. Lo que se fue: el link (acá el formulario es abierto, como siempre fue en este
// sitio), el sellado en el buzón, la persistencia, los tipos de formulario de episodio y los
// cuestionarios sueltos. Las VALIDACIONES son las mismas, a propósito: el PDF que llega tiene
// que poder leerse igual que una preconsulta importada en PMS.
import express from "express";
import path from "path";
import { formLimiter } from "../middleware/rateLimit.js";
import { handleAdjuntos, validateAdjuntos } from "../middleware/uploads.js";
import { generatePDF } from "../services/pdf.js";
import { sendConsultaEmail, sendPreconsultaEmail } from "../services/email.js";
import { calcularEdad } from "../utils/edad.js";
import { DEPARTAMENTOS, MOTIVO_CATEGORIAS, actividadInvalida, ZONAS_CONSULTA, TIPOS_CANCER, zonasOCancerInvalidos, zonasDeFormulario, cancerDeFormulario, LABEL_TIPO_CANCER } from "../config/catalogos.js";
import { validarFechaNacimiento } from "../lib/edad.js";
import { errorDocumento } from "../lib/identidad.js";
import { traductor, idiomaInstalacion } from "../i18n/index.js";
import { FORM_TYPES, CUSTOMIZABLE_FIELDS } from "../config/formTypes.js";
import { bloquesDeTipo, extraerBloques, vistaBloques, cuestionariosDeTipo, definicionesCuestionariosDeTipo, vistaTomas } from "../config/bloques.js";
import { contextoDeFormulario } from "../config/bloquesPretriaje.js";
import { extraerCuestionarios } from "../config/cuestionarios.js";
import { TEXTO_CONSENTIMIENTO } from "../config/consentimiento.js";
import { mensajeSeguro } from "../lib/logScrub.js";

const tp = (clave) => traductor(idiomaInstalacion())(clave);

// Un solo formulario: la preconsulta general de PMS.
const FORM_TYPE = "generico";

// Los campos del núcleo que muestra: todos menos el círculo familiar, que repetía lo que ya
// pregunta el estado civil (pedido del dueño, 2026-10-30). La vista, la validación, el PDF y el
// mail leen esta misma lista.
const CAMPOS = CUSTOMIZABLE_FIELDS.map((c) => c.key).filter((k) => k !== "familia");

const router = express.Router();

function renderPreconsulta(req, res) {
  res.render("preconsulta", {
    fields: CAMPOS,
    bloques: bloquesDeTipo(FORM_TYPE),
    cuestionarios: definicionesCuestionariosDeTipo(FORM_TYPE),
    motivoPreseleccionado: FORM_TYPES[FORM_TYPE]?.motivoCategoria || null,
    linkId: "",
    departamentos: DEPARTAMENTOS,
    zonasConsulta: ZONAS_CONSULTA,
    tiposCancer: TIPOS_CANCER,
    motivoCategorias: MOTIVO_CATEGORIAS,
    textoConsentimiento: TEXTO_CONSENTIMIENTO,
    encabezado: null,
  });
}

// `/preconsulta-directa` es el link que Felipe ya les viene mandando a sus pacientes: no se toca.
router.get("/preconsulta-directa", renderPreconsulta);
router.get("/preconsulta", renderPreconsulta);

// El formulario de contacto de la landing.
router.post("/api/consulta", formLimiter, async (req, res) => {
  try {
    const { nombre, telefono, consulta, website } = req.body || {};
    if (website) return res.status(200).json({ ok: true });
    if (!nombre || !consulta) return res.status(400).json({ message: "Completá todos los campos." });
    if (nombre.length > 100 || (telefono && telefono.length > 20) || consulta.length > 2000)
      return res.status(400).json({ message: "Datos inválidos." });
    await sendConsultaEmail({ nombre, telefono, consulta });
    res.json({ ok: true });
  } catch (err) {
    console.error("Error enviando consulta:", mensajeSeguro(err));
    res.status(500).json({ message: "Error al enviar. Intentá de nuevo." });
  }
});

router.post("/api/preconsulta", formLimiter, handleAdjuntos, validateAdjuntos, async (req, res) => {
  const data = req.body || {};

  // Honeypot
  if (data.website) return res.status(200).json({ message: "Formulario recibido." });

  const fields = CAMPOS;

  const campos = ["nombres","apellidos","ocupacion","residencia","familia","farmacos","diagnostico","motivo","cirugiasPrevias","lesionesPrevias"];
  for (const campo of campos) {
    if (data[campo] && data[campo].length > 1000)
      return res.status(400).json({ message: "Datos inválidos." });
  }

  if (!data.consentimiento) {
    return res.status(400).json({ message: "Es necesario aceptar el consentimiento para continuar." });
  }
  if (!fields || fields.includes("nombres")) {
    const errorDoc = errorDocumento(data.documentoTipo, data.documento);
    if (errorDoc) return res.status(400).json({ message: tp(errorDoc) });
  }
  if (!fields || fields.includes("fechaNacimiento")) {
    const errorEdad = validarFechaNacimiento(data.fechaNacimiento);
    if (errorEdad) return res.status(400).json({ message: errorEdad });
  }
  if (data.departamento && !DEPARTAMENTOS.includes(data.departamento)) {
    return res.status(400).json({ message: "Seleccioná un departamento válido." });
  }
  if (actividadInvalida(data)) {
    return res.status(400).json({ message: "Datos de actividad física inválidos." });
  }
  if (zonasOCancerInvalidos(data)) {
    return res.status(400).json({ message: "Datos de la zona del dolor inválidos." });
  }
  // Sin zona, el pretriage no sabe qué preguntas correspondían y no puede leer nada.
  const traeZonas = (!fields || fields.includes("motivo")) && !FORM_TYPES[FORM_TYPE]?.motivoCategoria;
  if (traeZonas && !zonasDeFormulario(data).length) {
    return res.status(400).json({ message: "Marcá dónde te duele." });
  }
  const traeDolorCronico = !fields || fields.includes("dolorCronico");
  if (traeDolorCronico && !["Sí", "No"].includes(data.dolorCronico)) {
    return res.status(400).json({ message: "Indicá si tenés dolor hace tres meses o más." });
  }

  const bloquesEnvio = extraerBloques({ data, formType: FORM_TYPE, estricto: true });
  if (bloquesEnvio.error) return res.status(400).json({ message: bloquesEnvio.error });
  const cuestionariosEnvio = extraerCuestionarios({ data, keys: cuestionariosDeTipo(FORM_TYPE), estricto: true });
  if (cuestionariosEnvio.error) return res.status(400).json({ message: cuestionariosEnvio.error });

  let enfermedades = [];
  if (data.enfermedades) {
    enfermedades = Array.isArray(data.enfermedades) ? data.enfermedades : [data.enfermedades];
  }
  if (data.otraEnfermedad?.trim()) enfermedades.push(data.otraEnfermedad.trim());
  for (const k of cancerDeFormulario(data)) {
    enfermedades.push(`${LABEL_TIPO_CANCER[k]}${k === "otro" && data.otroCancer?.trim() ? `: ${data.otroCancer.trim().slice(0, 100)}` : ""}`);
  }
  const enfermedadesText = enfermedades.length ? enfermedades.join(", ") : "-";

  let implantes = [];
  if (data.implantes) {
    implantes = Array.isArray(data.implantes) ? data.implantes : [data.implantes];
  }
  if (data.otroImplante?.trim()) implantes.push(data.otroImplante.trim());
  const implantesText = implantes.length ? implantes.join(", ") : "-";

  const nombreCompleto = `${data.nombres || ""} ${data.apellidos || ""}`.trim() || "-";
  const telefono = data.telefono ? String(data.telefono).replace(/\D/g, "") || "-" : "-";
  const edad = calcularEdad(data.fechaNacimiento);

  const bodyChartKeys = ["maleFront", "maleBack", "maleSide", "maleSideRight", "womanFront", "womanBack", "womanSide", "womanSideRight"];
  const attachments = [];
  bodyChartKeys.forEach((key) => {
    if (data[key] && typeof data[key] === "string" && data[key].startsWith("data:")) {
      attachments.push({
        key,
        filename: `${getNiceName(key)}.png`,
        content: data[key].split(",")[1],
        encoding: "base64",
      });
    }
  });

  // Adjuntos del paciente (ya validados por magic-bytes en el middleware). Solo viven en memoria.
  const patientFiles = (req.files || []).map((f) => ({
    filename: path.basename(f.originalname).slice(0, 150),
    content: f.buffer.toString("base64"),
    encoding: "base64",
    mime: f.mimetype,
  }));

  try {
    const escalaAhora = data.escalaDolor !== undefined && data.escalaDolor !== "" ? Number(data.escalaDolor) : bloquesEnvio.alimenta.escalaDolor;
    const bloquesVista = [
      ...vistaBloques(bloquesEnvio.cerrados, bloquesEnvio.textos,
        contextoDeFormulario(data, edad, { escalaDolor: Number.isInteger(escalaAhora) ? escalaAhora : null })),
      ...vistaTomas(cuestionariosEnvio.tomas, FORM_TYPE),
    ];
    const pdfBuffer = await generatePDF(data, attachments, nombreCompleto, edad, enfermedadesText, implantesText, fields, false, bloquesVista);

    await sendPreconsultaEmail({
      data,
      attachments,
      patientFiles,
      nombreCompleto,
      edad,
      telefono,
      enfermedadesText,
      implantesText,
      pdfBuffer,
      fields,
      bloques: bloquesVista,
    });

    console.log("Preconsulta procesada y correo despachado.");
    res.json({ message: "Los datos fueron enviados exitosamente ✅ \n Gracias por tu tiempo!" });
  } catch (error) {
    // Acá no hay base: si el mail no sale, la preconsulta se pierde. El mensaje lo dice tal cual.
    console.error("Error enviando correo:", mensajeSeguro(error));
    res.status(500).json({ message: "No pudimos enviar tu preconsulta ❌. Intentá de nuevo o contactanos." });
  }
});

function getNiceName(key) {
  return key
    .replace("maleFront", "Hombre - Frente")
    .replace("maleBack", "Hombre - Espalda")
    .replace("maleSideRight", "Hombre - Lado derecho")
    .replace("maleSide", "Hombre - Lado izquierdo")
    .replace("womanFront", "Mujer - Frente")
    .replace("womanBack", "Mujer - Espalda")
    .replace("womanSideRight", "Mujer - Lado derecho")
    .replace("womanSide", "Mujer - Lado izquierdo");
}

export default router;
