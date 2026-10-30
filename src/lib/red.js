// La IP con la que otro dispositivo de la misma red ve a esta máquina.
//
// Vive acá y no en el supervisor porque hacen falta los dos lados: el supervisor la usa para
// armar `URL_PUBLICA` cuando arranca el programa instalado, y `src/config/index.js` para lo
// mismo en desarrollo, donde no hay supervisor. Con una copia en cada lado, "qué cuenta como IP
// de red" tendría dos definiciones que se irían separando.
//
// ⚠️ ELEGIR LA PRIMERA IPv4 NO ALCANZA, y es el error que tenía la versión anterior. Una PC de
// desarrollo tiene varias placas "externas" y casi todas son virtuales. En la máquina donde se
// escribió esto, `os.networkInterfaces()` devuelve, en este orden:
//
//     172.27.16.1     vEthernet (WSL (Hyper-V firewall))   ← virtual, no lleva a ningún lado
//     192.168.1.2     Ethernet                             ← la que sirve
//     192.168.56.1    Ethernet 2                           ← host-only de VirtualBox
//
// La primera es la de WSL. El link se genera igual, parece bien, y falla recién en el celular:
// exactamente el modo de fallar que esto tiene que evitar. `internal` no ayuda — en Node marca
// loopback, no "adaptador virtual".

import os from "os";

// Placas que nunca son la salida a la red de verdad. Se filtra por NOMBRE porque es lo único que
// distingue a un adaptador virtual: su IP está en el mismo rango privado que una placa real.
const VIRTUAL = /(vethernet|virtualbox|vmware|hyper-?v|wsl|docker|loopback|tap-|tunnel|bluetooth|vpn|zerotier|tailscale)/i;

/**
 * Preferencia entre IPs privadas. Más alto gana.
 *
 * `192.168.56.x` es el rango por defecto de la red "host-only" de VirtualBox: es 192.168 y no lo
 * pone ninguna red doméstica, así que va último aunque su prefijo sea el bueno. `172.16-31` va
 * abajo de `10` porque es el rango donde caen Docker y WSL cuando el nombre no los delató.
 */
function puntaje(ip) {
  if (ip.startsWith("192.168.56.")) return 0;
  if (ip.startsWith("192.168.")) return 3;
  if (ip.startsWith("10.")) return 2;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 1;
  return 0;
}

/**
 * La parte decidible de `ipDeRed`, separada para poder probarla: recibe lo que devuelve
 * `os.networkInterfaces()` y no toca el sistema.
 */
export function elegirIp(interfaces) {
  const preferidas = [];
  const descartadas = [];

  for (const [nombre, addrs] of Object.entries(interfaces || {})) {
    const pareceVirtual = VIRTUAL.test(nombre);
    for (const a of addrs ?? []) {
      // `169.254.x.x` es la IP que Windows se autoasigna cuando el DHCP no contestó: existe y no
      // lleva a ningún lado, que es peor que no tener ninguna.
      if (a.family !== "IPv4" || a.internal || a.address.startsWith("169.254.")) continue;
      (pareceVirtual ? descartadas : preferidas).push(a.address);
    }
  }

  // ⚠️ EL FILTRO POR NOMBRE ES UNA PREFERENCIA, NO UNA EXCLUSIÓN, y esa distinción es todo el
  // arreglo del caso "lo probé en una VM y me puso localhost".
  //
  // Adentro de una máquina virtual TODAS las placas son virtuales: la del guest se llama
  // "Ethernet (Hyper-V)", "vmxnet3" o parecido, y con exclusión dura no quedaba ninguna
  // candidata, `ipDeRed()` devolvía null y el link caía a `localhost`. Pero en una VM esa placa
  // "virtual" ES la salida real a la red — el filtro está para no elegir la de WSL cuando hay una
  // placa física al lado, no para decir que no existe red.
  //
  // Así que primero se busca entre las que no parecen virtuales, y si no hay ninguna se usan las
  // otras igual. Una IP que quizá no sirva es mejor que un `localhost` que seguro no sirve.
  const candidatos = preferidas.length ? preferidas : descartadas;
  candidatos.sort((a, b) => puntaje(b) - puntaje(a));
  return candidatos[0] ?? null;
}

/** La IPv4 de red de esta máquina, o null si no hay ninguna utilizable. */
export function ipDeRed() {
  return elegirIp(os.networkInterfaces());
}

/**
 * Convierte una URL local en la que se puede copiar y mandar por WhatsApp: cambia
 * `localhost`/`127.0.0.1` por la IP de red, y `http` por `https` en su propio puerto.
 *
 * Las dos cosas hacen falta y por razones distintas:
 *   · la IP, porque con `localhost` adentro el celular se lo pide a sí mismo;
 *   · el `https`, porque **WhatsApp no linkifica un `http://` con IP y puerto**. Queda como
 *     texto plano y hay que tipearlo a mano, que es justo lo que se está tratando de evitar.
 *     El certificado es autofirmado (ver src/lib/certLocal.js) y el celular avisa; para probar
 *     entre nosotros alcanza.
 *
 * Devuelve la URL sin tocar cuando no corresponde, y esos casos son la mitad del valor:
 *   · si ya apunta a un dominio o a una IP, no se toca — así esto es inofensivo el día que el
 *     sitio público esté hosteado de verdad con su propio certificado;
 *   · si no hay IP de red (sin wifi, o solo adaptadores virtuales), se queda como estaba, que al
 *     menos funciona en esta PC. Romper el link no mejora nada.
 *
 * `puertoTls` es el puerto del listener HTTPS. Tiene que ser DISTINTO del HTTP: el HTTP sigue
 * levantado para que el buzón le hable por `localhost` sin lidiar con el certificado.
 */
export function conIpDeRed(url, puertoTls) {
  const ip = ipDeRed();
  if (!ip) return url;
  try {
    const u = new URL(url);
    if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return url;
    u.hostname = ip;
    u.protocol = "https:";
    u.port = String(puertoTls || puertoSiguiente(u.port));
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

/** El puerto de al lado, que es el default del listener HTTPS cuando nadie eligió uno. */
export function puertoSiguiente(puerto) {
  const n = Number(puerto);
  return Number.isFinite(n) && n > 0 ? n + 1 : 3002;
}
