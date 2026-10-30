// Borrador de formularios en el NAVEGADOR del paciente — nunca en el host (agenda, fase 1b, S2).
//
// Por qué existe: un paciente que reserva un turno sin ficha y de paso empieza su preconsulta
// puede cerrar la pestaña a mitad de camino. Guardar ese progreso en el servidor público sería
// justo el dato que la arquitectura Local-Online existe para que NO esté ahí — así que el
// borrador vive en IndexedDB del propio navegador, decisión tomada con el dueño (2026-08-18,
// ver TODO.md). Si el paciente cambia de navegador o de dispositivo, no hay borrador: es el
// costo aceptado a cambio de no tener un formulario a medio llenar legible en un servidor
// rentado.
//
// Todo BEST-EFFORT: sin IndexedDB (navegador viejo, modo privado que la bloquea), el formulario
// sigue funcionando exactamente igual, solo que sin recordar nada entre visitas.
// El nombre viaja en el navegador DEL PACIENTE, no en el nuestro: renombrarlo (era
// "veyra-borrador" hasta 2026-08-27) deja huérfano el borrador de quien tuviera uno a medio
// llenar. Se renombra igual porque no hay datos reales todavía y la base vieja no se borra
// sola; si alguna vez hay que hacerlo con el sistema en uso, la migración es leer la vieja
// una vez y volcarla en la nueva, no un rename.
const BORRADOR_DB = "pms-borrador";
const BORRADOR_STORE = "preconsulta";

function abrirBorradorDB() {
  return new Promise((resolve, reject) => {
    // Código interno, no un rótulo: este Error lo traga el `catch` best-effort de cada función
    // de abajo y nunca llega a una pantalla, así que no va al diccionario (D127).
    if (!window.indexedDB) return reject(new Error("indexeddb-no-disponible"));
    const req = indexedDB.open(BORRADOR_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(BORRADOR_STORE)) req.result.createObjectStore(BORRADOR_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// `clave` es el token del turno — cada link de reserva tiene su propio borrador, nunca se mezclan.
async function guardarBorrador(clave, datos) {
  try {
    const db = await abrirBorradorDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(BORRADOR_STORE, "readwrite");
      tx.objectStore(BORRADOR_STORE).put(datos, clave);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) { /* best-effort */ }
}

async function leerBorrador(clave) {
  try {
    const db = await abrirBorradorDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(BORRADOR_STORE, "readonly");
      const req = tx.objectStore(BORRADOR_STORE).get(clave);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) { return null; }
}

async function borrarBorrador(clave) {
  try {
    const db = await abrirBorradorDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(BORRADOR_STORE, "readwrite");
      tx.objectStore(BORRADOR_STORE).delete(clave);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) { /* best-effort */ }
}
