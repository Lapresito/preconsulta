import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // importante para la imagen en base64

// Endpoint para recibir formulario
app.post("/api/send-form", async (req, res) => {
  const {
    nombre,
    fechaNacimiento,
    telefono,
    ocupacion,
    residencia,
    enfermedades,
    implantes,
    farmacos,
    diagnostico,
    motivo,
    dolor,
    chartImage, // base64 desde el canvas
  } = req.body;

  try {
    // Configura el transporter de Nodemailer (ejemplo Gmail, mejor usar OAuth2 o App Password)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // ⚠️ usar password de aplicación
      },
    });

    const mailOptions = {
      from: `"Formulario Preconsulta" <${process.env.EMAIL_USER}>`,
      to: "joacolaprovitera@gmail.com",
      subject: "Nueva preconsulta - FelipeM",
      html: `
        <h3>Datos de la preconsulta</h3>
        <p><b>Nombre:</b> ${nombre}</p>
        <p><b>Fecha de nacimiento:</b> ${fechaNacimiento}</p>
        <p><b>Teléfono:</b> ${telefono}</p>
        <p><b>Ocupación:</b> ${ocupacion}</p>
        <p><b>Residencia:</b> ${residencia}</p>
        <p><b>Enfermedades:</b> ${enfermedades}</p>
        <p><b>Implantes:</b> ${implantes}</p>
        <p><b>Fármacos:</b> ${farmacos}</p>
        <p><b>Diagnóstico:</b> ${diagnostico}</p>
        <p><b>Motivo de consulta:</b> ${motivo}</p>
        <p><b>Dolor +3 meses:</b> ${dolor}</p>
      `,
      attachments: [
        {
          filename: "bodychart.png",
          content: chartImage.split("base64,")[1],
          encoding: "base64",
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Formulario enviado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error al enviar correo" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend corriendo en puerto ${PORT}`));
