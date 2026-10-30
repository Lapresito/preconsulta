// IDIOMA DE LA INTERFAZ (D127). Tres idiomas: español, inglés y portugués.
//
// CÓMO SE ELIGE, que son dos cosas distintas y conviene no mezclarlas:
//
//   · EL PANEL Y LOS FORMULARIOS DEL PACIENTE siguen el idioma de la INSTALACIÓN — el que Felipe
//     elige en la tuerca. Es un ajuste de esta copia instalada, no una preferencia de navegador:
//     vive en la tabla `instalacion` y lo publica el local al público, para que el formulario que
//     recibe el paciente esté en el mismo idioma que el panel donde se generó (pedido del dueño:
//     "para que sea consistente").
//
//   · LA LANDING tiene su propio selector, visible en la página. Es una página pública que puede
//     abrir cualquiera, y quien la abre elige en qué idioma leerla, sin tocar la configuración de
//     nadie. Ver `idiomaDeLanding()` más abajo.
//
// POR QUÉ UN REGISTRO EN MEMORIA Y NO UNA CONSULTA POR TEXTO. Mismo motivo que el catálogo de
// motivos (D125): todo el código —vistas incluidas— pide un texto de forma SÍNCRONA, en medio de
// un `.map()` o adentro de un EJS. Volver eso asíncrono para consultar la base en cada rótulo
// habría tocado cientos de lugares. Se carga una vez al arrancar y se refresca al cambiarlo.
import es from "./es.js";
import en from "./en.js";
import pt from "./pt.js";

// El orden es el que se ve en el selector. `nativo` y no "Inglés"/"Español": un menú de idiomas
// se lee en el idioma que ofrece — quien busca portugués busca "Português", no "Portugués".
//
// `locale` es para las FECHAS y los NÚMEROS, que no salen del diccionario sino de
// `toLocaleDateString`. Se eligieron las variantes regionales y no las genéricas por una razón
// concreta: `en-GB` y no `en-US` porque el resto del sistema muestra día/mes/año, y un 3/8
// que en una pantalla significa 3 de agosto y en la de al lado 8 de marzo es un error clínico
// esperando pasar. `pt-BR` y `es-UY` ya coinciden en ese orden.
//
// SIN BANDERAS, a propósito y comprobado en pantalla: Windows no trae las banderas emoji y las
// dibuja como el par de letras del país ("🇪🇸" sale "ES"), así que el selector mostraba "ES ES".
// Y una bandera nunca es un idioma: el portugués de este selector es el de Brasil, no el de
// Portugal, y el inglés no es de ningún país en particular.
export const IDIOMAS = [
  { codigo: "es", nativo: "Español", locale: "es-UY" },
  { codigo: "en", nativo: "English", locale: "en-GB" },
  { codigo: "pt", nativo: "Português", locale: "pt-BR" },
];

export const IDIOMA_DEFAULT = "es";

// El español es además el idioma FUENTE: es el que se escribe primero y contra el que se
// comparan los otros dos (ver test/i18n.test.js). Si una clave falta en `en` o en `pt`, se cae
// acá — un rótulo en español es un bug visible, pero es mejor que un hueco o una clave cruda.
const DICCIONARIOS = { es, en, pt };

export function esIdiomaValido(codigo) {
  return Object.prototype.hasOwnProperty.call(DICCIONARIOS, codigo);
}

export function idiomaInfo(codigo) {
  return IDIOMAS.find((i) => i.codigo === codigo) || IDIOMAS[0];
}

/**
 * Devuelve la función `t` de un idioma. Se le pasa a las vistas por `res.locals.t`.
 *
 *   t("nav.inicio")                        → "Inicio"
 *   t("ficha.pacienteDesde", { fecha })     → "Paciente desde 26/8/2026"
 *
 * Las variables van como `{nombre}` dentro del texto y NO se escapan acá: EJS ya escapa con
 * `<%= %>`, y escapar dos veces convierte un apellido con tilde en basura.
 */
export function traductor(codigo) {
  const dic = DICCIONARIOS[codigo] || DICCIONARIOS[IDIOMA_DEFAULT];
  const fuente = DICCIONARIOS[IDIOMA_DEFAULT];

  return function t(clave, vars) {
    let texto = dic[clave];
    if (texto === undefined) {
      texto = fuente[clave];
      // Una clave que no existe en NINGÚN diccionario es un error de programación (un tipeo en
      // el nombre). Se avisa por consola y se devuelve la clave: en pantalla se ve
      // "ficha.tituloo" en vez de un espacio en blanco, que es justo lo que hace falta para
      // encontrarlo. Nunca tira: un rótulo mal escrito no puede voltear una pantalla entera.
      if (texto === undefined) {
        console.warn(`[i18n] clave sin traducción: ${clave}`);
        return clave;
      }
    }
    if (!vars) return texto;
    return texto.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  };
}

// ── El idioma de la INSTALACIÓN (el del panel y el de los formularios) ──────────────────────
//
// Módulo con estado, deliberado y con el mismo precedente que `registrarMotivos()` en
// catalogos.js. Arranca en el default y lo pisa `src/services/idioma.js` al leer la base.
let idiomaInstalado = IDIOMA_DEFAULT;

export function idiomaInstalacion() {
  return idiomaInstalado;
}

export function registrarIdioma(codigo) {
  if (esIdiomaValido(codigo)) idiomaInstalado = codigo;
  return idiomaInstalado;
}

/**
 * El idioma de la LANDING, que es el único lugar donde manda el visitante y no la configuración.
 * Sale de la cookie que deja su propio selector; si no eligió nada, hereda el de la instalación
 * — que es la mejor primera impresión posible: el idioma en el que Felipe configuró su sitio.
 */
export function idiomaDeLanding(req) {
  const elegido = req?.cookies?.idioma || leerCookieIdioma(req);
  return esIdiomaValido(elegido) ? elegido : idiomaInstalacion();
}

// Sin `cookie-parser` en el proyecto (el CSRF también lee la cookie a mano, ver middleware/csrf.js).
function leerCookieIdioma(req) {
  const header = req?.headers?.cookie;
  if (!header) return null;
  const match = header.split(";").map((c) => c.trim()).find((c) => c.startsWith("idioma="));
  return match ? decodeURIComponent(match.slice("idioma=".length)) : null;
}

export const COOKIE_IDIOMA = "idioma";
