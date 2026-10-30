import multer from "multer";
import { fileTypeFromBuffer } from "file-type";

// D127 — el idioma de la INSTALACIÓN. Este módulo no corre dentro de una request con `res` a
// mano, así que no puede usar `res.locals.t`: pregunta por el idioma configurado, que es el
// mismo que ve Felipe en el panel y el paciente en el formulario.
import { traductor, idiomaInstalacion } from "../i18n/index.js";

const tm = (clave, vars) => traductor(idiomaInstalacion())(clave, vars);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB por archivo
const MAX_FILES = 3;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

// memoryStorage: los archivos nunca tocan disco. Se validan, se adjuntan al email
// y se descartan al terminar el request (datos de salud sensibles, no se persisten).
const multerUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES } });

export const upload = multerUpload;

// Imágenes de landing/servicios: tampoco se persisten a disco (prototipo sin storage real).
// Se guardan como data-URI (base64) directo en el store en memoria, así el admin sube un
// archivo real en vez de tener que pegar una URL a mano.
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

export function handleImage(fieldName) {
  return (req, res, next) => {
    imageUpload.single(fieldName)(req, res, (err) => {
      if (!err) return next();
      const message = err.code === "LIMIT_FILE_SIZE" ? tm("err.imagenGrande") : tm("err.imagenProcesar");
      res.status(400).send(message);
    });
  };
}

export async function validateImage(req, res, next) {
  try {
    if (!req.file) return next();
    const detected = await fileTypeFromBuffer(req.file.buffer);
    if (!detected || !ALLOWED_IMAGE_MIME.has(detected.mime)) {
      return res.status(400).send(tm("err.imagenFormato"));
    }
    req.file.dataUri = `data:${detected.mime};base64,${req.file.buffer.toString("base64")}`;
    next();
  } catch (err) {
    next(err);
  }
}

// Envuelve multer para devolver errores en JSON en vez del handler default de Express.
export function handleAdjuntos(req, res, next) {
  multerUpload.array("adjuntos", MAX_FILES)(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? tm("err.adjuntoGrande")
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
        ? `Máximo ${MAX_FILES} archivos adjuntos.`
        : tm("err.adjuntosProcesar");
    res.status(400).json({ message });
  });
}

// C10: body chart de una sesión — igual que el de la preconsulta, viaja como data-URI en un
// campo de texto (no un archivo), pero el límite de campo por defecto de multer (1 MB) alcanza
// sin problema para las 4 vistas (canvas 400x600). Sin archivos: solo campos.
const bodyChartSesionUpload = multer({ limits: { fieldSize: 3 * 1024 * 1024 } });

export function handleBodyChartSesion(req, res, next) {
  bodyChartSesionUpload.none()(req, res, (err) => {
    if (!err) return next();
    res.status(400).json({ ok: false, message: tm("err.bodyChartProcesar") });
  });
}

// No confiar en extensión ni Content-Type declarados por el cliente: se verifican los
// magic bytes reales. Esto también rechaza SVG (es texto, no matchea ninguna firma binaria).
export async function validateAdjuntos(req, res, next) {
  try {
    const files = req.files || [];
    for (const file of files) {
      const detected = await fileTypeFromBuffer(file.buffer);
      if (!detected || !ALLOWED_MIME.has(detected.mime)) {
        return res.status(400).json({
          message: `El archivo "${file.originalname}" no es un formato permitido. Solo se aceptan JPG, PNG, WEBP o PDF.`,
        });
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}
