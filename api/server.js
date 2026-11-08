// API del sitio de Felipe Mondada: SOLO el formulario de contacto de la landing.
//
// La landing es un Static Site aparte (public/), que abre al instante. Este servicio vive en el
// plan gratis de Render, que se duerme sin visitas: por eso la landing le pega a /salud apenas
// carga, y para cuando el visitante baja hasta el formulario ya está despierto.
import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import { Resend } from "resend";

const MAIL_DESTINO = process.env.MAIL_DESTINO || process.env.EMAIL_TO;
const MAIL_REMITENTE = process.env.MAIL_REMITENTE || "onboarding@resend.dev";
// Con RESEND_API_KEY manda de verdad; sin ella (desarrollo) imprime en el log.
const MAIL_MODO = process.env.MAIL_MODO || (process.env.RESEND_API_KEY ? "real" : "consola");

// Desde dónde se acepta el formulario. Para probar la landing en su link .onrender.com, sumarlo
// acá por la variable, separado por comas.
const ORIGENES = (process.env.CORS_ORIGENES || "https://fisiomondada.com,https://www.fisiomondada.com")
  .split(",").map((o) => o.trim()).filter(Boolean);

const app = express();
// Render pone un proxy adelante: sin esto el rate limit ve a todos con la misma IP.
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));

app.use((req, res, next) => {
  const origen = req.get("Origin");
  if (origen && ORIGENES.includes(origen)) {
    res.set("Access-Control-Allow-Origin", origen);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// El "despertador": la landing lo llama al cargar.
app.get("/salud", (req, res) => res.json({ ok: true }));

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiados envíos. Esperá unos minutos e intentá de nuevo." },
});

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let resend = null;

app.post("/api/consulta", formLimiter, async (req, res) => {
  const { nombre, telefono, email, consulta, website } = req.body || {};

  // Honeypot: si el campo oculto viene relleno es un bot.
  if (website) return res.json({ ok: true });

  if (!nombre?.trim() || !consulta?.trim()) return res.status(400).json({ message: "Completá tu nombre y tu consulta." });
  if (!telefono?.trim() && !email?.trim()) return res.status(400).json({ message: "Dejá un teléfono o un mail para que Felipe te pueda responder." });
  if (nombre.length > 100 || (telefono && telefono.length > 20) || (email && email.length > 150) || consulta.length > 2000)
    return res.status(400).json({ message: "Datos inválidos." });
  if (email?.trim() && !EMAIL_VALIDO.test(email.trim())) return res.status(400).json({ message: "Revisá el mail." });

  const mail = {
    from: `Web Felipe Mondada <${MAIL_REMITENTE}>`,
    to: MAIL_DESTINO,
    subject: `Nueva consulta — ${nombre.trim()}`,
    // Responder al mail le contesta directo al paciente.
    ...(email?.trim() ? { replyTo: email.trim() } : {}),
    html: `
      <h2>Nueva consulta desde la web</h2>
      <p><b>Nombre:</b> ${esc(nombre)}</p>
      <p><b>Teléfono:</b> ${esc(telefono) || "-"}</p>
      <p><b>Mail:</b> ${esc(email) || "-"}</p>
      <p><b>Consulta:</b></p>
      <p>${esc(consulta).replace(/\n/g, "<br>")}</p>
    `,
  };

  try {
    if (MAIL_MODO !== "real") {
      console.log(`[mail:${MAIL_MODO}] no enviado — consulta`);
    } else {
      resend ??= new Resend(process.env.RESEND_API_KEY);
      // El SDK no lanza en errores de la API (ej. sandbox): los devuelve en `error`.
      const { error } = await resend.emails.send(mail);
      if (error) throw new Error(`Resend: ${error.message}`);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Error enviando consulta:", err.message);
    res.status(500).json({ message: "No se pudo enviar. Probá por WhatsApp." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API en puerto ${PORT} — correo en modo ${MAIL_MODO}${MAIL_DESTINO ? "" : " (⚠️ falta MAIL_DESTINO/EMAIL_TO)"}`);
});
