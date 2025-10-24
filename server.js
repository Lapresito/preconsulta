import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
// Anterior
// import nodemailer from "nodemailer";
// ✅ Nueva importación: Resend
import { Resend } from "resend";

dotenv.config();
const app = express();
const upload = multer();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Inicializamos Resend con la API key del .env
const resend = new Resend(process.env.RESEND_API_KEY);

// 🔹 Servir index.html reemplazando la API key
app.get("/", (req, res) => {
  const indexPath = path.join(__dirname, "public", "index.html");
  let html = fs.readFileSync(indexPath, "utf8");
  html = html.replace("${GOOGLE_API_KEY}", process.env.GOOGLE_API_KEY || "");
  res.send(html);
});

// 🔹 Servir archivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// 🔹 Calcular edad
function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "";
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad;
}

// 🔹 Endpoint principal del formulario
app.post("/api/preconsulta", upload.none(), async (req, res) => {
  try {
    const data = req.body || {};

    // 🔸 Manejo de enfermedades múltiples
    let enfermedades = [];
    if (data.enfermedades) {
      if (Array.isArray(data.enfermedades)) enfermedades = data.enfermedades;
      else enfermedades = [data.enfermedades];
    }
    if (data.otraEnfermedad && data.otraEnfermedad.trim()) {
      enfermedades.push(data.otraEnfermedad.trim());
    }
    const enfermedadesText = enfermedades.length ? enfermedades.join(", ") : "-";

    // 🔸 Manejo de implantes múltiples
    let implantes = [];
    if (data.implante) {
      if (Array.isArray(data.implante)) implantes = data.implante;
      else implantes = [data.implante];
    }
    if (data.otroImplante && data.otroImplante.trim()) {
      implantes.push(data.otroImplante.trim());
    }
    const implantesText = implantes.length ? implantes.join(", ") : "-";

    // 🔸 Nombre completo
    const nombreCompleto = `${data.nombres || data.nombre || ""} ${data.apellidos || ""}`.trim() || "-";

    // 🔸 Sanitizar teléfono
    const telefono = data.telefono ? (String(data.telefono).replace(/\D/g, "") || "-") : "-";

    const edad = calcularEdad(data.fechaNacimiento);

    // 🧩 ---------------------------
    // 🔸 Eliminamos Nodemailer (comentado)
    /*
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    */
    // 🧩 ---------------------------
// 🔹 Adjuntar múltiples imágenes del body chart (solo las que existan)
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

const attachments = [];
const bodyCharts = [
  "maleFront", "maleBack", "maleSide", "maleSideRight",
  "womanFront", "womanBack", "womanSide", "womanSideRight",
];

bodyCharts.forEach((key) => {
  if (data[key] && typeof data[key] === "string" && data[key].startsWith("data:")) {
    const base64 = data[key].split(",")[1];
    attachments.push({
      filename: `${getNiceName(key)}.png`,
      content: base64,
      encoding: "base64",
    });
  }
});

// 🔸 Email HTML
let bodyChartHTML = "<p>(No se enviaron imágenes)</p>";
if (attachments.length > 0) {
  bodyChartHTML = `
    <ul>
      ${attachments.map(a => `<li>${a.filename}</li>`).join("")}
    </ul>
    <p>Las imágenes están adjuntas al correo.</p>
  `;
}

// 🔸 Email completo
const html = `
  <h2>🧍 Nueva Preconsulta</h2>
  <p><b>Nombres y apellidos:</b> ${nombreCompleto}</p>
  <p><b>Fecha de nacimiento:</b> ${data.fechaNacimiento || "-"} ${edad ? `(${edad} años)` : ""}</p>
  <p><b>Teléfono:</b> ${telefono}</p>
  <p><b>Ocupación:</b> ${data.ocupacion || "-"}</p>
  <p><b>Residencia:</b> ${data.residencia || "-"}</p>
  <p><b>Círculo familiar:</b> ${data.familia || "-"}</p>
  <p><b>Enfermedades:</b> ${enfermedadesText}</p>
  <p><b>Implantes:</b> ${implantesText}</p>
  <p><b>Fármacos:</b> ${data.farmacos || "-"}</p>
  <p><b>Diagnóstico médico:</b> ${data.diagnostico || "-"}</p>
  <p><b>Motivo de consulta:</b> ${data.motivo || "-"}</p>
  <p><b>Dolor hace más de 3 meses:</b> ${data.dolorCronico || "-"}</p>
  <h4>Body Chart:</h4>
  ${bodyChartHTML}
`;

// 📨 Envío con Resend
await resend.emails.send({
  from: "Preconsulta Web <noreply@resend.dev>", // remitente genérico
  to: process.env.EMAIL_TO, // destino
  subject: "Nueva Preconsulta",
  html,
  attachments: attachments.map(a => ({
    filename: a.filename,
    content: a.content,
    encoding: "base64",
  })),
});


    res.json({ message: "Los datos fueron enviados exitosamente ✅ \n Gracias por tu tiempo!" });
  } catch (error) {
    console.error("❌ Error enviando correo:", error);
    res.status(500).json({ message: "Error al enviar el correo ❌" });
  }
});

// 🔹 Levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
