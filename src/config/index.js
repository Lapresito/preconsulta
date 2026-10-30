import dotenv from "dotenv";
import { conIpDeRed } from "../lib/red.js";

dotenv.config();

export const PORT = process.env.PORT || 3000;

// ── Correo ────────────────────────────────────────────────────────────────────────────────
// Nada de esto puede estar hardcodeado: cambiar de casilla o de proveedor tiene que ser editar
// variables, nunca tocar código (ver docs/tecnico/IDEAS-DE-PASAJE.md).
export const RESEND_API_KEY = process.env.RESEND_API_KEY;

// MAIL_DESTINO reemplaza a EMAIL_TO. Se acepta EMAIL_TO como fallback para no romper los .env
// que ya existen; el nombre viejo se puede borrar cuando estén todos migrados.
export const MAIL_DESTINO = process.env.MAIL_DESTINO || process.env.EMAIL_TO;

// Antes estaba hardcodeado en dos lugares de src/services/email.js. Mientras la cuenta de Resend
// esté en sandbox, `onboarding@resend.dev` es el único remitente que funciona; con dominio
// propio verificado pasa a ser algo@dominio-de-felipe.
export const MAIL_REMITENTE = process.env.MAIL_REMITENTE || "onboarding@resend.dev";

// "real" manda de verdad; "consola" imprime en el log en vez de mandarlo. En este sitio el
// default es "real" en cuanto hay RESEND_API_KEY: no hay base, así que una preconsulta que no
// sale por mail se pierde, y olvidarse la variable en Render no puede tener ese costo.
export const MAIL_MODO = process.env.MAIL_MODO || (RESEND_API_KEY ? "real" : "consola");

// ── Contacto del fisioterapeuta ───────────────────────────────────────────────────────────────
// El teléfono que ve el PACIENTE: la landing y el aviso del pretriage de la preconsulta (D141).
// Estaba escrito a mano en la landing; ahora vive acá para que el aviso no muestre otro número.
// `_TEL` es el formato del link (internacional, sin espacios); el otro, el que se lee.
export const CONTACTO_TELEFONO = process.env.CONTACTO_TELEFONO || "098 792 954";
export const CONTACTO_TELEFONO_TEL = process.env.CONTACTO_TELEFONO_TEL || "+59898792954";

// ── URL pública ───────────────────────────────────────────────────────────────────────────
// Base de los links de preconsulta/postconsulta que Felipe copia y manda. ÚNICO lugar donde vive
// el dominio. Antes se derivaba del host de la request entrante, lo que rompe en cuanto el panel
// deja de ser el que sirve el formulario.
//
// ⚠️ El fallback a `localhost:${PORT}` es una TRAMPA en el proceso local: PORT es el puerto del
// PANEL (3000), así que sin configurar nada el panel generaba links
// `http://localhost:3000/preconsulta/...` que apuntaban a sí mismo. Parecían funcionar en
// desarrollo —el local todavía servía el formulario— y habrían sido inservibles en producción.
//
// Por eso ahora cae a BUZON_URL_BASE, que es literalmente "la dirección del sitio público":
// desde el local es a dónde le pega el sync, y desde el público es su propia dirección. Un solo
// valor correcto para los dos procesos. El fallback viejo queda último, solo para que nada
// reviente si no hay ninguna de las dos.
// `FELIPEM_RED=1` reescribe el host a la IP de esta máquina (ver src/lib/red.js). Con `localhost`
// adentro, el link abierto en un celular apunta al propio celular y no anda.
//
// En el programa instalado esto ya lo resuelve el supervisor, que arma URL_PUBLICA con la IP
// antes de levantar nada; acá abajo queda como no-op porque el host ya no es localhost. Lo que
// arregla es DESARROLLO, donde no hay supervisor y URL_PUBLICA sale del .env.
//
// ⚠️ Solo aplica a URL_PUBLICA. BUZON_URL_BASE se queda SIEMPRE en localhost: es el proceso
// local hablando con el público dentro de la misma PC, y sacarlo a la red sería frágil sin ganar
// nada. Por eso se guarda `urlPublicaCruda` antes de reescribir y es esa la que usa el buzón.
const urlPublicaCruda =
  process.env.URL_PUBLICA || process.env.BUZON_URL_BASE || `http://localhost:${PORT}`;

export const URL_PUBLICA = process.env.FELIPEM_RED === "1"
  ? conIpDeRed(urlPublicaCruda, process.env.PORT_PUBLICO_TLS)
  : urlPublicaCruda;

// ── Buzón cifrado (arquitectura Local-Online) ─────────────────────────────────────────────
// El par de claves es EXCLUSIVO del buzón: no reutilizarlo para firmar nada.
// La privada solo existe en la máquina de Felipe; la pública, solo en el host.
export const BUZON_CLAVE_PUBLICA = process.env.BUZON_CLAVE_PUBLICA;   // solo el software público
export const BUZON_CLAVE_PRIVADA = process.env.BUZON_CLAVE_PRIVADA;   // solo el software local
export const BUZON_TOKEN = process.env.BUZON_TOKEN;                   // secreto compartido del sync
export const BUZON_DIR = process.env.BUZON_DIR || "./tmp/buzon";      // carpeta de sobres (host)
export const BUZON_URL_BASE = process.env.BUZON_URL_BASE || urlPublicaCruda; // a dónde le pega el sync
export const BUZON_RETENCION_DIAS = Number(process.env.BUZON_RETENCION_DIAS) || 30;

// D32: en un disco efímero el buzón funciona igual pero pierde sobres en silencio — el peor modo
// de fallar. Perder datos tiene que requerir haberlo declarado a propósito.
export const BUZON_ALMACENAMIENTO_EFIMERO = process.env.BUZON_ALMACENAMIENTO_EFIMERO === "true";

// Carpeta del almacén del software PÚBLICO (links, landing y servicios en JSON). No es una base
// de datos a propósito — ver src/db/publico/almacen.js.
export const PUBLICO_DIR = process.env.PUBLICO_DIR || "./tmp/publico";

// Agenda, fase 3 (Google Calendar) — todavía SIN implementar, nace apagado. Preparación a
// propósito (ver TODO.md): cuando se sume el calendario "sala de espera", esta bandera va a
// decidir si el detalle del turno (nombre incluido) puede escribirse en un evento que vive en el
// host, o si el host solo ve el evento opaco ("Reserva — 60 min"). Ningún lugar del código la lee
// todavía — nadie tiene que acordarse de prenderla por accidente antes de que la fase 3 exista.
export const AGENDA_DETALLE_EN_HOST = process.env.AGENDA_DETALLE_EN_HOST === "true";

// L7 — carpeta del log local. El archivo está hecho para que Felipe se lo mande a Joaco cuando
// algo falla, así que nunca lleva datos de paciente ni claves (D31).
export const LOG_DIR = process.env.LOG_DIR || "./logs";
export const LOG_RETENCION_DIAS = Number(process.env.LOG_RETENCION_DIAS) || 14;

// Carpeta donde caen los PDF de los correos SIMULADOS (MAIL_MODO != "real"). Existe para el
// instalador de pruebas: ahí no se manda la RESEND_API_KEY, así que sin esto el flujo de
// preconsulta termina sin nada visible y parece roto. Con el correo real no se escribe nada.
export const CORREOS_DIR = process.env.CORREOS_DIR || "./correos";

// L9 — login del panel local. NO es OAuth de Google (D27): el panel ya no está expuesto a
// internet, lo que se defiende es una laptop robada. Generar con: npm run generar-password
export const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
export const SESSION_SECRET = process.env.SESSION_SECRET;
