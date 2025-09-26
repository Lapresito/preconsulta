const canvas = document.getElementById('bodyChart');
const ctx = canvas.getContext('2d');
const generoRadios = document.querySelectorAll('input[name="genero"]');

let background = new Image();
let painting = false;

// Cargar imagen inicial
loadBackground('./images/male1.jpg');

function loadBackground(src) {
  background.src = src;
  background.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
  };
}

// Cambiar imagen según género
generoRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      const imgSrc = radio.value === 'hombre' ? './images/male1.jpg' : './images/woman.jpg';
      loadBackground(imgSrc);
    }
  });
});

// Dibujo en canvas
function startPosition(e) {
  painting = true;
  draw(e);
}
function endPosition() {
  painting = false;
  ctx.beginPath();
}

function draw(e) {
  if (!painting) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Pincel en azul suave con baja opacidad
  let gradient = ctx.createRadialGradient(x, y, 0, x, y, 25);
  gradient.addColorStop(0, "rgba(0, 0, 255, 0.08)"); // centro azul muy claro
  gradient.addColorStop(1, "rgba(0, 0, 255, 0)");   // se desvanece afuera

  ctx.fillStyle = gradient;
  ctx.fillRect(x - 25, y - 25, 50, 50);
}



canvas.addEventListener("mousedown", startPosition);
canvas.addEventListener("mouseup", endPosition);
canvas.addEventListener("mousemove", draw);

// Botón borrar
document.getElementById("clearCanvas").addEventListener("click", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
});

// Botón guardar
document.getElementById("saveCanvas").addEventListener("click", () => {
  const dataURL = canvas.toDataURL("image/png");
  document.getElementById("savedImage").src = dataURL;
});

// Mostrar campo "otro" en enfermedades
document.getElementById("enfermedades").addEventListener("change", (e) => {
  const otraInput = document.getElementById("otraEnfermedad");
  if (e.target.value === "Otro") {
    otraInput.classList.remove("d-none");
  } else {
    otraInput.classList.add("d-none");
    otraInput.value = "";
  }
});

// Mostrar campo "otro" en implantes
document.querySelectorAll('input[name="implante"]').forEach(radio => {
  radio.addEventListener("change", () => {
    const otroImplante = document.getElementById("otroImplante");
    if (document.getElementById("implanteOtro").checked) {
      otroImplante.classList.remove("d-none");
    } else {
      otroImplante.classList.add("d-none");
      otroImplante.value = "";
    }
  });
});
