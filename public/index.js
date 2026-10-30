// --------------------- Helpers / configuraciones ---------------------
const imageMap = {
  hombre: {
    front: "/images/maleFront.png",
    back: "/images/maleBack.png",
    sideLeft: "/images/maleSide.png",
    sideRight: "/images/maleSideRight.png",
  },
  mujer: {
    front: "/images/womanFront.png",
    back: "/images/womanBack.png",
    sideLeft: "/images/womanSide.png",
    sideRight: "/images/womanSideRight.png",
  },
};

const viewOrder = ["front", "back", "sideLeft", "sideRight"];

// --------------------- Escala de dolor ---------------------
const escalaSlider = document.getElementById("escalaDolor");
const dolorValor   = document.getElementById("dolorValor");
if (escalaSlider && dolorValor) {
  escalaSlider.addEventListener("input", () => {
    dolorValor.textContent = escalaSlider.value;
  });
}

// --------------------- Edad y validaciones ---------------------
const fechaInput = document.getElementById("fechaNacimiento");
const edadSmall = document.getElementById("edad");
if (fechaInput && edadSmall) {
  const updateEdad = () => {
    const val = fechaInput.value;
    if (!val) return (edadSmall.textContent = "");
    const hoy = new Date();
    const nacimiento = new Date(val);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    edadSmall.textContent = `${edad} años`;
  };
  fechaInput.addEventListener("change", updateEdad);
  updateEdad(); // refleja la fecha precargada por defecto (ver preconsulta.ejs) sin esperar a que el usuario la toque
}

const telefonoInput = document.getElementById("telefono");
if (telefonoInput) {
  telefonoInput.addEventListener("input", () => {
    telefonoInput.value = telefonoInput.value.replace(/\D/g, "");
  });
}

// --------------------- Enfermedades / Implantes "Otro" ---------------------
const enfOtroCheckbox = document.getElementById("enfOtro");
const otraEnfInput = document.getElementById("otraEnfermedad");
const implOtro = document.getElementById("implOtro");
const otroImplante = document.getElementById("otroImplante");

function toggleOtroInput(checkbox, input) {
  if (checkbox.checked) {
    input.classList.remove("d-none");
    input.required = true;
  } else {
    input.classList.add("d-none");
    input.value = "";
    input.required = false;
  }
}
if (enfOtroCheckbox && otraEnfInput) {
  enfOtroCheckbox.addEventListener("change", () =>
    toggleOtroInput(enfOtroCheckbox, otraEnfInput)
  );
}
if (implOtro && otroImplante) {
  implOtro.addEventListener("change", () =>
    toggleOtroInput(implOtro, otroImplante)
  );
}

// D141 — tres "otra/otro" más que abren dónde escribir, y el cáncer, que abre qué tipo. Mismo
// patrón que enfermedades e implantes, salvo que el texto NO es obligatorio: elegir "otra" ya dice
// algo, y trabar el envío por no haber escrito cuál sería castigar al que contesta.
function alternarSegun(disparador, objetivo, { limpiar = [] } = {}) {
  if (!disparador || !objetivo) return;
  const aplicar = () => {
    objetivo.classList.toggle("d-none", !disparador.checked);
    if (!disparador.checked) {
      if (objetivo.tagName === "INPUT") objetivo.value = "";
      limpiar.forEach((el) => { if (el.type === "checkbox") el.checked = false; else el.value = ""; });
    }
  };
  disparador.addEventListener("change", aplicar);
  aplicar();
}
const cancerDetalle = document.getElementById("cancerDetalle");
alternarSegun(document.getElementById("enfCancer"), cancerDetalle, {
  limpiar: cancerDetalle ? Array.from(cancerDetalle.querySelectorAll("input")) : [],
});
alternarSegun(document.getElementById("cancer_otro"), document.getElementById("otroCancer"));
alternarSegun(document.getElementById("actTipo_otro"), document.getElementById("otraActividad"));
alternarSegun(document.getElementById("zona_otra"), document.getElementById("otraZona"));

const preConsultaForm = document.getElementById("preConsultaForm");
// D127 — este archivo es estático: no hay EJS que le interpole nada, así que los rótulos llegan
// en `data-textos` del formulario, ya traducidos por la vista que lo carga. Mismo patrón que
// adminBodyChart.js.
const T = JSON.parse(preConsultaForm?.dataset.textos || "{}");
preConsultaForm.addEventListener("reset", () => {
  [otraEnfInput, otroImplante].forEach((input) => {
    if (!input) return;
    input.classList.add("d-none");
    input.value = "";
    input.required = false;
  });
});

// --------------------- Borrador (agenda, fase 1b — S2) ---------------------
// Solo cuando este formulario viene encadenado a una reserva pública sin ficha (turnoToken no
// vacío, ver GET /reservar/:token/preconsulta): prellena nombre/mail que el paciente ya dejó al
// reservar, y de ahí en más autoguarda cada cambio en IndexedDB DEL PROPIO NAVEGADOR — nunca en
// el host (ver public/borrador.js). El formulario de siempre (con `linkId`) no toca nada de esto.
const turnoTokenInput = document.getElementById("turnoToken");
const TURNO_TOKEN = turnoTokenInput && turnoTokenInput.value ? turnoTokenInput.value : "";

