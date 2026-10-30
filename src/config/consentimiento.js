// Consentimiento del formulario de preconsulta. TEXTO BORRADOR — pendiente de revisión por un
// abogado antes de producción (ver docs/tecnico/TODO.md y CLAUDE.md §"Próxima etapa"). Se
// guarda versionado (POLITICA_VERSION) junto con el hash del texto exacto que se mostró, así
// que cambiar este texto más adelante no afecta la validez de los consentimientos ya dados.
import { createHash } from "crypto";

export const POLITICA_VERSION = process.env.POLITICA_VERSION || "0-draft";

export const TEXTO_CONSENTIMIENTO =
  "Declaro que la información que completo en este formulario es correcta a mi entender, y " +
  "autorizo a Felipe Mondada (Lic. en Fisioterapia) a tratar mis datos de salud, incluida esta " +
  "preconsulta, exclusivamente para brindarme atención fisioterapéutica y para fines " +
  "estadísticos internos de su consultorio. Podré solicitar el acceso, la corrección o la " +
  `eliminación de mis datos en cualquier momento. [Texto en borrador, versión ${POLITICA_VERSION}, ` +
  "pendiente de revisión legal.]";

export const TEXTO_CONSENTIMIENTO_HASH = createHash("sha256").update(TEXTO_CONSENTIMIENTO).digest("hex");

// C7 (módulo clínico): la postconsulta es un formulario NUEVO que recoge datos de salud — que
// ya haya consentido la preconsulta no cubre esto automáticamente, así que registra su propia
// fila en `consentimientos`, con un aviso corto que remite al consentimiento original (no repite
// el texto entero, que ya aceptó).
export const TEXTO_CONSENTIMIENTO_POSTCONSULTA =
  "Acepto que esta información de seguimiento se sume a mi historia clínica en el consultorio " +
  "de Felipe Mondada (Lic. en Fisioterapia), bajo el mismo consentimiento que ya di al completar " +
  `mi preconsulta. [Texto en borrador, versión ${POLITICA_VERSION}, pendiente de revisión legal.]`;

export const TEXTO_CONSENTIMIENTO_POSTCONSULTA_HASH = createHash("sha256").update(TEXTO_CONSENTIMIENTO_POSTCONSULTA).digest("hex");
