import PDFDocument from "pdfkit";
import { traductor, idiomaInstalacion, idiomaInfo } from "../i18n/index.js";
import { textoActividad, textoZonas } from "../config/catalogos.js";

// El PDF sale del formulario del paciente, que sigue el idioma de la INSTALACIÓN (D127) — el
// mismo que el panel donde se generó. No hay request acá del que sacar un idioma propio.
const tp = (clave, vars) => traductor(idiomaInstalacion())(clave, vars);

export function generatePDF(data, attachments, nombreCompleto, edad, enfermedadesText, implantesText, fields = null, esSintetico = false, bloques = []) {
  const show = (key) => !fields || fields.includes(key);
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
      .text(tp("pdf.marca"), marginL, 18, { width: contentW, align: "center" });
    doc
      .fontSize(11)
      .font("Helvetica")
      .text(tp("pdf.preconsulta"), marginL, 46, { width: contentW, align: "center" });

    // Ficha de un paciente del seed (A5/A4) — que nadie confunda esto con un paciente real si
    // el PDF se guarda o se comparte fuera de la app.
    if (esSintetico) {
      doc.rect(0, 74, pageW, 14).fill("#c0392b");
      doc
        .fillColor("white")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text(tp("pdf.avisoSintetico"), marginL, 77, { width: contentW, align: "center" });
    }

    doc.fillColor("#000").y = 90;
    doc.fontSize(9).fillColor("#666").text(
      tp("pdf.fechaEnvio", {
        fecha: new Date().toLocaleDateString(idiomaInfo(idiomaInstalacion()).locale, { day: "2-digit", month: "2-digit", year: "numeric" }),
      }),
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

    section(tp("pdf.datosPaciente"));
    field(tp("pdf.nombreCompleto"), nombreCompleto);
    if (show("fechaNacimiento")) field(tp("form.campo.fechaNacimiento"), `${data.fechaNacimiento || "-"}${edad ? ` ${tp("pdf.edadAnios", { n: edad })}` : ""}`);
    if (show("telefono")) field(tp("form.campo.telefono"), data.telefono || "-");
    if (show("ocupacion")) field(tp("form.campo.ocupacion"), data.ocupacion || "-");
    if (show("residencia")) field(tp("form.campo.residencia"), data.residencia || "-");
    if (show("familia")) field(tp("form.campo.familia"), data.familia || "-");
    field(tp("pdf.genero"), data.genero || "-");

    section(tp("pdf.antecedentes"));
    if (show("enfermedades")) field(tp("form.campo.enfermedades"), enfermedadesText);
    if (show("implantes")) field(tp("pdf.dispositivos"), implantesText);
    if (show("farmacos")) field(tp("form.campo.farmacos"), data.farmacos || "-");
    if (show("cirugias")) field(tp("form.campo.cirugias"), data.cirugiasPrevias || "-");
    if (show("lesiones")) field(tp("form.campo.lesiones"), data.lesionesPrevias || "-");
    field(tp("pdf.actividad"), textoActividad(data));

    section(tp("pdf.motivoConsulta"));
    if (show("diagnostico")) field(tp("form.campo.diagnostico"), data.diagnostico || "-");
    if (show("motivo")) field(tp("form.campo.motivo"), data.motivo || "-");
    // D141 — dónde le duele, según el paciente (en el formulario con motivo fijo no se preguntó).
    if (show("motivo") && data.zonasConsulta) field(tp("pre.zonas"), textoZonas(data));
    if (show("dolorCronico")) field(tp("pdf.dolorTresMeses"), data.dolorCronico || "-");

    // D136 — los bloques variables (vistaBloques), ya legibles: puntaje, señales y respuestas.
    for (const b of bloques) {
      section(b.titulo);
      if (b.puntaje) field(tp("pdf.puntaje"), `${b.puntaje.total} (${b.puntaje.min}–${b.puntaje.max}) · ${b.puntaje.label}`);
      if (b.senales.length) field(tp("pdf.senales"), b.senales.map((s) => s.texto).join(" · "));
      for (const f of b.filas) field(f.texto, f.valor);
    }

    // Body chart — 2 imágenes por fila
    if (show("bodyChart") && attachments.length > 0) {
      section(tp("pdf.bodyChart"));

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
