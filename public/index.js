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

const viewOrder = ["front", "back", "sideLeft", "sideRight"];

// --------------------- Escala de dolor ---------------------
const escalaSlider = document.getElementById("escalaDolor");
const dolorValor   = document.getElementById("dolorValor");
escalaSlider.addEventListener("input", () => {
  dolorValor.textContent = escalaSlider.value;
});

// --------------------- Edad y validaciones ---------------------
const fechaInput = document.getElementById("fechaNacimiento");
const edadSmall = document.getElementById("edad");
fechaInput.addEventListener("change", () => {
  const val = fechaInput.value;
  if (!val) return (edadSmall.textContent = "");
  const hoy = new Date();
  const nacimiento = new Date(val);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  edadSmall.textContent = `${edad} años`;
});

const telefonoInput = document.getElementById("telefono");
telefonoInput.addEventListener("input", () => {
  telefonoInput.value = telefonoInput.value.replace(/\D/g, "");
});

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
enfOtroCheckbox.addEventListener("change", () =>
  toggleOtroInput(enfOtroCheckbox, otraEnfInput)
);
implOtro.addEventListener("change", () =>
  toggleOtroInput(implOtro, otroImplante)
);

document.getElementById("preConsultaForm").addEventListener("reset", () => {
  [otraEnfInput, otroImplante].forEach((input) => {
    input.classList.add("d-none");
    input.value = "";
    input.required = false;
  });
});

//--------------------- Lógica BODY CHART ---------------------
const generoRadios = document.querySelectorAll('input[name="genero"]');
const canvases = {
  front: document.getElementById("canvas-front"),
  back: document.getElementById("canvas-back"),
  sideLeft: document.getElementById("canvas-sideLeft"),
  sideRight: document.getElementById("canvas-sideRight"),
};
const ctxs = {};
const backgrounds = {};
const hasChanges = { front: false, back: false, sideLeft: false, sideRight: false };
let currentGender = "hombre";

Object.keys(canvases).forEach((v) => {
  ctxs[v] = canvases[v].getContext("2d");
  backgrounds[v] = new Image();
});

function loadAllBackgrounds(gender) {
  const map = imageMap[gender];
  Object.keys(map).forEach((view) => {
    const bg = backgrounds[view];
    const c = canvases[view];
    const ctx = ctxs[view];
    bg.src = map[view];
    bg.onload = () => {
      c.width = bg.naturalWidth || 800;
      c.height = bg.naturalHeight || 1200;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(bg, 0, 0, c.width, c.height);
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

// --- Color picker ---
let brushColor = "blue";
document.querySelectorAll(".color-dot").forEach((dot) => {
  dot.addEventListener("click", () => {
    brushColor = dot.dataset.color;
    document.querySelectorAll(".color-dot").forEach((d) => d.classList.remove("selected"));
    dot.classList.add("selected");
  });
});

// --- Drawer ---
function makeDrawer(view) {
  const c = canvases[view];
  const ctx = ctxs[view];
  let painting = false;
  let lastDrawPos = null;
  const brushRadius = 15;
  const minDist = brushRadius * 0.5; // evita acumulación por círculos demasiado juntos

  function getPos(e) {
    const rect = c.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0].clientY) - rect.top;
    return { x: x * (c.width / rect.width), y: y * (c.height / rect.height) };
  }

  function start(e) { painting = true; lastDrawPos = null; draw(e); }
  function stop()   { painting = false; lastDrawPos = null; ctx.beginPath(); }

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

    hasChanges[view] = true;
  }

  ["mousedown", "touchstart"].forEach((ev) => c.addEventListener(ev, (e) => { e.preventDefault(); start(e); }));
  ["mouseup", "mouseleave", "touchend"].forEach((ev) => c.addEventListener(ev, (e) => { e.preventDefault(); stop(); }));
  ["mousemove", "touchmove"].forEach((ev) => c.addEventListener(ev, (e) => { e.preventDefault(); draw(e); }));

  document.querySelector(`.btn-clear[data-target="${view}"]`).addEventListener("click", () => {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(backgrounds[view], 0, 0, c.width, c.height);
    hasChanges[view] = false;
  });
}
Object.keys(canvases).forEach(makeDrawer);

// --------------------- Mobile nav del body chart ---------------------
const mobileNav = document.getElementById("mobileNav");
const mobileViewLabel = document.getElementById("mobileViewLabel");
const chartCards = document.querySelectorAll(".chart-card");
const viewLabels = { front: "Frente", back: "Espalda", sideLeft: "Lado izquierdo", sideRight: "Lado derecho" };
let currentViewIdx = 0;

function isMobile() { return window.innerWidth <= 768; }

function updateMobileNav() {
  if (!isMobile()) {
    mobileNav.classList.add("d-none");
    chartCards.forEach((card) => (card.style.display = ""));
    return;
  }
  mobileNav.classList.remove("d-none");
  chartCards.forEach((card, i) => { card.style.display = i === currentViewIdx ? "" : "none"; });
  mobileViewLabel.innerHTML = `${viewLabels[viewOrder[currentViewIdx]]}<br><small>${currentViewIdx + 1} de ${viewOrder.length}</small>`;
}

document.getElementById("prevView").addEventListener("click", () => {
  currentViewIdx = (currentViewIdx - 1 + viewOrder.length) % viewOrder.length;
  updateMobileNav();
});
document.getElementById("nextView").addEventListener("click", () => {
  currentViewIdx = (currentViewIdx + 1) % viewOrder.length;
  updateMobileNav();
});

updateMobileNav();
window.addEventListener("resize", updateMobileNav);

// --------------------- Envío del formulario ---------------------
document.getElementById("preConsultaForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  Swal.fire({
    title: "Enviando formulario...",
    text: "Por favor, espera un momento.",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  const gender = document.querySelector('input[name="genero"]:checked')?.value || "hombre";
  const prefix = gender === "mujer" ? "woman" : "male";

  Object.keys(canvases).forEach((view) => {
    if (hasChanges[view]) {
      const dataURL = canvases[view].toDataURL("image/png");
      const suffix =
        view === "sideLeft"
          ? "Side"
          : view === "sideRight"
          ? "SideRight"
          : view.charAt(0).toUpperCase() + view.slice(1);
      formData.append(`${prefix}${suffix}`, dataURL);
    }
  });

  try {
    const res = await fetch("/api/preconsulta", { method: "POST", body: formData });
    const result = await res.json();

    if (res.ok) {
      Swal.fire({
        icon: "success",
        title: "Formulario enviado ✅",
        text: result.message || "Gracias, tu preconsulta fue enviada correctamente.",
        timer: 2500,
        showConfirmButton: false,
      });
      form.reset();
      loadAllBackgrounds(currentGender);
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
