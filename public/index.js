// --------------------- Helpers / configuraciones ---------------------
const imageMap = {
  hombre: {
    front: "images/maleFront.png",
    back: "images/maleBack.png",
    sideLeft: "images/maleSide.png",
    sideRight: "images/maleSideRight.png",
  },
  mujer: {
    front: "images/womanFront.png",
    back: "images/womanBack.png",
    sideLeft: "images/womanSide.png",
    sideRight: "images/womanSideRight.png",
  },
};

// vistas ordenadas (para mobile prev/next)
const viewOrder = ["front", "back", "sideLeft", "sideRight"];

// objeto para almacenar dataURL guardadas por vista
const savedImages = {
  front: null,
  back: null,
  sideLeft: null,
  sideRight: null,
};

// --------------------- Edad y validaciones ---------------------
const fechaInput = document.getElementById("fechaNacimiento");
const edadSmall = document.getElementById("edad");
fechaInput.addEventListener("change", () => {
  const val = fechaInput.value;
  if (!val) { edadSmall.textContent = ""; return; }
  const hoy = new Date();
  const nacimiento = new Date(val);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  edadSmall.textContent = `(${edad} años)`;
});

const telefonoInput = document.getElementById("telefono");
telefonoInput.addEventListener("input", () => {
  telefonoInput.value = telefonoInput.value.replace(/\D/g, "");
});

// --------------------- Enfermedades / Implantes "Otro" ---------------------
const enfOtroCheckbox = document.getElementById("enfOtro");
const otraEnfInput = document.getElementById("otraEnfermedad");
enfOtroCheckbox.addEventListener("change", () => {
  if (enfOtroCheckbox.checked) {
    otraEnfInput.classList.remove("d-none");
    otraEnfInput.required = true;
  } else {
    otraEnfInput.classList.add("d-none");
    otraEnfInput.value = "";
    otraEnfInput.required = false;
  }
});

const implOtro = document.getElementById("implOtro");
const otroImplante = document.getElementById("otroImplante");
implOtro.addEventListener("change", () => {
  if (implOtro.checked) {
    otroImplante.classList.remove("d-none");
    otroImplante.required = true;
  } else {
    otroImplante.classList.add("d-none");
    otroImplante.value = "";
    otroImplante.required = false;
  }
});

// Escuchar el evento "reset" del formulario
document.getElementById("preConsultaForm").addEventListener("reset", () => {
  otraEnfInput.classList.add("d-none");
  otraEnfInput.value = "";
  otraEnfInput.required = false;

  otroImplante.classList.add("d-none");
  otroImplante.value = "";
  otroImplante.required = false;
});


// --------------------- Google Places Autocomplete ---------------------
window.initAutocomplete = function () {
  const input = document.getElementById("residencia");
  if (!window.google || !window.google.maps || !window.google.maps.places) {
    console.warn("Google Places no está disponible.");
    return;
  }
  const options = {
    componentRestrictions: { country: "uy" },
    fields: ["formatted_address", "address_components", "geometry", "name"],
    types: ["(regions)"],
  };
  const autocomplete = new google.maps.places.Autocomplete(input, options);
  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    console.log("Lugar seleccionado:", place.formatted_address || place.name);
  });
};

// --------------------- Lógica BODY CHART (múltiples canvases) ---------------------
const generoRadios = document.querySelectorAll('input[name="genero"]');
const chartGrid = document.getElementById("chartGrid");
const mobileNav = document.getElementById("mobileNav");
const mobileViewLabel = document.getElementById("mobileViewLabel");
const prevViewBtn = document.getElementById("prevView");
const nextViewBtn = document.getElementById("nextView");

let currentGender = "hombre";
let currentMobileIndex = 0; // qué vista mostrar en mobile

// inicializar canvases y backgrounds
const canvases = {
  front: document.getElementById("canvas-front"),
  back: document.getElementById("canvas-back"),
  sideLeft: document.getElementById("canvas-sideLeft"),
  sideRight: document.getElementById("canvas-sideRight"),
};