if (TURNO_TOKEN && window.leerBorrador) {
  leerBorrador(TURNO_TOKEN).then((borrador) => {
    if (!borrador) return;
    for (const [nombreCampo, valor] of Object.entries(borrador)) {
      if (valor === null || valor === undefined) continue;
      const campo = preConsultaForm.elements.namedItem(nombreCampo);
      if (!campo) continue;
      if (typeof RadioNodeList !== "undefined" && campo instanceof RadioNodeList) {
        // Grupo de radios o de checkboxes con el mismo name: el borrador trae un array (varios
        // checkboxes marcados) o un string suelto (un radio elegido).
        const marcados = Array.isArray(valor) ? valor : [valor];
        campo.forEach((el) => { el.checked = marcados.includes(el.value); });
      } else if (campo.type === "checkbox") {
        campo.checked = true; // solo aparece en el borrador si estaba tildado (FormData no manda los sueltos)
      } else if (campo.type !== "file") {
        campo.value = valor;
      }
    }
    // Los campos que dependen de un valor restaurado (edad calculada, el "Otro" de
    // enfermedades/implantes) escuchan `change` — restaurar el valor no lo dispara solo.
    fechaInput?.dispatchEvent(new Event("change"));
    enfOtroCheckbox?.dispatchEvent(new Event("change"));
    implOtro?.dispatchEvent(new Event("change"));
    ["enfCancer", "cancer_otro", "actTipo_otro", "zona_otra"].forEach((id) => document.getElementById(id)?.dispatchEvent(new Event("change")));
    // D136 — un borrador que traía "dolor hace 3 meses o más" tiene que volver a abrir su rama.
    preConsultaForm.dispatchEvent(new Event("change"));
  });
}

if (TURNO_TOKEN && window.guardarBorrador) {
  const CAMPOS_SIN_BORRADOR = new Set(["adjuntos", "website", "_csrf", "turnoId", "turnoToken", "bodyChartData"]);
  let guardarTimer = null;
  const programarGuardadoBorrador = () => {
    clearTimeout(guardarTimer);
    // Debounce: no tiene sentido escribir en IndexedDB en cada tecla — con la carga clínica típica
    // (textareas largos) sería demasiado tráfico para un beneficio que no cambia con la frecuencia.
    guardarTimer = setTimeout(() => {
      const datos = {};
      for (const [nombreCampo, valor] of new FormData(preConsultaForm).entries()) {
        if (CAMPOS_SIN_BORRADOR.has(nombreCampo) || valor instanceof File) continue;
        if (datos[nombreCampo] === undefined) datos[nombreCampo] = valor;
        else if (Array.isArray(datos[nombreCampo])) datos[nombreCampo].push(valor);
        else datos[nombreCampo] = [datos[nombreCampo], valor];
      }
      guardarBorrador(TURNO_TOKEN, datos);
    }, 800);
  };
  preConsultaForm.addEventListener("input", programarGuardadoBorrador);
  preConsultaForm.addEventListener("change", programarGuardadoBorrador);
}

//--------------------- Lógica BODY CHART ---------------------
const generoRadios = document.querySelectorAll('input[name="genero"]');
const canvasIds = { front: "canvas-front", back: "canvas-back", sideLeft: "canvas-sideLeft", sideRight: "canvas-sideRight" };
const bgCanvasIds = { front: "canvas-front-bg", back: "canvas-back-bg", sideLeft: "canvas-sideLeft-bg", sideRight: "canvas-sideRight-bg" };
const viewLabels = { front: T.front, back: T.back, sideLeft: T.sideLeft, sideRight: T.sideRight };

// Dos canvas por vista: `canvases` es la capa de PINTURA (transparente, donde se dibuja/borra)
// y `bgCanvases` es la capa de FONDO (silueta fija). Separarlas evita tener que redibujar el
// fondo cada vez que se borra, y de paso la capa de fondo sirve como fuente del hit-test de
// alfa (nunca se pinta encima de ella).
const canvases = {};
const bgCanvases = {};
const viewports = {}; // ventana con scroll (zoom) por vista
const wraps = {};      // elemento que se agranda al hacer zoom
Object.keys(canvasIds).forEach((v) => {
  const paint = document.getElementById(canvasIds[v]);
  const bg = document.getElementById(bgCanvasIds[v]);
  const viewport = document.getElementById(`viewport-${v}`);
  const wrap = document.getElementById(`wrap-${v}`);
  if (paint && bg && viewport && wrap) {
    canvases[v] = paint;
    bgCanvases[v] = bg;
    viewports[v] = viewport;
    wraps[v] = wrap;
  }
});
const bodyChartEnabled = Object.keys(canvases).length === viewOrder.length;

const ctxs = {};
const bgCtxs = {};
const backgrounds = {};
const hasChanges = { front: false, back: false, sideLeft: false, sideRight: false };
let currentGender = "hombre";

if (bodyChartEnabled) {
  Object.keys(canvases).forEach((v) => {
    ctxs[v] = canvases[v].getContext("2d");
    bgCtxs[v] = bgCanvases[v].getContext("2d", { willReadFrequently: true });
    backgrounds[v] = new Image();
  });
}

