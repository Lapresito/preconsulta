// Vive suelto y no en `services/persistencia.js` porque lo necesitan los DOS roles: el local
// para persistir, el público para armar el mail. Y `persistencia.js` arrastra toda la cadena de
// repositorios de Postgres, que del lado público no queremos ni importar.
export function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "";
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad;
}