const statuses = {
  front: document.getElementById("status-front"),
  back: document.getElementById("status-back"),
  sideLeft: document.getElementById("status-sideLeft"),
  sideRight: document.getElementById("status-sideRight"),
};

const previews = {
  front: document.getElementById("preview-front"),
  back: document.getElementById("preview-back"),
  sideLeft: document.getElementById("preview-sideLeft"),
  sideRight: document.getElementById("preview-sideRight"),
};

// mantenemos contexto y background image para cada canvas
const ctxs = {};
const backgrounds = {}; // Image objetos

Object.keys(canvases).forEach((v) => {
  const c = canvases[v];
  ctxs[v] = c.getContext("2d");
  backgrounds[v] = new Image();
});

// función para cargar fondos según género
function loadAllBackgrounds(gender) {
  const map = imageMap[gender];
  Object.keys(map).forEach((view) => {
    backgrounds[view].src = map[view];
    backgrounds[view].onload = () => {
      const c = canvases[view];
      // ajustar tamaño del canvas a la imagen para mantener buena resolución
      c.width = backgrounds[view].naturalWidth || 800;
      c.height = backgrounds[view].naturalHeight || 1200;
      ctxs[view].clearRect(0, 0, c.width, c.height);
      ctxs[view].drawImage(backgrounds[view], 0, 0, c.width, c.height);
    };
  });
}
loadAllBackgrounds(currentGender);

// cambiar fondos cuando cambia género
generoRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    if (radio.checked) {
      currentGender = radio.value === "mujer" ? "mujer" : "hombre";
      loadAllBackgrounds(currentGender);
      // limpiar previews y estados cuando se cambia género
      Object.keys(savedImages).forEach((k) => {
        savedImages[k] = null;
        previews[k].src = "";
        previews[k].classList.add("d-none");
        statuses[k].textContent = "Aún no se guardaron los cambios de pintado en la imagen.";
        statuses[k].className = "text-muted small mt-2 status";
      });
    }
  });
});

// Pintado difuminado azul (igual que tenías)
function makeDrawer(view) {
  const c = canvases[view];
  const ctx = ctxs[view];
  let painting = false;

  function getPos(e) {
    const rect = c.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return {
        x: (e.touches[0].clientX - rect.left) * (c.width / rect.width),
        y: (e.touches[0].clientY - rect.top) * (c.height / rect.height),
      };
    }
    return {
      x: (e.clientX - rect.left) * (c.width / rect.width),
      y: (e.clientY - rect.top) * (c.height / rect.height),
    };
  }

  function start(e) {
    painting = true;
    draw(e);
  }
  function stop() {
    painting = false;
    ctx.beginPath();
  }
  function draw(e) {
    if (!painting) return;
    const pos = getPos(e);
    // radial gradient, más oscuro si repetís sobre la zona (por acumulación)
    const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 30);
    grad.addColorStop(0, "rgba(0, 100, 255, 0.12)");
    grad.addColorStop(1, "rgba(0, 100, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(pos.x - 30, pos.y - 30, 60, 60);
    // No ctx.beginPath() necesario porque usamos fillRect con grad
  }

  // eventos mouse/touch
  c.addEventListener("mousedown", start);
  c.addEventListener("mouseup", stop);
  c.addEventListener("mouseleave", stop);
  c.addEventListener("mousemove", draw);

  c.addEventListener("touchstart", (e) => { e.preventDefault(); start(e); }, { passive: false });
  c.addEventListener("touchend", (e) => { e.preventDefault(); stop(e); }, { passive: false });
  c.addEventListener("touchmove", (e) => { e.preventDefault(); draw(e); }, { passive: false });

  // borrar función
  const clearBtn = document.querySelector(`.btn-clear[data-target="${view}"]`);
  clearBtn.addEventListener("click", () => {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(backgrounds[view], 0, 0, c.width, c.height);
    savedImages[view] = null;
    previews[view].classList.add("d-none");
    statuses[view].textContent = "Aún no se guardaron los cambios de pintado en la imagen.";
    statuses[view].className = "text-muted small mt-2 status";
  });

  // guardar función
  const saveBtn = document.querySelector(`.btn-save[data-target="${view}"]`);
  saveBtn.addEventListener("click", () => {
    const dataURL = c.toDataURL("image/png");
    savedImages[view] = dataURL;
    previews[view].src = dataURL;
    previews[view].classList.remove("d-none");
    statuses[view].textContent = "Cambios guardados correctamente ✅";
    statuses[view].className = "text-success small mt-2 status";
  });
}

