// Sitio de Felipe Mondada: la landing y la preconsulta general, que llega por mail con el PDF.
//
// El formulario, el pretriage, los cuestionarios y el PDF salen de PMS (src/ es una copia
// recortada de la de PMS). Este sitio no guarda nada: cada preconsulta vive lo que dura el
// request y se va por mail.
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import { generalLimiter } from "./src/middleware/rateLimit.js";
import { idiomaMiddleware } from "./src/middleware/idioma.js";
import { CONTACTO_TELEFONO, CONTACTO_TELEFONO_TEL, MAIL_MODO, MAIL_DESTINO } from "./src/config/index.js";
import { mensajeSeguro } from "./src/lib/logScrub.js";
import rutasPreconsulta from "./src/routes/preconsulta.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Render pone un proxy adelante: sin esto el rate limit ve a todos los pacientes con la misma IP.
app.set("trust proxy", 1);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src", "views"));
app.locals.contactoTelefono = CONTACTO_TELEFONO;
app.locals.contactoTelefonoTel = CONTACTO_TELEFONO_TEL;

// ── Seguridad: cabeceras HTTP ──────────────────────────────────────────────
// La landing todavía carga Bootstrap e Inter de CDN y tiene el mapa de Google; la preconsulta
// usa solo lo de public/vendor/.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      styleSrc:    ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "fonts.googleapis.com"],
      fontSrc:     ["'self'", "fonts.gstatic.com"],
      imgSrc:      ["'self'", "data:", "blob:", "*.google.com", "*.googleapis.com", "*.gstatic.com"],
      frameSrc:    ["'self'", "www.google.com"],
      connectSrc:  ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));
app.use(generalLimiter);
app.use(idiomaMiddleware);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});

app.use(express.static(path.join(__dirname, "public")));
app.use(rutasPreconsulta);

// Error handler global: el detalle va al log, al paciente un mensaje genérico.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Error no manejado:", mensajeSeguro(err));
  const status = err.status || err.statusCode || 500;
  if (req.path.startsWith("/api/")) return res.status(status).json({ message: "Ocurrió un error. Intentá de nuevo." });
  res.status(status).type("text").send("Ocurrió un error.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT} — correo en modo ${MAIL_MODO}${MAIL_DESTINO ? "" : " (⚠️ falta MAIL_DESTINO/EMAIL_TO)"}`);
});
