let albumActualId = null;
let usuarioActual = JSON.parse(localStorage.getItem('usuarioFiguritas')) || null;

const listaAlbums = document.getElementById('lista-albums');
const gridFiguritas = document.getElementById('grid-figuritas');
const tituloAlbum = document.getElementById('titulo-album');
const descAlbum = document.getElementById('desc-album');
const formFigurita = document.getElementById('form-figurita');
const progressWrapper = document.getElementById('progress-wrapper');
const progressText = document.getElementById('progress-text');
const progressPercent = document.getElementById('progress-percent');
const progressBar = document.getElementById('progress-bar');

// --- GESTIÓN DE TEMA CLARO / OSCURO ---
function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema);
  localStorage.setItem('autovault_theme', tema);
  const icon = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');
  if (tema === 'light') {
    icon.textContent = '';
    label.textContent = 'Modo Oscuro';
  } else {
    icon.textContent = '';
    label.textContent = 'Modo Claro';
  }
}

function toggleTheme() {
  const actual = document.documentElement.getAttribute('data-theme');
  aplicarTema(actual === 'dark' ? 'light' : 'dark');
}

aplicarTema(localStorage.getItem('autovault_theme') || 'dark');

// --- GESTIÓN DE USUARIO CON CONTRASEÑA ---
function actualizarUIUsuario() {
  const guestPanel = document.getElementById('guest-panel');
  const userPanel = document.getElementById('user-panel');
  const displayUsername = document.getElementById('display-username');

  if (usuarioActual) {
    guestPanel.classList.add('hidden');
    userPanel.classList.remove('hidden');
    displayUsername.textContent = usuarioActual.username;
  } else {
    guestPanel.classList.remove('hidden');
    userPanel.classList.add('hidden');
  }
}

async function iniciarSesion() {
  const userInput = document.getElementById('login-username');
  const passInput = document.getElementById('login-password');
  const errorLabel = document.getElementById('auth-error');

  const username = userInput.value.trim();
  const password = passInput.value.trim();
  errorLabel.textContent = '';

  if (!username || !password) {
    errorLabel.textContent = 'Falta usuario o clave';
    return;
  }

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (!res.ok) {
    errorLabel.textContent = data.error || 'Error al ingresar';
    return;
  }

  usuarioActual = data;
  localStorage.setItem('usuarioFiguritas', JSON.stringify(usuarioActual));
  userInput.value = '';
  passInput.value = '';
  albumActualId = null;
  actualizarUIUsuario();
  cargarAlbums();
}

function cerrarSesion() {
  usuarioActual = null;
  localStorage.removeItem('usuarioFiguritas');
  albumActualId = null;
  actualizarUIUsuario();
  cargarAlbums();
}

// --- ÁLBUMES Y FIGURITAS ---
async function cargarAlbums() {
  const url = usuarioActual ? `/api/albums?usuario_id=${usuarioActual.id}` : '/api/albums';
  const res = await fetch(url);
  const albums = await res.json();
  listaAlbums.innerHTML = '';

  if (albums.length === 0) {
    albumActualId = null;
    tituloAlbum.textContent = 'No hay álbumes';
    descAlbum.textContent = 'Creá tu primer álbum desde el panel izquierdo.';
    gridFiguritas.innerHTML = '';
    formFigurita.classList.add('hidden');
    progressWrapper.classList.add('hidden');
    return;
  }

  albums.forEach((album, index) => {
    const li = document.createElement('li');
    if (album.id === albumActualId) li.classList.add('active');

    const etiqueta = album.usuario_id ? '<span class="badge-mio">MÍO</span>' : '';
    li.innerHTML = `
      <span>${album.nombre}</span>
      <div class="album-item-actions">
        ${etiqueta}
        <button class="btn-delete-sm" title="Eliminar álbum" onclick="eliminarAlbum(event, ${album.id}, '${album.nombre.replace(/'/g, "\\'")}')">🗑️</button>
      </div>
    `;
    li.onclick = () => seleccionarAlbum(album, li);
    listaAlbums.appendChild(li);

    if (index === 0 && !albumActualId) {
      seleccionarAlbum(album, li);
    }
  });
}

