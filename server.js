import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";

dotenv.config();
const app = express();
const upload = multer();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 🔹 Adjuntar múltiples imágenes del body chart (solo las que existan)
    const attachments = [];
    const bodyCharts = [
      "maleFront", "maleBack", "maleSide", "maleSideRight",
      "womanFront", "womanBack", "womanSide", "womanSideRight",
    ];

    bodyCharts.forEach((key) => {
      if (data[key] && typeof data[key] === "string" && data[key].startsWith("data:")) {
        const parts = data[key].split(",");
        const base64 = parts[1] || "";
        attachments.push({
          filename: `${key}.png`,
          content: base64,
          encoding: "base64",
          cid: key,
        });
      }
    });


    // 🔸 Email HTML
    let bodyChartHTML = "<p>(No se envió imagen)</p>";
if (attachments.length > 0) {
  bodyChartHTML = attachments
    .map(a => {
      // Generar un label legible a partir del filename
      const label = a.filename
        .replace("maleFront", "Hombre - Frente")
        .replace("maleBack", "Hombre - Espalda")
        .replace("maleSideRight", "Hombre - Lado derecho")
        .replace("maleSide", "Hombre - Lado izquierdo")
        .replace("womanFront", "Mujer - Frente")
        .replace("womanBack", "Mujer - Espalda")
        .replace("womanSideRight", "Mujer - Lado derecho")
        .replace("womanSide", "Mujer - Lado izquierdo");

      return `
        <div style="margin-bottom:15px;">
          <strong>${label}</strong><br>
          <img src="cid:${a.cid}" style="max-width:400px; border:1px solid #ccc; margin-top:5px;" alt="${label}" />
        </div>
      `;
    })
    .join("");
}

    const html = `
      <h2>🧍 Nueva Preconsulta</h2>
      <p><b>Nombres y apellidos:</b> ${nombreCompleto}</p>
      <p><b>Fecha de nacimiento:</b> ${data.fechaNacimiento || "-"} ${edad ? `(${edad} años)` : ""}</p>
      <p><b>Teléfono:</b> ${telefono}</p>
      <p><b>Ocupación:</b> ${data.ocupacion || "-"}</p>
      <p><b>Residencia:</b> ${data.residencia || "-"}</p>
      <p><b>Círculo familiar:</b> ${data.familia || "-"}</p>
      <p><b>Enfermedades:</b> ${enfermedadesText}</p>
      <p><b>Implantes:</b> ${data.implante || "-"} ${data.otroImplante ? `(${data.otroImplante})` : ""}</p>
      <p><b>Fármacos:</b> ${data.farmacos || "-"}</p>
      <p><b>Diagnóstico médico:</b> ${data.diagnostico || "-"}</p>
      <p><b>Motivo de consulta:</b> ${data.motivo || "-"}</p>
      <p><b>Dolor hace más de 3 meses:</b> ${data.dolorCronico || "-"}</p>
      <h4>Body Chart:</h4>
      ${bodyChartHTML}
    `;


    await transporter.sendMail({
      from: `"Preconsulta Web" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: "Nueva Pre-Consulta",
      html,
      attachments,
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
