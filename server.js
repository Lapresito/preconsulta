import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import { Resend } from "resend";
import PDFDocument from "pdfkit";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

dotenv.config();
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Seguridad: cabeceras HTTP ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdn.jsdelivr.net", "fonts.googleapis.com"],
      styleSrc:    ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"],
      fontSrc:     ["'self'", "fonts.gstatic.com"],
      imgSrc:      ["'self'", "data:", "*.google.com", "*.googleapis.com", "*.gstatic.com"],
      frameSrc:    ["'self'", "www.google.com"],
      connectSrc:  ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── Seguridad: límite de tamaño de body ───────────────────────────────────
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));

// ── Rate limiting general: 120 req / 15 min por IP ───────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas solicitudes. Intentá de nuevo en unos minutos." },
});
app.use(generalLimiter);

// ── Rate limiting para formularios: 6 envíos / 15 min por IP ─────────────
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiados envíos. Esperá unos minutos e intentá de nuevo." },
});

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB máx por archivo
const resend = new Resend(process.env.RESEND_API_KEY);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});

app.get("/preconsulta-directa", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use(express.static(path.join(__dirname, "public")));

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "";
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad;
}

// Escapa caracteres HTML para evitar inyección en el cuerpo del email
const esc = (str) =>
  String(str || "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

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

function generatePDF(data, attachments, nombreCompleto, edad, enfermedadesText, implantesText) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const marginL = 50;
    const contentW = pageW - marginL * 2;

    // Header
    doc.rect(0, 0, pageW, 72).fill("#388e3c");
    doc
      .fillColor("white")
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("Fisioterapia - Felipe Mondada", marginL, 18, { width: contentW, align: "center" });
    doc
      .fontSize(11)
      .font("Helvetica")
      .text("Preconsulta", marginL, 46, { width: contentW, align: "center" });

    doc.fillColor("#000").y = 90;
    doc.fontSize(9).fillColor("#666").text(
      `Fecha de envío: ${new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
      marginL,
      90,
      { width: contentW, align: "right" }
    );
    doc.moveDown(1);

    function section(title) {
      doc.moveDown(0.8);
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#388e3c").text(title, marginL, doc.y, { width: contentW });
      doc.moveTo(marginL, doc.y + 2).lineTo(pageW - marginL, doc.y + 2).strokeColor("#388e3c").stroke();
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica").fillColor("#000");
    }

    function field(label, value) {
      doc.font("Helvetica-Bold").text(`${label}: `, marginL, doc.y, { continued: true, width: contentW });
      doc.font("Helvetica").text(value || "-");
    }

    section("Datos del Paciente");
    field("Nombre completo", nombreCompleto);
    field("Fecha de nacimiento", `${data.fechaNacimiento || "-"}${edad ? ` (${edad} años)` : ""}`);
    field("Teléfono", data.telefono || "-");
    field("Ocupación", data.ocupacion || "-");
    field("Residencia", data.residencia || "-");
    field("Círculo familiar", data.familia || "-");
    field("Género", data.genero || "-");

    section("Antecedentes Médicos");
    field("Enfermedades previas", enfermedadesText);
    field("Dispositivos implantados", implantesText);
    field("Fármacos", data.farmacos || "-");

    section("Motivo de Consulta");
    field("Diagnóstico médico", data.diagnostico || "-");
    field("Motivo de consulta", data.motivo || "-");
    field("Dolor hace más de 3 meses", data.dolorCronico || "-");

    // Body chart — 2 imágenes por fila
    if (attachments.length > 0) {
      section("Body Chart");

      const imgW = 225;
      const imgH = 337; // proporción 400:600
      const gap = 15;
      let col = 0;
      let rowY = doc.y + 8;

      attachments.forEach((att) => {
        if (rowY + imgH + 20 > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          rowY = 50;
          col = 0;
        }
        const xPos = marginL + col * (imgW + gap);
        doc.fontSize(8).font("Helvetica-Bold").fillColor("#444").text(att.filename.replace(".png", ""), xPos, rowY, { width: imgW, align: "center" });
        const labelH = 12;
        doc.image(Buffer.from(att.content, "base64"), xPos, rowY + labelH, { width: imgW, height: imgH });

        if (col === 0) {
          col = 1;
        } else {
          col = 0;
          rowY += imgH + labelH + 10;
        }
      });
    }

    doc.end();
  });
}

app.post("/api/consulta", formLimiter, async (req, res) => {
  try {
    const { nombre, telefono, consulta, website } = req.body || {};

    // Honeypot: si el campo oculto viene relleno es un bot
    if (website) return res.status(200).json({ ok: true });

    if (!nombre || !consulta)
      return res.status(400).json({ message: "Completá todos los campos." });

    if (nombre.length > 100 || (telefono && telefono.length > 20) || consulta.length > 2000)
      return res.status(400).json({ message: "Datos inválidos." });
    await resend.emails.send({
      from: "Web Felipe Mondada <onboarding@resend.dev>",
      to: process.env.EMAIL_TO,
      subject: `Nueva consulta — ${nombre}`,
      html: `
        <h2>Nueva consulta desde la web</h2>
        <p><b>Nombre:</b> ${esc(nombre)}</p>
        <p><b>Teléfono:</b> ${esc(telefono) || "-"}</p>
        <p><b>Consulta:</b></p>
        <p>${esc(consulta).replace(/\n/g, "<br>")}</p>
      `,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Error enviando consulta:", err);
    res.status(500).json({ message: "Error al enviar. Intentá de nuevo." });
  }
});

app.post("/api/preconsulta", formLimiter, upload.none(), async (req, res) => {
  try {
    const data = req.body || {};

    // Honeypot
    if (data.website) return res.status(200).json({ message: "Formulario recibido." });

    // Validación de longitudes
    const campos = ["nombres","apellidos","ocupacion","residencia","familia","farmacos","diagnostico","motivo"];
    for (const campo of campos) {
      if (data[campo] && data[campo].length > 1000)
        return res.status(400).json({ message: "Datos inválidos." });
    }

    // Enfermedades
    let enfermedades = [];
    if (data.enfermedades) {
      enfermedades = Array.isArray(data.enfermedades) ? data.enfermedades : [data.enfermedades];
    }
    if (data.otraEnfermedad?.trim()) enfermedades.push(data.otraEnfermedad.trim());
    const enfermedadesText = enfermedades.length ? enfermedades.join(", ") : "-";

    // Implantes (fix: el form envía "implantes", no "implante")
    let implantes = [];
    if (data.implantes) {
      implantes = Array.isArray(data.implantes) ? data.implantes : [data.implantes];
    }
    if (data.otroImplante?.trim()) implantes.push(data.otroImplante.trim());
    const implantesText = implantes.length ? implantes.join(", ") : "-";

    const nombreCompleto = `${data.nombres || ""} ${data.apellidos || ""}`.trim() || "-";
    const telefono = data.telefono ? String(data.telefono).replace(/\D/g, "") || "-" : "-";
    const edad = calcularEdad(data.fechaNacimiento);

    // Body chart images
    const bodyChartKeys = ["maleFront", "maleBack", "maleSide", "maleSideRight", "womanFront", "womanBack", "womanSide", "womanSideRight"];
    const attachments = [];
    bodyChartKeys.forEach((key) => {
      if (data[key] && typeof data[key] === "string" && data[key].startsWith("data:")) {
        attachments.push({
          filename: `${getNiceName(key)}.png`,
          content: data[key].split(",")[1],
          encoding: "base64",
        });
      }
    });

    // Generar PDF
    const pdfBuffer = await generatePDF(data, attachments, nombreCompleto, edad, enfermedadesText, implantesText);

    // Email HTML (con campos escapados)
    const bodyChartHTML =
      attachments.length > 0
        ? `<ul>${attachments.map((a) => `<li>${esc(a.filename)}</li>`).join("")}</ul><p>Las imágenes están adjuntas al correo.</p>`
        : "<p>(No se enviaron imágenes)</p>";

    const html = `
      <h2>Nueva Preconsulta</h2>
      <p><b>Nombres y apellidos:</b> ${esc(nombreCompleto)}</p>
      <p><b>Fecha de nacimiento:</b> ${esc(data.fechaNacimiento)} ${edad ? `(${edad} años)` : ""}</p>
      <p><b>Teléfono:</b> ${esc(telefono)}</p>
      <p><b>Ocupación:</b> ${esc(data.ocupacion)}</p>
      <p><b>Residencia:</b> ${esc(data.residencia)}</p>
      <p><b>Círculo familiar:</b> ${esc(data.familia)}</p>
      <p><b>Enfermedades:</b> ${esc(enfermedadesText)}</p>
      <p><b>Implantes:</b> ${esc(implantesText)}</p>
      <p><b>Fármacos:</b> ${esc(data.farmacos)}</p>
      <p><b>Diagnóstico médico:</b> ${esc(data.diagnostico)}</p>
      <p><b>Motivo de consulta:</b> ${esc(data.motivo)}</p>
      <p><b>Dolor hace más de 3 meses:</b> ${esc(data.dolorCronico)}</p>
      <h4>Body Chart:</h4>
      ${bodyChartHTML}
    `;

    await resend.emails.send({
      from: "Preconsulta Web <onboarding@resend.dev>",
      to: process.env.EMAIL_TO,
      subject: `Nueva Preconsulta — ${nombreCompleto}`,
      html,
      attachments: [
        ...attachments.map((a) => ({ filename: a.filename, content: a.content, encoding: "base64" })),
        { filename: `Preconsulta_${nombreCompleto.replace(/ /g, "_")}.pdf`, content: pdfBuffer.toString("base64"), encoding: "base64" },
      ],
    });

    console.log("Correo enviado con Resend hacia:", process.env.EMAIL_TO);
    res.json({ message: "Los datos fueron enviados exitosamente ✅ \n Gracias por tu tiempo!" });
  } catch (error) {
    console.error("Error enviando correo:", error);
    res.status(500).json({ message: "Error al enviar el correo ❌" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