// Las siluetas comparten alto en origen (1024 px) pero no ancho: 436 px las de costado contra 516
// las de frente. A ancho igual —que es lo que hacía `.chart-canvas-wrap { width: 100% }`— las de
// costado se veían un 20% más altas, y el cuerpo más grande, que las de frente.
//
// Cada vista recibe un ancho base proporcional a su relación de aspecto, con la silueta más ancha
// del juego como 100%: así las cuatro terminan con el mismo alto y la misma escala. El zoom
// multiplica ESE ancho base, no el 100% (ver applyZoom). El tope en 100% es por si alguna vez
// entra una imagen más ancha que la referencia: mejor que quede algo más chica a que desborde.
//
// Mismo criterio en public/adminBodyChart.js y en partials/body-chart-galeria.ejs.
const RATIO_SILUETA_MAS_ANCHA = 516 / 1024;

function normalizarAncho(view, w, h) {
  const wrap = wraps[view];
  if (!wrap) return;
  const pct = Math.min(100, (w / h) / RATIO_SILUETA_MAS_ANCHA * 100);
  wrap.dataset.anchoBase = pct; // lo lee applyZoom
  wrap.style.width = `${pct}%`;
  wrap.style.marginInline = "auto";
}

function loadAllBackgrounds(gender) {
  if (!bodyChartEnabled) return;
  const map = imageMap[gender];
  Object.keys(map).forEach((view) => {
    const bg = backgrounds[view];
    const paintCanvas = canvases[view];
    const paintCtx = ctxs[view];
    const bgCanvas = bgCanvases[view];
    const bgCtx = bgCtxs[view];
    bg.src = map[view];
    bg.onload = () => {
      const w = bg.naturalWidth || 800;
      const h = bg.naturalHeight || 1200;
      bgCanvas.width = w;
      bgCanvas.height = h;
      bgCtx.clearRect(0, 0, w, h);
      bgCtx.drawImage(bg, 0, 0, w, h);
      // La capa de pintura comparte tamaño con el fondo para que los trazos alineen pixel a
      // pixel; al cambiar de género se reinicia (no correspondería mantener marcas del otro).
      paintCanvas.width = w;
      paintCanvas.height = h;
      paintCtx.clearRect(0, 0, w, h);
      normalizarAncho(view, w, h);
      hasChanges[view] = false;
    };
  });
}
loadAllBackgrounds(currentGender);

generoRadios.forEach((radio) =>
  radio.addEventListener("change", () => {
    if (radio.checked) {
      currentGender = radio.value === "mujer" ? "mujer" : "hombre"; // "otro" usa imagen masculina
      loadAllBackgrounds(currentGender);
    }
  })
);

// Cursores de escritorio: pincel al pintar, goma al borrar — en vez de la flecha de siempre.
// Se generan por código (SVG inline) para no depender de archivos de imagen aparte.
function svgCursor(inner, hotspotX, hotspotY, fallback) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">${inner}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}, ${fallback}`;
}
const BRUSH_CURSOR = svgCursor(
  `<g transform="rotate(45 15 15)">
     <rect x="13" y="2" width="4" height="13" rx="1.5" fill="#8a5a2b"/>
     <rect x="11" y="14" width="8" height="6" rx="1.5" fill="#bbb"/>
     <path d="M11.5 20 L15 27 L18.5 20 Z" fill="#0064ff" stroke="#333" stroke-width="0.6"/>
   </g>`,
  5, 27, "crosshair"
);
const ERASER_CURSOR = svgCursor(
  `<g transform="rotate(-20 15 15)">
     <rect x="6" y="11" width="18" height="10" rx="2" fill="#ffffff" stroke="#333" stroke-width="1.2"/>
     <rect x="6" y="11" width="18" height="4.5" rx="2" fill="#ff8fa3"/>
   </g>`,
  15, 16, "crosshair"
);

let resetZoomAndMove = () => {}; // el submit del form la reasigna abajo si hay body chart

