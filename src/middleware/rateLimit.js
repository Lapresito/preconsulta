import rateLimit from "express-rate-limit";

// D127 — el idioma de la INSTALACIÓN. Este módulo no corre dentro de una request con `res` a
// mano, así que no puede usar `res.locals.t`: pregunta por el idioma configurado, que es el
// mismo que ve Felipe en el panel y el paciente en el formulario.
import { traductor, idiomaInstalacion } from "../i18n/index.js";

const tm = (clave, vars) => traductor(idiomaInstalacion())(clave, vars);

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: tm("err.demasiadasSolicitudes") },
});

export const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: tm("err.demasiadosEnvios") },
});

// ⚠️ El limiter general de /admin/* SE ELIMINÓ, a propósito.
//
// Existía cuando el panel no tenía login y se pensaba servir por internet: ahí tenía sentido
// frenar enumeración. Con la arquitectura Local-Online eso cambió por completo: el panel corre
// en la máquina de Felipe, escucha solo en 127.0.0.1 y tiene contraseña (L9). No hay un atacante
// remoto a quien frenar, y en cambio SÍ hay una víctima segura: Felipe trabajando normal —abrir
// varias fichas, la campanita cada 30 s en cada pestaña— llegaba al tope y se quedaba sin
// aplicación, con un mensaje que le pide esperar minutos.
//
// Un límite que solo puede lastimar al único usuario legítimo no es una defensa.
//
// Lo único que se conserva es el freno al LOGIN, que sí protege algo real (probar contraseñas) y
// no puede molestar a alguien que escribe la suya bien.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Solo cuentan los intentos FALLIDOS: entrar bien no gasta cupo.
  skipSuccessfulRequests: true,
  message: { message: tm("err.demasiadosIntentos") },
});

// Sync del buzón (L3). Tiene que aguantar el polling del local sin molestar: el peor caso es un
// chequeo por minuto (60 en 15 min) más las descargas y confirmaciones. 300 deja margen de
// sobra para eso y para un arranque con varios lotes pendientes, y sigue frenando a alguien que
// quiera martillar el endpoint con tokens al azar.
export const buzonLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: tm("err.demasiadasBuzon") },
});