async function seleccionarAlbum(album, elementoLi) {
  albumActualId = album.id;
  document.querySelectorAll('#lista-albums li').forEach(el => el.classList.remove('active'));
  if (elementoLi) elementoLi.classList.add('active');

  tituloAlbum.textContent = album.nombre;
  descAlbum.textContent = album.descripcion || 'Colección personalizada de vehículos';
  formFigurita.classList.remove('hidden');

  cargarFiguritas(album.id);
}

async function eliminarAlbum(event, id, nombre) {
  event.stopPropagation(); // Evita que se seleccione el álbum al hacer clic en borrar
  if (!confirm(`¿Seguro que querés eliminar el álbum "${nombre}" y todas sus figuritas?`)) return;

  await fetch(`/api/albums/${id}`, { method: 'DELETE' });

  if (albumActualId === id) {
    albumActualId = null;
  }
  cargarAlbums();
}

async function cargarFiguritas(albumId) {
  const res = await fetch(`/api/albums/${albumId}/figuritas`);
  const figuritas = await res.json();
  gridFiguritas.innerHTML = '';

  progressWrapper.classList.remove('hidden');
  const total = figuritas.length;
  const pegadas = figuritas.filter(f => f.pegada === 1).length;
  const porcentaje = total > 0 ? Math.round((pegadas / total) * 100) : 0;

  progressPercent.textContent = `${porcentaje}%`;
  progressText.textContent = `${pegadas} de ${total} figuritas pegadas`;
  progressBar.style.width = `${porcentaje}%`;

  if (total === 0) {
    gridFiguritas.innerHTML = `
      <div class="empty-state">
        <p>Este álbum todavía no tiene figuritas. Usá el formulario inferior para sumar la primera.</p>
      </div>`;
    return;
  }

  const imagenRespaldo = 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=400';

  figuritas.forEach((fig, idx) => {
    const numero = String(idx + 1).padStart(3, '0');
    const div = document.createElement('div');
    div.className = `figurita ${fig.pegada ? 'pegada' : ''}`;
    div.innerHTML = `
      <div class="sticker-media">
        <img src="${fig.imagen}" alt="${fig.nombre}" onerror="this.onerror=null; this.src='${imagenRespaldo}';">
        <span class="sticker-num">#${numero}</span>
        ${fig.pegada ? '<span class="sticker-status">Coleccionada</span>' : ''}
      </div>
      <div class="sticker-content">
        <h4>${fig.nombre}</h4>
        <div class="sticker-actions">
          <button class="btn-pegado" onclick="toggleFigurita(${fig.id})">
            ${fig.pegada ? '✓ En el álbum' : '+ Pegar figurita'}
          </button>
          <button class="btn-delete-fig" title="Eliminar figurita" onclick="eliminarFigurita(${fig.id}, '${fig.nombre.replace(/'/g, "\\'")}')">🗑️</button>
        </div>
      </div>
    `;
    gridFiguritas.appendChild(div);
  });
}

async function toggleFigurita(id) {
  await fetch(`/api/figuritas/${id}/toggle`, { method: 'PUT' });
  cargarFiguritas(albumActualId);
}

async function eliminarFigurita(id, nombre) {
  if (!confirm(`¿Eliminar la figurita "${nombre}"?`)) return;

  await fetch(`/api/figuritas/${id}`, { method: 'DELETE' });
  cargarFiguritas(albumActualId);
}

document.getElementById('form-album').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('album-nombre').value.trim();
  const descripcion = document.getElementById('album-desc').value.trim();

  await fetch('/api/albums', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre,
      descripcion,
      usuario_id: usuarioActual ? usuarioActual.id : null
    })
  });

  e.target.reset();
  cargarAlbums();
});

formFigurita.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('fig-nombre').value.trim();
  const imagen = document.getElementById('fig-imagen').value.trim();

  await fetch(`/api/albums/${albumActualId}/figuritas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, imagen })
  });

  e.target.reset();
  cargarFiguritas(albumActualId);
});

actualizarUIUsuario();
cargarAlbums();