if (bodyChartEnabled) {
  // --- Herramienta: pincel (con color) o goma — un único selector de "dots" equivalentes ---
  let brushColor = "blue";
  let brushMode = "paint"; // "paint" | "erase"
  let moveMode = false;
  const toolDots = document.querySelectorAll("#colorSelector .color-dot");

  function updateCursor() {
    const cursor = moveMode ? "grab" : brushMode === "erase" ? ERASER_CURSOR : BRUSH_CURSOR;
    Object.values(canvases).forEach((c) => { c.style.cursor = cursor; });
  }

  // --- Mover: alterna entre pintar/borrar y desplazar la vista con un solo dedo/mouse.
  // Mismo lenguaje visual que los dots de color/goma: borde negro cuando está activo, sin
  // cambiar de color de fondo. ---
  const moveBtn = document.getElementById("moveTool");
  function setMoveMode(active) {
    moveMode = active;
    if (moveBtn) moveBtn.classList.toggle("tool-active", active);
    // Mover es excluyente con pincel/goma: si se activa, ningún dot queda con el marco
    // puesto (si no, parece que hay dos herramientas elegidas a la vez); al desactivarlo,
    // vuelve a marcarse el pincel/goma que seguía activo por debajo.
    if (active) {
      toolDots.forEach((d) => d.classList.remove("selected"));
    } else {
      const dot = Array.from(toolDots).find((d) =>
        brushMode === "erase" ? d.dataset.tool === "erase" : d.dataset.tool === "paint" && d.dataset.color === brushColor
      );
      if (dot) dot.classList.add("selected");
    }
    updateCursor();
  }
  // Aviso de "Mover es para cuando hay zoom": a 100% no tiene sentido (no hay nada que
  // desplazar), así que ni se activa — se muestra un cartelito breve en vez de dejar
  // seleccionado un modo que no hace nada.
  const moveToast = document.getElementById("moveToast");
  let moveToastTimer = null;
  function showMoveToast() {
    if (!moveToast) return;
    moveToast.classList.remove("d-none");
    clearTimeout(moveToastTimer);
    moveToastTimer = setTimeout(() => moveToast.classList.add("d-none"), 2000);
  }

  if (moveBtn) {
    moveBtn.addEventListener("click", () => {
      if (!moveMode && zoomIdx[viewOrder[currentViewIdx]] === 0) {
        showMoveToast();
        return;
      }
      setMoveMode(!moveMode);
    });
  }

  toolDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      setMoveMode(false); // elegir pincel/goma sale del modo Mover
      toolDots.forEach((d) => d.classList.remove("selected"));
      dot.classList.add("selected");
      if (dot.dataset.tool === "erase") {
        brushMode = "erase";
      } else {
        brushMode = "paint";
        brushColor = dot.dataset.color;
      }
      updateCursor();
    });
  });
  updateCursor();

  // --- Zoom: por vista, cada una recuerda su propio nivel ---
  const ZOOM_LEVELS = [1, 1.5, 2, 2.5, 3];
  const zoomIdx = { front: 0, back: 0, sideLeft: 0, sideRight: 0 };
  const zoomLevelLabel = document.getElementById("zoomLevel");
  const zoomHint = document.getElementById("zoomHint");

  function refreshZoomUI(view) {
    const level = ZOOM_LEVELS[zoomIdx[view]];
    if (zoomLevelLabel) zoomLevelLabel.textContent = `${Math.round(level * 100)}%`;
    if (zoomHint) zoomHint.classList.toggle("d-none", level <= 1);
  }

  function applyZoom(view) {
    const level = ZOOM_LEVELS[zoomIdx[view]];
    const viewport = viewports[view];
    const wrap = wraps[view];

    // El 100% de esta vista no es el ancho de la columna, sino el ancho base que la deja del
    // mismo alto que las demás (ver normalizarAncho). El zoom multiplica eso.
    const base = Number(wrap.dataset.anchoBase) || 100;

    if (level === 1) {
      // Vuelve exactamente al comportamiento de siempre: se ve todo, sin scroll.
      viewport.style.height = "";
      viewport.style.overflow = "hidden";
      wrap.style.width = `${base}%`;
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    } else {
      // Fija la ventana al alto que tenía a 100% ANTES de agrandar el contenido, así el
      // resto de la página no salta — recién ahí agranda el wrap y prende el scroll.
      if (!viewport.style.height) {
        viewport.style.height = `${viewport.getBoundingClientRect().height}px`;
      }
      viewport.style.overflow = "auto";
      wrap.style.width = `${level * base}%`;
      requestAnimationFrame(() => {
        viewport.scrollLeft = (wrap.scrollWidth - viewport.clientWidth) / 2;
        viewport.scrollTop = (wrap.scrollHeight - viewport.clientHeight) / 2;
      });
    }
    if (view === viewOrder[currentViewIdx]) refreshZoomUI(view);
  }

  function changeZoom(view, delta) {
    const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, zoomIdx[view] + delta));
    if (next === zoomIdx[view]) return;
    zoomIdx[view] = next;
    applyZoom(view);
  }

  const zoomInBtn = document.getElementById("zoomIn");
  const zoomOutBtn = document.getElementById("zoomOut");
  if (zoomInBtn) zoomInBtn.addEventListener("click", () => changeZoom(viewOrder[currentViewIdx], 1));
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => changeZoom(viewOrder[currentViewIdx], -1));

  resetZoomAndMove = () => {
    setMoveMode(false);
    Object.keys(zoomIdx).forEach((v) => {
      zoomIdx[v] = 0;
      applyZoom(v);
    });
  };

  // El texto "Goma" también selecciona la herramienta (no solo el ícono).
  const eraserLabel = document.querySelector(".eraser-label");
  const eraserDot = document.getElementById("eraserTool");
  if (eraserLabel && eraserDot) {
    eraserLabel.addEventListener("click", () => eraserDot.click());
  }

  // En mobile no hay cursor que muestre el tamaño de la goma como en desktop: se marca con
  // un círculo que sigue al dedo mientras se borra.
  const eraserIndicator = document.getElementById("eraserIndicator");
  function showEraserIndicator(clientX, clientY, screenDiameter) {
    if (!eraserIndicator) return;
    eraserIndicator.style.width = `${screenDiameter}px`;
    eraserIndicator.style.height = `${screenDiameter}px`;
    eraserIndicator.style.left = `${clientX}px`;
    eraserIndicator.style.top = `${clientY}px`;
    eraserIndicator.style.display = "block";
  }
  function hideEraserIndicator() {
    if (eraserIndicator) eraserIndicator.style.display = "none";
  }

  // --- Vista activa: a qué vista apuntan el zoom y Mover de la barra de arriba (la que se está
  // tocando/pintando, o la que se muestra en el nav de mobile). ---
  let currentViewIdx = 0;
  function setActiveView(view) {
    const idx = viewOrder.indexOf(view);
    if (idx === -1) return;
    currentViewIdx = idx;
    refreshZoomUI(view); // cada vista tiene su propio nivel de zoom
  }
  setActiveView(viewOrder[0]);

  // Un "Borrar todo" POR SILUETA, debajo de cada una. Antes había uno solo al pie del body chart
  // que apuntaba a "la vista activa": con dos siluetas a la vista no se sabía cuál iba a borrar,
  // y el de la otra no aparecía.
  document.querySelectorAll(".chart-clear").forEach((boton) => {
    boton.addEventListener("click", () => {
      const view = boton.dataset.view;
      const paintCanvas = canvases[view];
      if (!paintCanvas) return;
      ctxs[view].clearRect(0, 0, paintCanvas.width, paintCanvas.height);
      hasChanges[view] = false;
    });
  });

  // --- Drawer ---
  const makeDrawer = (view) => {
    const c = canvases[view];
    const ctx = ctxs[view];
    const bgCtx = bgCtxs[view];
    const viewport = viewports[view];
    let painting = false;
    let lastDrawPos = null;
    let twoFingerMid = null; // punto medio entre los 2 dedos en el frame anterior, para el pan
    const brushRadius = 15;
    const minDist = brushRadius * 0.5; // evita acumulación por círculos demasiado juntos

    function touchMidpoint(e) {
      const [t0, t1] = e.touches;
      return { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
    }

    function getLocalPoint(e) {
      const rect = c.getBoundingClientRect();
      const touch = e.touches?.[0] || e.changedTouches?.[0];
      const clientX = e.clientX ?? touch?.clientX;
      const clientY = e.clientY ?? touch?.clientY;
      return { rect, x: clientX - rect.left, y: clientY - rect.top };
    }

    function getPos(e) {
      const { rect, x, y } = getLocalPoint(e);
      return { x: x * (c.width / rect.width), y: y * (c.height / rect.height) };
    }

    // Franja de "no pintar" pegada al borde visible del canvas, en píxeles de pantalla
    // (no de la imagen): el margen transparente real del PNG es demasiado angosto en mobile
    // (la imagen se muestra achicada) como para acertarle con el dedo. EDGE_PX asegura una
    // zona siempre scrolleable, sin importar cuánta transparencia real tenga la imagen ahí.
    const EDGE_PX = 25;
    function isNearEdge(e) {
      const { rect, x, y } = getLocalPoint(e);
      return x < EDGE_PX || x > rect.width - EDGE_PX || y < EDGE_PX || y > rect.height - EDGE_PX;
    }

    // Fuera de la silueta (margen transparente de la capa de fondo) no se pinta: se deja
    // pasar el toque para que el navegador scrollee normal en vez de "atraparlo".
    function isOverBody(pos) {
      const x = Math.max(0, Math.min(Math.round(pos.x), bgCtx.canvas.width - 1));
      const y = Math.max(0, Math.min(Math.round(pos.y), bgCtx.canvas.height - 1));
      const alpha = bgCtx.getImageData(x, y, 1, 1).data[3];
      return alpha > 10;
    }

    function shouldPaint(e) {
      if (isNearEdge(e)) return false;
      return isOverBody(getPos(e));
    }

    // La pintura NO puede salir de la silueta. Antes solo se controlaba dónde EMPEZABA el trazo:
    // arrastrando desde adentro se seguía pintando afuera, y cerca del borde el pincel (un
    // círculo de 15 px) derramaba color sobre el fondo. Después de cada pincelada se deja solo lo
    // que cae sobre el cuerpo: `destination-in` multiplica la pintura por el alfa de la silueta,
    // que es opaca adentro y transparente afuera. Se limita al cuadrado de la pincelada para no
    // recorrer el canvas entero en cada movimiento.
    function recortarASilueta(pos) {
      const r = brushRadius + 1;
      ctx.save();
      ctx.beginPath();
      ctx.rect(pos.x - r, pos.y - r, r * 2, r * 2);
      ctx.clip();
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(bgCtx.canvas, 0, 0);
      ctx.restore();
    }

    function start(e) {
      setActiveView(view); // el botón "Borrar" de arriba pasa a apuntar a esta vista
      painting = true;
      lastDrawPos = null;
      draw(e);
    }
    function stop() { painting = false; lastDrawPos = null; ctx.beginPath(); }

    function draw(e) {
      if (!painting) return;

      const pos = getPos(e);

      if (lastDrawPos) {
        const dx = pos.x - lastDrawPos.x;
        const dy = pos.y - lastDrawPos.y;
        if (Math.sqrt(dx * dx + dy * dy) < minDist) return;
      }
      lastDrawPos = pos;

      const grad = ctx.createRadialGradient(
        pos.x, pos.y, 0,
        pos.x, pos.y, brushRadius
      );

      if (brushMode === "erase") {
        // destination-out: en vez de sumar color, borra lo pintado en esa zona de la capa
        // de pintura — revela la silueta de fondo (capa aparte) sin redibujar nada.
        grad.addColorStop(0.00, "rgba(0,0,0,0.9)");
        grad.addColorStop(0.60, "rgba(0,0,0,0.5)");
        grad.addColorStop(1.00, "rgba(0,0,0,0)");
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, brushRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        if (brushColor === "blue") {
          grad.addColorStop(0.00, "rgba(0, 100, 255, 0.30)");
          grad.addColorStop(0.25, "rgba(0, 100, 255, 0.18)");
          grad.addColorStop(0.50, "rgba(0, 100, 255, 0.10)");
          grad.addColorStop(0.75, "rgba(0, 100, 255, 0.04)");
          grad.addColorStop(1.00, "rgba(0, 100, 255, 0)");
        } else {
          grad.addColorStop(0.00, "rgba(120, 0, 200, 0.30)");
          grad.addColorStop(0.25, "rgba(120, 0, 200, 0.18)");
          grad.addColorStop(0.50, "rgba(120, 0, 200, 0.10)");
          grad.addColorStop(0.75, "rgba(120, 0, 200, 0.04)");
          grad.addColorStop(1.00, "rgba(120, 0, 200, 0)");
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, brushRadius, 0, Math.PI * 2);
        ctx.fill();
        recortarASilueta(pos);
      }

      hasChanges[view] = true;
    }

    // Mouse: en modo Mover, arrastrar desplaza la vista (scroll manual del viewport) en vez
    // de pintar. Si no, solo pinta cuando cae sobre el cuerpo (sin conflicto de scroll acá).
    let panningMouse = false;
    let panStart = null;

    c.addEventListener("mousedown", (e) => {
      if (moveMode) {
        panningMouse = true;
        panStart = { x: e.clientX, y: e.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
        c.style.cursor = "grabbing";
        e.preventDefault();
        return;
      }
      if (!isOverBody(getPos(e))) return;
      e.preventDefault();
      start(e);
    });
    ["mouseup", "mouseleave"].forEach((ev) => c.addEventListener(ev, () => {
      if (panningMouse) { panningMouse = false; c.style.cursor = "grab"; return; }
      if (!painting) return;
      stop();
    }));
    c.addEventListener("mousemove", (e) => {
      if (panningMouse) {
        e.preventDefault();
        viewport.scrollLeft = panStart.left - (e.clientX - panStart.x);
        viewport.scrollTop = panStart.top - (e.clientY - panStart.y);
        return;
      }
      if (!painting) return;
      e.preventDefault();
      draw(e);
    });

    // Círculo que marca el tamaño/borde de la goma mientras se arrastra el dedo (solo tiene
    // sentido en modo borrar; pintando ya se ve el color quedando en el canvas).
    function updateEraserIndicator(e) {
      if (brushMode !== "erase") return hideEraserIndicator();
      const { rect, x, y } = getLocalPoint(e);
      const screenRadius = brushRadius * (rect.width / c.width);
      showEraserIndicator(rect.left + x, rect.top + y, screenRadius * 2);
    }

    // Touch:
    // - 2 dedos: SIEMPRE mueven la vista (aunque estés pintando con el modo pincel/goma) —
    //   se maneja a mano con scrollLeft/scrollTop, no se delega al navegador, porque una vez
    //   que se hizo preventDefault del primer dedo el navegador ya no retoma el scroll nativo
    //   aunque se sume un segundo dedo sin preventDefault.
    // - Modo Mover activo: un dedo desplaza (no pinta) — se deja pasar sin preventDefault y
    //   el scroll nativo del viewport (touch-action: pan-x pan-y) hace el resto.
    // - Si no, si el toque inicial cae en la franja de borde o fuera del cuerpo, tampoco se
    //   llama preventDefault → el navegador scrollea normal. Solo se bloquea pintando.
    c.addEventListener("touchstart", (e) => {
      if (e.touches.length >= 2) {
        if (painting) stop();
        hideEraserIndicator();
        twoFingerMid = touchMidpoint(e);
        e.preventDefault();
        return;
      }
      if (moveMode) return;
      if (!shouldPaint(e)) return;
      e.preventDefault();
      updateEraserIndicator(e);
      start(e);
    }, { passive: false });
    c.addEventListener("touchmove", (e) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        if (!twoFingerMid) { twoFingerMid = touchMidpoint(e); return; }
        const mid = touchMidpoint(e);
        viewport.scrollLeft -= mid.x - twoFingerMid.x;
        viewport.scrollTop -= mid.y - twoFingerMid.y;
        twoFingerMid = mid;
        return;
      }
      if (moveMode) return;
      if (!painting) return;
      e.preventDefault();
      updateEraserIndicator(e);
      draw(e);
    }, { passive: false });
    c.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) twoFingerMid = null;
      if (moveMode) return;
      if (!painting) return;
      e.preventDefault();
      hideEraserIndicator();
      stop();
    }, { passive: false });

  };
  Object.keys(canvases).forEach(makeDrawer);

  // --------------------- Mobile nav del body chart ---------------------
  const mobileNav = document.getElementById("mobileNav");
  const mobileViewLabel = document.getElementById("mobileViewLabel");
  const chartCards = document.querySelectorAll(".chart-card");

  function isMobile() { return window.innerWidth <= 768; }

  // En desktop las cuatro siluetas entraban en la grilla y quedaban una abajo de la otra. Ahora
  // van de a dos: cada par ocupa un lugar y el boton "Cambiar a ..." alterna cual se ve. Las
  // cuatro siguen en el DOM, solo cambia el display — lo pintado en la que se oculta no se pierde
  // ni deja de enviarse.
  const visibleDelPar = { A: "front", B: "sideRight" };

  function updateMobileNav() {
    if (!isMobile()) {
      mobileNav.classList.add("d-none");
      chartCards.forEach((card) => {
        card.style.display = visibleDelPar[card.dataset.par] === card.dataset.view ? "" : "none";
      });
      return;
    }
    mobileNav.classList.remove("d-none");
    chartCards.forEach((card, i) => { card.style.display = i === currentViewIdx ? "" : "none"; });
    mobileViewLabel.innerHTML = `${viewLabels[viewOrder[currentViewIdx]]}<br><small>${currentViewIdx + 1} de ${viewOrder.length}</small>`;
  }

  chartCards.forEach((card) => {
    // Tocar la tarjeta en cualquier lado -no solo pintar- la vuelve la vista activa. Con dos
    // siluetas visibles a la vez, "Borrar todo" tiene que ser previsible: apunta a la ultima que
    // el paciente toco, y basta un clic para cambiarla.
    card.addEventListener("pointerdown", () => setActiveView(card.dataset.view));

    const boton = card.querySelector(".chart-swap");
    if (!boton) return;
    boton.addEventListener("click", () => {
      const destino = boton.dataset.swapTo;
      visibleDelPar[card.dataset.par] = destino;
      // La vista que acaba de aparecer pasa a ser la activa: si no, "Borrar todo" seguiria
      // apuntando a la que se oculto y borraria algo que el paciente no esta viendo.
      setActiveView(destino);
      updateMobileNav();
    });
  });

  const prevBtn = document.getElementById("prevView");
  const nextBtn = document.getElementById("nextView");
  if (prevBtn) prevBtn.addEventListener("click", () => {
    setActiveView(viewOrder[(currentViewIdx - 1 + viewOrder.length) % viewOrder.length]);
    updateMobileNav();
  });
  if (nextBtn) nextBtn.addEventListener("click", () => {
    setActiveView(viewOrder[(currentViewIdx + 1) % viewOrder.length]);
    updateMobileNav();
  });

  updateMobileNav();
  window.addEventListener("resize", updateMobileNav);
}

