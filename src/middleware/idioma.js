// Deja `t` y el idioma vigente al alcance de TODAS las vistas, sin que cada ruta tenga que
// acordarse de pasarlos en su `render()` (D127). Va montado en los dos procesos.
//
// Dos idiomas distintos conviven en el mismo servidor y no hay que mezclarlos:
//
//   · `res.locals.t` — el idioma de la INSTALACIÓN. Es el del panel y el de los formularios que
//     recibe el paciente, que siguen al panel a propósito ("para que sea consistente").
//   · La LANDING se sirve aparte con `idiomaDeLanding(req)`, que respeta la cookie que deja su
//     propio selector. Esa vista pisa `t` en su propio render — ver `src/routes/public.js`.
import { traductor, idiomaInstalacion, IDIOMAS, idiomaInfo } from "../i18n/index.js";

export function idiomaMiddleware(req, res, next) {
  const codigo = idiomaInstalacion();
  res.locals.idioma = codigo;
  res.locals.t = traductor(codigo);
  // Para el atributo `lang` del <html>, que es lo que usan los lectores de pantalla y el
  // corrector ortográfico del navegador para saber en qué idioma está la página.
  res.locals.htmlLang = codigo;
  res.locals.idiomasDisponibles = IDIOMAS;
  // Para `toLocaleDateString`/`toLocaleString`: las fechas no salen del diccionario, pero
  // igual tienen que seguir al idioma. Todas las vistas lo usan en vez de 'es-UY' fijo.
  res.locals.locale = idiomaInfo(codigo).locale;
  next();
}
