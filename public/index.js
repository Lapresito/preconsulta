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

// --------------------- Google Places Autocomplete ---------------------
window.initAutocomplete = function () {
  const input = document.getElementById("residencia");
  if (!window.google?.maps?.places) return console.warn("Google Places no está disponible.");
  const autocomplete = new google.maps.places.Autocomplete(input, {
    componentRestrictions: { country: "uy" },
    fields: ["formatted_address", "address_components", "geometry", "name"],
    types: ["(regions)"],
  });
  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    console.log("Lugar seleccionado:", place.formatted_address || place.name);
  });
};

// --------------------- Lógica BODY CHART ---------------------
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
      currentGender = radio.value === "mujer" ? "mujer" : "hombre";
      loadAllBackgrounds(currentGender);
    }
  })
);

// ===== COLOR PICKER (ÚNICO Y CORRECTO) =====
let brushColor = "blue"; // inicial

document.querySelectorAll(".color-dot").forEach(dot => {
  dot.addEventListener("click", () => {
    brushColor = dot.dataset.color;

    document.querySelectorAll(".color-dot").forEach(d => d.classList.remove("selected"));
    dot.classList.add("selected");
  });
});

document.querySelector('.color-dot[data-color="blue"]').classList.add("selected");

// --------------------- Drawer ---------------------
function makeDrawer(view) {
  const c = canvases[view];
  const ctx = ctxs[view];
  let painting = false;

  function getPos(e) {
    const rect = c.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0].clientY) - rect.top;
    return {
      x: x * (c.width / rect.width),
      y: y * (c.height / rect.height),
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
    const brushSize = 15;

    const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 30);

    if (brushColor === "blue") {
      grad.addColorStop(0, "rgba(0, 100, 255, 0.12)");
      grad.addColorStop(1, "rgba(0, 100, 255, 0)");
    } else {
      grad.addColorStop(0, "rgba(120, 0, 200, 0.12)");
      grad.addColorStop(1, "rgba(120, 0, 200, 0)");
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize, 0, Math.PI * 2);
    ctx.fill();
    hasChanges[view] = true;
  }

  ["mousedown", "touchstart"].forEach((ev) =>
    c.addEventListener(ev, (e) => {
      e.preventDefault();
      start(e);
    })
  );
  ["mouseup", "mouseleave", "touchend"].forEach((ev) =>
    c.addEventListener(ev, (e) => {
      e.preventDefault();
      stop(e);
    })
  );
  ["mousemove", "touchmove"].forEach((ev) =>
    c.addEventListener(ev, (e) => {
      e.preventDefault();
      draw(e);
    })
  );

  const clearBtn = document.querySelector(`.btn-clear[data-target="${view}"]`);
  clearBtn.addEventListener("click", () => {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(backgrounds[view], 0, 0, c.width, c.height);
    hasChanges[view] = false;
  });
}
Object.keys(canvases).forEach(makeDrawer);

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