// --------------------- Envío del formulario ---------------------
const adjuntosInput = document.getElementById("adjuntos");

preConsultaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;

  if (adjuntosInput && adjuntosInput.files.length > 3) {
    Swal.fire({ icon: "error", title: T.demasiadosArchivos, text: T.hastaTresArchivos });
    return;
  }

  // D141 — lo obligatorio que el navegador no sabe exigir solo: las zonas (un grupo de casillas)
  // y los deslizadores (un hidden). El servidor lo exige igual; esto es para no hacer viajar un
  // formulario largo solo para que vuelva con "falta responder".
  const falta = window.pretriajeFaltante ? window.pretriajeFaltante() : null;
  if (falta) {
    falta.el.scrollIntoView({ behavior: "smooth", block: "center" });
    Swal.fire({ icon: "warning", title: T.faltaResponder, text: falta.texto || "" });
    return;
  }
  // El nivel se calcula ANTES de enviar: después, el formulario se oculta y se resetea.
  const nivelPretriaje = window.pretriajeNivel ? window.pretriajeNivel() : null;

  const formData = new FormData(form);

  Swal.fire({
    title: T.enviandoFormulario,
    text: T.esperaMomento,
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  const gender = document.querySelector('input[name="genero"]:checked')?.value || "hombre";
  const prefix = gender === "mujer" ? "woman" : "male";

  if (bodyChartEnabled) {
    Object.keys(canvases).forEach((view) => {
      if (hasChanges[view]) {
        // El fondo (silueta) y la pintura viven en dos canvas separados: se componen acá
        // en uno solo para mandar la imagen completa, tal como la ve el paciente.
        const paintCanvas = canvases[view];
        const composite = document.createElement("canvas");
        composite.width = paintCanvas.width;
        composite.height = paintCanvas.height;
        const compositeCtx = composite.getContext("2d");
        compositeCtx.drawImage(bgCanvases[view], 0, 0);
        compositeCtx.drawImage(paintCanvas, 0, 0);
        const dataURL = composite.toDataURL("image/png");
        const suffix =
          view === "sideLeft"
            ? "Side"
            : view === "sideRight"
            ? "SideRight"
            : view.charAt(0).toUpperCase() + view.slice(1);
        formData.append(`${prefix}${suffix}`, dataURL);
      }
    });
  }

  /**
   * El cartel de "puede que este paciente ya exista". Devuelve el id del paciente elegido,
   * "nuevo", o null si Felipe cerro sin decidir (y entonces no se crea nada).
   *
   * Muestra QUE COINCIDE y QUE DIFIERE de cada candidato. La diferencia es lo que hace que el
   * cartel se resuelva mirandolo: "mismo nombre y apellido, pero el telefono y la fecha son
   * otros" se descarta en dos segundos, sin ir a abrir la ficha.
   */
  async function preguntarCoincidencia(candidatos) {
    const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] // i18n-exento: entidades HTML, no rótulos
    ));

    const filas = candidatos.map((c, i) => `
      <label style="display:block;text-align:left;border:1px solid #ddd;border-radius:6px;padding:.6rem;margin-bottom:.5rem;cursor:pointer">
        <input type="radio" name="candidato" value="${escapar(c.pacienteId)}" ${i === 0 ? "checked" : ""}>
        <strong>${escapar(c.nombreCompleto)}</strong>
        <a href="${escapar(c.url)}" target="_blank" rel="noopener" style="margin-left:.4rem;font-size:.85em">${escapar(T.verFicha)}</a>
        <div style="font-size:.85em;color:#2e7d32;margin-top:.2rem">${escapar(T.coincide)} ${escapar(c.coincidencias.join(", "))}</div>
        ${c.diferencias.length ? `<div style="font-size:.85em;color:#b26a00">${escapar(T.difiere)} ${escapar(c.diferencias.join(", "))}</div>` : ""}
      </label>`).join("");

    const r = await Swal.fire({
      icon: "warning",
      title: T.yaExisteTitulo,
      html: `<div style="text-align:left">${filas}</div>`,
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: T.esEstePaciente,
      denyButtonText: T.esUnoNuevo,
      cancelButtonText: T.cancelar,
      focusConfirm: false,
    });

    if (r.isConfirmed) {
      return document.querySelector('input[name="candidato"]:checked')?.value || null;
    }
    return r.isDenied ? "nuevo" : null;
  }

  try {
    // El endpoint sale del form: la misma vista sirve para la preconsulta publica y para
    // "Nuevo Ingreso" del panel, que ademas abre el episodio y redirige a la historia.
    const endpoint = form.dataset.endpoint || "/api/preconsulta";
    let res = await fetch(endpoint, { method: "POST", body: formData });
    let result = await res.json();

    // 409 = el servidor encontro pacientes que podrian ser este mismo (solo pasa en Nuevo
    // Ingreso). NUNCA fusiona solo: pregunta y reenvia con la decision de Felipe. Si cierra el
    // cartel sin elegir, no se crea nada — preferible a adivinar sobre una historia clinica.
    if (res.status === 409 && Array.isArray(result.candidatos) && result.candidatos.length) {
      const decision = await preguntarCoincidencia(result.candidatos);
      if (!decision) return;
      if (decision === "nuevo") formData.set("crearNuevo", "1");
      else formData.set("pacienteExistenteId", decision);
      res = await fetch(endpoint, { method: "POST", body: formData });
      result = await res.json();
    }

    if (res.ok) {
      // Ya se envió: el borrador dejó de tener sentido (y dejarlo permitiría reabrir el mismo
      // link y reenviar por error, con el formulario prellenado como si nada).
      if (TURNO_TOKEN && window.borrarBorrador) borrarBorrador(TURNO_TOKEN);
      Swal.fire({
        icon: "success",
        title: T.enviadoTitulo,
        text: result.message || T.graciasEnviada,
        timer: 2500,
        showConfirmButton: false,
      });
      if (result.redirect) return void (window.location.href = result.redirect);

      // D109: reemplazar el formulario por la pantalla de finalizado, como ya hacen la reserva y
      // el feedback. Antes acá iba `form.reset()`: el paciente terminaba mirando el formulario
      // otra vez, vacío, después de que el cartel se fuera solo a los 2,5 segundos — que se lee
      // como "no se envió" y lleva a completarlo de nuevo.
      //
      // El scroll es parte del arreglo, no un extra: el botón de enviar está al final de un
      // formulario largo y el panel arriba de todo, así que sin esto el cambio pasa fuera de
      // pantalla y el síntoma es el mismo.
      const panelOk = document.getElementById("preconsultaOk");
      if (panelOk) {
        form.classList.add("d-none");
        panelOk.classList.remove("d-none");
        // D141 — si el pretriage dio emergencia o urgencia, el paciente ve un aviso CALMO que le pide
        // comunicarse pronto con Felipe. El mismo para los dos niveles: nunca "vaya a emergencia",
        // porque puede ser un error de selección (ver preconsulta.ejs). El texto ya viene armado.
        const aviso = document.getElementById("pretriajeAviso");
        if (aviso && (nivelPretriaje === "emergencia" || nivelPretriaje === "urgente")) aviso.classList.remove("d-none");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      form.reset();
      loadAllBackgrounds(currentGender);
      resetZoomAndMove();
    } else {
      Swal.fire({
        icon: "error",
        title: T.errorEnviarTitulo,
        text: result.message || T.errorEnviar,
      });
    }
  } catch (err) {
    console.error("Error al enviar:", err);
    Swal.fire({
      icon: "error",
      title: T.errorConexionTitulo,
      text: T.errorConexion,
    });
  }
});