// inicializar drawers para cada vista
Object.keys(canvases).forEach(makeDrawer);

// --------------------- Mobile navigation (mostrar 1 por vez) ---------------------
function updateMobileView() {
  const w = window.innerWidth;
  if (w <= 768) {
    mobileNav.classList.remove("d-none");
    // ocultar todos excepto currentMobileIndex
    const cards = Array.from(document.querySelectorAll(".chart-card"));
    cards.forEach((card, idx) => {
      card.style.display = idx === currentMobileIndex ? "block" : "none";
    });
    const viewKey = viewOrder[currentMobileIndex];
    mobileViewLabel.textContent = document.querySelector(`.chart-card[data-view="${viewKey}"] h6`).textContent;
  } else {
    mobileNav.classList.add("d-none");
    document.querySelectorAll(".chart-card").forEach(card => card.style.display = "block");
  }
}
window.addEventListener("resize", updateMobileView);
updateMobileView();

prevViewBtn.addEventListener("click", () => {
  currentMobileIndex = (currentMobileIndex - 1 + viewOrder.length) % viewOrder.length;
  updateMobileView();
});
nextViewBtn.addEventListener("click", () => {
  currentMobileIndex = (currentMobileIndex + 1) % viewOrder.length;
  updateMobileView();
});

// --------------------- Integración con el envío del formulario ---------------------
// --------------------- Integración con el envío del formulario ---------------------
document.getElementById("preConsultaForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);

  // Mostrar mensaje de "enviando..."
  Swal.fire({
    title: "Enviando formulario...",
    text: "Por favor, espera un momento.",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });

  // Detectar género y definir prefijo
  const gender = document.querySelector('input[name="genero"]:checked')?.value || "hombre";
  const prefix = gender === "mujer" ? "woman" : "male";

  // Agregar imágenes guardadas si existen
  let anySaved = false;
  if (savedImages.front) { formData.append(`${prefix}Front`, savedImages.front); anySaved = true; }
  if (savedImages.back) { formData.append(`${prefix}Back`, savedImages.back); anySaved = true; }
  if (savedImages.sideLeft) { formData.append(`${prefix}Side`, savedImages.sideLeft); anySaved = true; }
  if (savedImages.sideRight) { formData.append(`${prefix}SideRight`, savedImages.sideRight); anySaved = true; }

  formData.append("bodyChartCompleted", anySaved ? "yes" : "no");

  try {
    const res = await fetch("/api/preconsulta", {
      method: "POST",
      body: formData,
    });

    const result = await res.json();

    if (res.ok) {
      Swal.fire({
        icon: "success",
        title: "Formulario enviado ✅",
        text: result.message || "Gracias, tu preconsulta fue enviada correctamente.",
        timer: 2500,
        showConfirmButton: false,
      });

      // Limpiar formulario y canvas
      form.reset();
      loadAllBackgrounds(currentGender);
      Object.keys(savedImages).forEach((k) => {
        savedImages[k] = null;
        previews[k].src = "";
        previews[k].classList.add("d-none");
        statuses[k].textContent = "Aún no se guardaron los cambios de pintado en la imagen.";
        statuses[k].className = "text-muted small mt-2 status";
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "Error al enviar ❌",
        text: result.message || "Hubo un problema al enviar el formulario.",
      });
    }
  } catch (err) {
    console.error("Error al enviar:", err);
    Swal.fire({
      icon: "error",
      title: "Error de conexión",
      text: "No se pudo conectar con el servidor. Intenta nuevamente.",
    });
  }
});
