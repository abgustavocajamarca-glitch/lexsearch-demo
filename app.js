// Interfaz de LexSearch. Todo el contenido dinámico se inserta con nodos DOM / textContent
// (nunca innerHTML) para evitar XSS con datos de terceros.

const $ = (s, r = document) => r.querySelector(s);

// Versión estática (GitHub Pages): sin servidor; solo demostración con datos ficticios.
const ESTATICO = document.documentElement.dataset.estatico === 'true';

function h(tag, props = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'href') el.setAttribute('href', seguro(v));
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const hijo of hijos.flat()) {
    if (hijo == null || hijo === false) continue;
    el.append(hijo.nodeType ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

// Solo permitimos http(s) y mailto en enlaces.
const seguro = (url) => (/^(https?:|mailto:)/i.test(url) ? url : '#');

// ---- Simulación de la API para la versión estática de demostración ----
let datosEstaticos = null;
let sesionMemoria = false;
const sesionDemo = (v) => {
  try {
    if (v === undefined) return sessionStorage.getItem('lexsearch-demo') === '1';
    v ? sessionStorage.setItem('lexsearch-demo', '1') : sessionStorage.removeItem('lexsearch-demo');
  } catch {
    if (v === undefined) return sesionMemoria;
    sesionMemoria = v;
  }
};

async function apiEstatico(ruta, datos) {
  if (!datosEstaticos) datosEstaticos = await (await fetch('demo-data.json')).json();
  const d = datosEstaticos;
  switch (ruta) {
    case '/config':
      return d.config;
    case '/yo':
      return sesionDemo()
        ? { usuario: { nombre: 'Abg. Demostración', email: 'demo@lexsearch.local', matricula: 'DEMO-0000' }, demo: true, consultasHoy: 0, limiteDiario: d.config.limiteDiario }
        : { usuario: null };
    case '/demo/entrar':
      sesionDemo(true);
      return { ok: true };
    case '/logout':
      sesionDemo(false);
      return { ok: true };
    case '/historial':
      return { historial: [] };
    case '/consulta': {
      if (!sesionDemo()) throw Object.assign(new Error('Debes iniciar sesión.'), { status: 401 });
      if (!datos.finalidad) throw new Error('Selecciona la finalidad de la consulta.');
      if (datos.confirmaFinalidad !== true) throw new Error('Debes declarar que la consulta se realiza con una finalidad legítima.');
      await new Promise((r) => setTimeout(r, 700));
      const informe = structuredClone(d.informes[datos.tipo === 'nombre' ? 'nombre' : 'cedula']);
      Object.assign(informe.consulta, { finalidad: datos.finalidad, causa: datos.causa || null, fecha: new Date().toISOString() });
      return informe;
    }
    default:
      throw new Error('Esta es una versión de demostración: el registro y el acceso con cuenta real están disponibles en la versión completa.');
  }
}

async function api(ruta, datos) {
  if (ESTATICO) return apiEstatico(ruta, datos);
  const r = await fetch('/api' + ruta, {
    method: datos ? 'POST' : 'GET',
    headers: datos ? { 'Content-Type': 'application/json' } : undefined,
    body: datos ? JSON.stringify(datos) : undefined,
    credentials: 'same-origin',
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(cuerpo.error || 'Error de comunicación.'), { status: r.status });
  return cuerpo;
}

const mostrarError = (id, msg) => {
  const el = $(id);
  el.textContent = msg || '';
  el.classList.toggle('oculto', !msg);
};

let cfg = { publicidad: null, finalidades: [], demo: false };
let esDemo = false;

// ---------------- Arranque ----------------
async function iniciar() {
  cfg = await api('/config').catch(() => cfg);
  if (ESTATICO) prepararDemostracion();
  iniciarCuentas();
  pintarPublicidad();
  for (const id of ['#btn-demo', '#btn-demo-nav']) $(id).classList.toggle('oculto', !cfg.demo);
  $('#finalidad').replaceChildren(h('option', { value: '' }, 'Selecciona…'), ...cfg.finalidades.map((f) => h('option', { value: f }, f)));
  if (ESTATICO) adaptarPortadaEstatica();
  const yo = await api('/yo').catch(() => ({ usuario: null }));
  yo.usuario ? entrarApp(yo) : mostrarAcceso();
}

// ---- Diferenciación visual de la versión de demostración ----
function prepararDemostracion() {
  document.body.classList.add('estatico');
  $('#cinta-demo').classList.remove('oculto');
  if (cfg.realUrl) $('#cinta-real').setAttribute('href', seguro(cfg.realUrl));
  else $('#cinta-real').classList.add('oculto');
}

// ---- Contadores animados de la banda de cifras ----
function iniciarCuentas() {
  const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reducir) document.querySelectorAll('svg').forEach((s) => s.pauseAnimations?.());
  const nodos = document.querySelectorAll('[data-cuenta]');
  const animar = (el) => {
    const meta = Number(el.dataset.cuenta);
    if (reducir || !meta) return void (el.textContent = meta);
    const t0 = performance.now();
    const paso = (t) => {
      const k = Math.min((t - t0) / 1100, 1);
      el.textContent = Math.round(meta * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  };
  if (!('IntersectionObserver' in window)) return nodos.forEach(animar);
  const obs = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (animar(e.target), obs.unobserve(e.target))), { threshold: 0.6 });
  nodos.forEach((n) => obs.observe(n));
}

function adaptarPortadaEstatica() {
  const ins = $('.insignia');
  if (ins) ins.textContent = 'Versión de demostración · datos ficticios';
  const h1 = $('.hero-texto h1');
  if (h1) h1.insertAdjacentElement('beforebegin', h('p', { class: 'nota-demo' }, 'Estás viendo la demostración con datos inventados.'));
  $('#acceso').replaceChildren(
    h(
      'div',
      { class: 'acceso-estatico' },
      h('h2', {}, 'Explora la plataforma'),
      h('p', {}, 'Entra con una cuenta de demostración y recorre una consulta completa. Todos los datos son ficticios: no se consulta a ninguna persona real.'),
      h('button', { id: 'btn-demo-card', class: 'btn btn-primario btn-grande', type: 'button' }, 'Entrar a la demostración →'),
      h('p', { class: 'nota' }, 'El registro y el acceso con cuenta real están disponibles en la versión completa.'),
    ),
  );
}

function pintarPublicidad() {
  const p = cfg.publicidad;
  const cont = $('#publicidad');
  if (!p || !p.activo) return $('#publicidad-envoltura').classList.add('oculto');
  cont.replaceChildren(
    h('span', { class: 'patro' }, 'Patrocinador'),
    h('b', {}, p.titulo),
    h('span', {}, p.texto),
    p.enlace ? h('a', { href: p.enlace, target: '_blank', rel: 'noopener sponsored' }, p.textoEnlace || 'Más información') : null,
  );
  $('#publicidad-envoltura').classList.remove('oculto');
}

function mostrarAcceso() {
  $('#vista-acceso').classList.remove('oculto');
  $('#vista-app').classList.add('oculto');
  $('#sesion').classList.add('oculto');
  $('#nav-links').classList.remove('oculto');
  $('#nav-acciones').classList.remove('oculto');
}

function entrarApp(yo) {
  const primeraVez = !esDemo && yo.demo;
  esDemo = Boolean(yo.demo);
  document.body.classList.toggle('modo-demo', esDemo);
  $('#vista-acceso').classList.add('oculto');
  $('#vista-app').classList.remove('oculto');
  $('#nav-links').classList.add('oculto');
  $('#nav-acciones').classList.add('oculto');
  $('#sesion').classList.remove('oculto');
  $('#banner-demo').classList.toggle('oculto', !esDemo);
  $('#btn-crear-real').classList.toggle('oculto', ESTATICO);
  $('#sesion-nombre').textContent = yo.usuario.nombre;
  miRol = yo.rol || 'abogado';
  $('#sesion-nombre').dataset.email = yo.usuario.email;
  $('#btn-admin').classList.toggle('oculto', !['admin', 'superadmin'].includes(miRol));
  $('#sesion-cupo').textContent = esDemo ? 'DEMO' : `${yo.consultasHoy}/${yo.limiteDiario} consultas · 24 h`;
  if (primeraVez) {
    // Datos de ejemplo ya cargados para que se vea el flujo completo con un clic.
    $('#valor').value = '0999999999';
    $('#finalidad').selectedIndex = 1;
  }
  window.scrollTo({ top: 0 });
}

async function refrescarCupo() {
  const yo = await api('/yo').catch(() => null);
  if (yo?.usuario) entrarApp(yo);
}

// ---------------- Acceso ----------------
function pestana(modo) {
  if (!$('#form-login')) return;
  const login = modo === 'login';
  $('#form-login').classList.toggle('oculto', !login);
  $('#form-registro').classList.toggle('oculto', login);
  $('#tab-login').classList.toggle('activa', login);
  $('#tab-registro').classList.toggle('activa', !login);
}
$('#tab-login').addEventListener('click', () => pestana('login'));
$('#tab-registro').addEventListener('click', () => pestana('registro'));

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  mostrarError('#err-login');
  try {
    await api('/login', Object.fromEntries(new FormData(e.target)));
    entrarApp(await api('/yo'));
    e.target.reset();
  } catch (err) {
    mostrarError('#err-login', err.message);
  }
});

$('#form-registro').addEventListener('submit', async (e) => {
  e.preventDefault();
  mostrarError('#err-registro');
  const f = Object.fromEntries(new FormData(e.target));
  f.aceptaTerminos = e.target.aceptaTerminos.checked;
  try {
    const r = await api('/registro', f);
    if (r.pendiente) {
      mostrarError('#err-registro', 'Cuenta creada. Quedará habilitada cuando un administrador la apruebe.');
      $('#err-registro').classList.add('ok');
    } else {
      entrarApp(await api('/yo'));
    }
    e.target.reset();
  } catch (err) {
    mostrarError('#err-registro', err.message);
  }
});

async function entrarDemo() {
  // En producción la demostración vive en su propia URL.
  if (cfg.demoUrl) {
    window.location.href = cfg.demoUrl;
    return;
  }
  mostrarError('#err-demo');
  try {
    await api('/demo/entrar', {});
    entrarApp(await api('/yo'));
  } catch (err) {
    mostrarError('#err-demo', err.message);
  }
}
$('#btn-demo').addEventListener('click', entrarDemo);
document.addEventListener('click', (e) => {
  if (e.target.id === 'btn-demo-card') entrarDemo();
});
$('#btn-demo-nav').addEventListener('click', entrarDemo);

async function salir() {
  await api('/logout', {});
  esDemo = false;
  document.body.classList.remove('modo-demo');
  $('#valor').value = '';
  $('#resultado').replaceChildren();
  $('#resultado').classList.add('oculto');
  $('#panel-historial').classList.add('oculto');
  mostrarAcceso();
  window.scrollTo({ top: 0 });
}
$('#btn-salir').addEventListener('click', salir);
$('#btn-crear-real').addEventListener('click', async () => {
  await salir();
  pestana('registro');
  $('#acceso').scrollIntoView({ behavior: 'smooth' });
});

// ---------------- Consulta ----------------
$('#tipo').addEventListener('change', () => {
  const esCedula = $('#tipo').value === 'cedula';
  $('#etq-valor').textContent = esCedula ? 'Número de cédula o RUC' : 'Apellidos y nombres completos';
  $('#valor').placeholder = esCedula ? 'Ej.: 1700000000' : 'Ej.: PEREZ RAMOS JUAN ANDRES';
  $('#valor').inputMode = esCedula ? 'numeric' : 'text';
  $('#valor').value = '';
});

$('#form-consulta').addEventListener('submit', async (e) => {
  e.preventDefault();
  mostrarError('#err-consulta');
  const f = e.target;
  const datos = {
    tipo: $('#tipo').value,
    valor: f.valor.value,
    finalidad: f.finalidad.value,
    causa: f.causa.value,
    confirmaFinalidad: f.confirmaFinalidad.checked,
  };
  const btn = $('#btn-consultar');
  const estado = $('#estado');
  btn.disabled = true;
  estado.textContent = esDemo ? 'Generando informe de demostración…' : 'Consultando fuentes oficiales… puede tardar hasta un minuto.';
  estado.classList.remove('oculto');
  try {
    const r = await api('/consulta', datos);
    pintarInforme(r);
    refrescarCupo();
  } catch (err) {
    mostrarError('#err-consulta', err.message);
    if (err.status === 401) mostrarAcceso();
  } finally {
    btn.disabled = false;
    estado.classList.add('oculto');
  }
});

// ---------------- Informe ----------------
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-EC', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }) : '—');

function referencia() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const azar = [...crypto.getRandomValues(new Uint8Array(2))].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `LS-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${azar}`;
}

const cifra = (num, texto, tipo = '') => h('div', { class: 'cifra ' + tipo }, h('b', {}, num), h('span', {}, texto));
const tarjeta = (n, titulo, ...hijos) => h('section', { class: 'card' }, h('div', { class: 'card-cab' }, h('span', { class: 'marca-num' }, n), h('h2', {}, titulo)), ...hijos);
const par = (k, v) => h('div', {}, h('dt', {}, k), h('dd', {}, v || '—'));
const tabla = (cabeceras, filas, clase = '') =>
  h('div', { class: 'tabla-wrap' }, h('table', { class: clase }, h('thead', {}, h('tr', {}, cabeceras.map((t) => h('th', {}, t)))), h('tbody', {}, filas)));

function pintarInforme(r) {
  const { consulta, modulos } = r;
  const cont = $('#resultado');
  const objetivo = consulta.tipo === 'cedula' ? `Cédula / RUC ${consulta.valor}` : consulta.valor;
  const sri = modulos.sri?.ok && modulos.sri.datos?.tieneRuc ? modulos.sri.datos : null;
  const titular = sri?.razonSocial && consulta.tipo === 'cedula' ? sri.razonSocial : objetivo;

  const nodos = [];
  if (r.demo)
    nodos.push(h('div', { class: 'aviso' }, h('b', {}, 'Informe de demostración: '), 'la persona, los procesos y los números mostrados son ficticios y no corresponden a nadie real.'));

  nodos.push(
    h(
      'section',
      { class: 'card' },
      h('img', { class: 'solo-imprimir logo-informe', src: 'img/lexsearch-logo.webp', alt: 'LexSearch' }),
      h(
        'div',
        { class: 'inf-cab' },
        h(
          'div',
          {},
          h('div', { class: 'inf-id mono' }, `REFERENCIA ${referencia()}`),
          h('h2', { class: 'inf-titulo' }, 'Informe de información pública'),
          h('div', { class: 'inf-objetivo' }, titular),
          h(
            'dl',
            { class: 'inf-datos' },
            h('div', {}, h('dt', {}, 'Dato consultado'), h('dd', { class: 'mono' }, consulta.valor)),
            h('div', {}, h('dt', {}, 'Búsqueda'), h('dd', {}, consulta.tipo === 'cedula' ? 'Por cédula / RUC' : 'Por nombres y apellidos')),
            h('div', {}, h('dt', {}, 'Emitido'), h('dd', {}, new Date(consulta.fecha).toLocaleString('es-EC'))),
            consulta.causa ? h('div', {}, h('dt', {}, 'N.º de causa'), h('dd', { class: 'mono' }, consulta.causa)) : null,
          ),
          h('div', { class: 'fuentes-estado' }, Object.values(modulos).map((m) => h('span', {}, h('i', { class: 'punto' + (m.ok ? '' : ' mal') }), m.ok ? m.fuente.split(' – ')[0] : `${m.fuente.split(' – ')[0]} (sin respuesta)`))),
        ),
        h(
          'div',
          {},
          h('div', { class: 'declaracion' }, h('small', {}, 'Declaración de finalidad'), consulta.finalidad),
          h('div', { class: 'solo-imprimir meta-pequeno' }, `Elaborado por: ${$('#sesion-nombre').textContent}`),
          h('div', { class: 'cta-fila no-imprimir' }, h('button', { class: 'btn btn-ghost btn-chico', type: 'button', id: 'btn-imprimir' }, 'Imprimir / guardar PDF')),
        ),
      ),
    ),
  );

  nodos.push(tarjetaJudicial(modulos.judicial, consulta));
  nodos.push(tarjetaSri(modulos.sri));
  nodos.push(tarjetaFuentes(r.fuentesAsistidas));
  nodos.push(tarjetaOficios(r.informacionPorOficio));

  cont.replaceChildren(...nodos);
  cont.classList.remove('oculto');
  $('#btn-imprimir').addEventListener('click', () => window.print());
  cont.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const fallo = (m) =>
  h(
    'div',
    { class: 'aviso peligro' },
    `No se pudo consultar esta fuente ahora (${m.error}). Intenta nuevamente o consúltala directamente en el portal oficial. `,
    m.url ? h('a', { href: m.url, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir portal oficial →') : null,
  );

function tarjetaJudicial(m, consulta) {
  const sec = tarjeta('1', 'Procesos judiciales', h('p', { class: 'sub' }, `Fuente: ${m.fuente}.`));
  if (!m.ok) return sec.append(fallo(m)), sec;
  const { resumen: s, causas, nombresDistintos } = m.datos;
  const mas = (n) => (n >= s.tope ? '+' : '');

  sec.append(
    h(
      'div',
      { class: 'cifras' },
      cifra(s.totalEncontradas + (s.topeAlcanzado ? '+' : ''), 'Procesos'),
      cifra(s.comoDemandado + mas(s.comoDemandado), 'Como demandado', 'dem'),
      cifra(s.comoActor + mas(s.comoActor), 'Como actor', 'act'),
      cifra(s.alimentos, 'Alimentos', s.alimentos ? 'ali' : ''),
      cifra(s.penales, 'Penal / violencia'),
    ),
  );
  if (consulta.tipo === 'nombre')
    sec.append(
      h(
        'div',
        { class: 'aviso' },
        h('b', {}, 'Búsqueda por nombre: '),
        'pueden aparecer homónimos. Verifica la identidad con la cédula antes de usar estos datos.',
        nombresDistintos.length ? h('div', { class: 'partes' }, 'Nombres coincidentes: ' + nombresDistintos.join(' · ')) : null,
      ),
    );
  if (s.topeAlcanzado)
    sec.append(h('div', { class: 'aviso' }, `El servicio oficial entrega como máximo ${s.tope} resultados por rol; el total real es mayor y el listado podría no incluir los más recientes. Es probable que se trate de una persona jurídica, una institución o un nombre muy común: afina la búsqueda con la cédula.`));
  if (s.truncado)
    sec.append(h('div', { class: 'aviso' }, `Se muestran los ${s.mostradas} procesos más recientes de ${s.totalEncontradas}. Para el listado completo usa el portal oficial.`));
  if (!causas.length) return sec.append(h('p', {}, 'No se encontraron procesos judiciales públicos para este dato.')), sec;

  const filas = causas.map((c) =>
    h(
      'tr',
      {},
      h('td', { 'data-etq': 'Ingreso' }, fecha(c.fechaIngreso)),
      h('td', { 'data-etq': 'Proceso' }, h('span', { class: 'mono' }, c.proceso)),
      h(
        'td',
        { 'data-etq': 'Asunto' },
        h('b', {}, c.asunto || '—'),
        h('div', { class: 'partes' }, [c.materia, c.tipoAccion].filter(Boolean).join(' · ')),
        h('div', {}, c.alimentos ? h('span', { class: 'chip oro' }, 'Alimentos') : null, c.penal ? h('span', { class: 'chip' }, 'Penal') : null),
      ),
      h('td', { 'data-etq': 'Judicatura' }, [c.judicatura, c.ciudad].filter(Boolean).join(' — ') || '—'),
      h(
        'td',
        { 'data-etq': 'Rol y partes' },
        c.roles.map((r) => h('span', { class: 'chip ' + (r === 'DEMANDADO' ? 'demandado' : 'actor') }, r === 'DEMANDADO' ? 'Demandado' : 'Actor')),
        h('div', { class: 'partes' }, h('b', {}, 'Actor: '), (c.actores || []).join(', ') || '—'),
        h('div', { class: 'partes' }, h('b', {}, 'Demandado: '), (c.demandados || []).join(', ') || '—'),
      ),
    ),
  );
  sec.append(tabla(['Ingreso', 'Proceso', 'Asunto', 'Judicatura', 'Rol y partes'], filas, 'tabla-procesos'), h('p', { class: 'nota' }, 'Los procesos penales en investigación previa o con reserva no aparecen en la consulta pública.'));
  return sec;
}

function tarjetaSri(m) {
  const sec = tarjeta('2', 'RUC y actividad económica (SRI)', h('p', { class: 'sub' }, `Fuente: ${m.fuente}. Solo catastro público; no incluye facturación ni declaraciones (reserva tributaria).`));
  if (!m.ok) return sec.append(fallo(m)), sec;
  const d = m.datos;
  if (!d.disponible) return sec.append(h('div', { class: 'aviso' }, d.motivo)), sec;
  if (!d.tieneRuc) return sec.append(h('p', {}, d.mensaje)), sec;

  sec.append(
    h(
      'dl',
      { class: 'pares' },
      par('RUC', d.ruc),
      par('Razón social / nombre', d.razonSocial),
      par('Estado', d.estado),
      par('Actividad principal', d.actividadPrincipal),
      par('Tipo / régimen', [d.tipoContribuyente, d.regimen].filter(Boolean).join(' · ')),
      par('Obligado a llevar contabilidad', d.obligadoContabilidad),
      par('Inicio de actividades', d.fechaInicioActividades),
      par('Cese / reinicio', [d.fechaCese, d.fechaReinicio].filter(Boolean).join(' / ') || 'Sin registro'),
      par('Última actualización', d.fechaActualizacion),
    ),
  );
  if (d.establecimientos.length) {
    const MAX_ESTAB = 25;
    sec.append(
      h('h3', { class: 'sec-sub' }, `Establecimientos (${d.establecimientos.length})`),
      d.establecimientos.length > MAX_ESTAB ? h('p', { class: 'nota' }, `Se muestran los primeros ${MAX_ESTAB}. El listado completo está en el portal del SRI.`) : null,
      tabla(
        ['N.º', 'Nombre comercial', 'Dirección', 'Estado'],
        d.establecimientos.slice(0, MAX_ESTAB).map((e) =>
          h('tr', {}, h('td', {}, h('span', { class: 'mono' }, e.numero), e.matriz ? h('span', { class: 'chip oro' }, 'Matriz') : null), h('td', {}, e.nombre || '—'), h('td', {}, e.direccion || '—'), h('td', {}, h('span', { class: 'chip ' + (e.estado === 'ABIERTO' ? 'actor' : '') }, e.estado || '—'))),
        ),
      ),
    );
  }
  return sec;
}

function tarjetaFuentes(lista) {
  return tarjeta(
    '3',
    'Otras fuentes públicas (consulta directa)',
    h('p', { class: 'sub' }, 'Estas fuentes exigen verificación propia (captcha o sesión) o son cantonales. Consúltalas directamente con la cédula o el nombre del demandado.'),
    h(
      'div',
      { class: 'grid-fuentes' },
      lista.map((f) =>
        h('article', { class: 'fuente' }, h('h3', {}, f.nombre), h('p', {}, f.que), h('p', {}, h('b', {}, 'Cómo: '), f.como), h('p', {}, h('b', {}, 'Costo: '), f.costo), h('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir portal oficial →')),
      ),
    ),
  );
}

function tarjetaOficios(lista) {
  return h(
    'section',
    { class: 'reserva' },
    h('div', { class: 'reserva-cab' }, h('span', { class: 'candado', 'aria-hidden': 'true' }, '🔒'), h('h2', {}, '4. Información reservada: se obtiene por oficio del juez')),
    h('p', {}, 'Esta información no es pública y LexSearch no la consulta. Puedes solicitarla al juez dentro del proceso (por ejemplo, en la demanda o en diligencias preparatorias).'),
    tabla(['Entidad a oficiar', 'Dato', 'Fundamento'], lista.map((o) => h('tr', {}, h('td', {}, h('b', {}, o.entidad)), h('td', {}, o.dato), h('td', {}, o.base)))),
  );
}

// ---------------- Administración (administrador y superadministrador) ----------------
let miRol = 'abogado';
let adminTab = 'resumen';
let cacheUsuarios = [];

const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...hijos) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const hijo of hijos.flat()) if (hijo != null) el.append(hijo.nodeType ? hijo : document.createTextNode(String(hijo)));
  return el;
}

const dato2 = (num, texto, clase = '') => h('div', { class: 'cifra ' + clase }, h('b', {}, num), h('span', {}, texto));
const corto = (d) => String(d || '').slice(5, 10).split('-').reverse().join('/');

function graficoSemana(porDia) {
  const W = 700, H = 210, base = 170, ancho = 34;
  const max = Math.max(1, ...porDia.flatMap((d) => [d.consultas, d.registros]));
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafico', role: 'img', 'aria-label': 'Consultas y registros de los últimos 7 días' });
  g.append(svg('line', { x1: 0, y1: base, x2: W, y2: base, class: 'g-eje' }));
  porDia.forEach((d, i) => {
    const x = 30 + i * 96;
    const hc = Math.round((d.consultas / max) * 130);
    const hr = Math.round((d.registros / max) * 130);
    g.append(
      svg('rect', { x, y: base - hc, width: ancho, height: hc, rx: 4, class: 'g-barra-c' }),
      svg('rect', { x: x + ancho + 4, y: base - hr, width: ancho, height: hr, rx: 4, class: 'g-barra-r' }),
      svg('text', { x: x + ancho, y: base + 18, class: 'g-etq', 'text-anchor': 'middle' }, corto(d.dia)),
      d.consultas ? svg('text', { x: x + ancho / 2, y: base - hc - 6, class: 'g-num', 'text-anchor': 'middle' }, d.consultas) : null,
      d.registros ? svg('text', { x: x + ancho + 4 + ancho / 2, y: base - hr - 6, class: 'g-num', 'text-anchor': 'middle' }, d.registros) : null,
    );
  });
  return g;
}

async function pintarResumen(cont) {
  const r = await api('/admin/resumen');
  cont.replaceChildren(
    h('div', { class: 'cifras' },
      dato2(r.usuarios.total, 'Usuarios registrados'),
      dato2(r.usuarios.hoy, 'Registros hoy', r.usuarios.hoy ? 'act' : ''),
      dato2(r.usuarios.semana, 'Registros 7 días'),
      dato2(r.usuarios.activos7d, 'Activos 7 días'),
      dato2(r.consultas.hoy, 'Consultas hoy', 'ali'),
      dato2(r.consultas.total, 'Consultas totales'),
    ),
    ...(r.usuarios.suspendidos ? [h('div', { class: 'aviso' }, `${r.usuarios.suspendidos} cuenta(s) suspendida(s) o pendiente(s) de aprobación.`)] : []),
    h('h3', { class: 'sec-sub' }, 'Últimos 7 días'),
    h('div', { class: 'leyenda' }, h('span', {}, h('i', { class: 'sw sw-c' }), 'Consultas'), h('span', {}, h('i', { class: 'sw sw-r' }), 'Registros nuevos'), h('span', { class: 'nota' }, 'Fechas en UTC')),
    graficoSemana(r.porDia),
    h('h3', { class: 'sec-sub' }, 'Finalidades declaradas (7 días)'),
    r.finalidades.length
      ? tabla(['Finalidad', 'Consultas'], r.finalidades.map((f) => h('tr', {}, h('td', {}, f.finalidad), h('td', {}, h('b', {}, f.n)))))
      : h('p', { class: 'nota' }, 'Aún no hay consultas registradas.'),
  );
}

function filaUsuario(u) {
  const esSuper = u.rol === 'superadmin';
  const esAdm = u.rol === 'admin';
  const acciones = [];
  if (!esSuper && u.email !== $('#sesion-nombre').dataset.email) {
    acciones.push(h('button', { class: 'btn btn-ghost btn-chico', type: 'button', 'data-accion': u.aprobado ? 'suspender' : 'activar', 'data-email': u.email }, u.aprobado ? 'Suspender' : 'Activar'));
    if (miRol === 'superadmin') acciones.push(h('button', { class: 'btn btn-ghost btn-chico', type: 'button', 'data-accion': esAdm ? 'quitar-admin' : 'hacer-admin', 'data-email': u.email }, esAdm ? 'Quitar admin' : 'Hacer admin'));
  }
  return h(
    'tr',
    {},
    h('td', {}, h('b', {}, u.nombre), h('div', { class: 'partes' }, u.email)),
    h('td', {}, u.matricula ? h('span', { class: 'mono' }, u.matricula) : h('span', { class: 'nota' }, '—')),
    h('td', {}, h('span', { class: 'chip ' + (esSuper ? 'oro' : esAdm ? 'actor' : '') }, esSuper ? 'Superadmin' : esAdm ? 'Admin' : 'Abogado')),
    h('td', {}, h('span', { class: 'chip ' + (u.aprobado ? 'actor' : 'demandado') }, u.aprobado ? 'Activo' : 'Suspendido')),
    h('td', {}, h('span', { class: 'mono' }, String(u.creado_en || '').slice(0, 16))),
    h('td', {}, u.ultimo_acceso ? h('span', { class: 'mono' }, String(u.ultimo_acceso).slice(0, 16)) : h('span', { class: 'nota' }, 'Nunca')),
    h('td', {}, h('b', {}, u.consultas)),
    h('td', {}, acciones),
  );
}

function pintarTablaUsuarios(destino, filtro = '') {
  const f = filtro.trim().toLowerCase();
  const lista = cacheUsuarios.filter((u) => !f || `${u.nombre} ${u.email} ${u.matricula}`.toLowerCase().includes(f));
  destino.replaceChildren(
    lista.length
      ? tabla(['Usuario', 'Matrícula', 'Rol', 'Estado', 'Registro (UTC)', 'Últ. acceso (UTC)', 'Consultas', ''], lista.map(filaUsuario))
      : h('p', { class: 'nota' }, 'No hay usuarios que coincidan.'),
  );
}

function descargarCsv() {
  const celda = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const filas = [['Nombre', 'Correo', 'Matrícula', 'Rol', 'Estado', 'Registro (UTC)', 'Último acceso (UTC)', 'Consultas (recientes)']];
  for (const u of cacheUsuarios) filas.push([u.nombre, u.email, u.matricula, u.rol, u.aprobado ? 'Activo' : 'Suspendido', u.creado_en, u.ultimo_acceso, u.consultas]);
  const blob = new Blob(['﻿' + filas.map((f) => f.map(celda).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `lexsearch-usuarios-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
}

async function pintarUsuarios(cont) {
  cacheUsuarios = (await api('/admin/usuarios')).usuarios;
  const destino = h('div', { class: 'tabla-wrap', id: 'tabla-usuarios' });
  const buscador = h('input', { type: 'search', id: 'buscar-usuario', placeholder: 'Buscar por nombre, correo o matrícula…', autocomplete: 'off' });
  buscador.addEventListener('input', () => pintarTablaUsuarios(destino, buscador.value));
  const csv = h('button', { class: 'btn btn-ghost btn-chico', type: 'button' }, 'Descargar CSV');
  csv.addEventListener('click', descargarCsv);
  cont.replaceChildren(h('div', { class: 'admin-barra' }, buscador, csv, h('span', { class: 'nota' }, `${cacheUsuarios.length} usuario(s). Las consultas corresponden a la actividad reciente.`)), destino);
  pintarTablaUsuarios(destino);
}

async function pintarAuditoria(cont) {
  const { consultas } = await api('/admin/auditoria');
  cont.replaceChildren(
    h('p', { class: 'nota' }, 'Últimas 200 consultas. El dato consultado se muestra enmascarado.'),
    consultas.length
      ? tabla(
          ['Fecha (UTC)', 'Usuario', 'Búsqueda', 'Dato', 'Finalidad', 'Causa'],
          consultas.map((c) =>
            h('tr', {}, h('td', {}, h('span', { class: 'mono' }, String(c.fecha).slice(0, 19))), h('td', {}, h('b', {}, c.usuario_nombre || '—'), h('div', { class: 'partes' }, c.usuario_email || '')), h('td', {}, c.tipo), h('td', {}, h('span', { class: 'mono' }, c.mascara)), h('td', {}, c.finalidad), h('td', {}, c.causa || '—')),
          ),
        )
      : h('p', {}, 'Aún no hay consultas registradas.'),
  );
}

async function cargarAdmin(tab = adminTab) {
  adminTab = tab;
  document.querySelectorAll('#panel-admin [data-tab]').forEach((b) => b.classList.toggle('activa', b.dataset.tab === tab));
  const cont = $('#admin-contenido');
  cont.replaceChildren(h('p', { class: 'nota' }, 'Cargando…'));
  try {
    await { resumen: pintarResumen, usuarios: pintarUsuarios, auditoria: pintarAuditoria }[tab](cont);
  } catch (err) {
    cont.replaceChildren(h('div', { class: 'aviso peligro' }, err.message));
  }
}

$('#btn-admin').addEventListener('click', async () => {
  const panel = $('#panel-admin');
  if (!panel.classList.contains('oculto')) return panel.classList.add('oculto');
  panel.classList.remove('oculto');
  panel.scrollIntoView({ behavior: 'smooth' });
  await cargarAdmin('resumen');
});

$('#panel-admin').addEventListener('click', async (e) => {
  const tab = e.target.dataset?.tab;
  if (tab) return cargarAdmin(tab);
  const { accion, email } = e.target.dataset || {};
  if (!accion) return;
  const textos = { suspender: 'suspender', activar: 'activar', 'hacer-admin': 'convertir en administrador a', 'quitar-admin': 'quitar el rol de administrador a' };
  if (!window.confirm(`¿Seguro que quieres ${textos[accion]} ${email}?`)) return;
  e.target.disabled = true;
  try {
    await api('/admin/usuario', { email, accion });
    await cargarAdmin('usuarios');
  } catch (err) {
    mostrarError('#err-consulta', err.message);
    e.target.disabled = false;
  }
});

// ---------------- Historial ----------------
$('#btn-historial').addEventListener('click', async () => {
  const panel = $('#panel-historial');
  if (!panel.classList.contains('oculto')) return panel.classList.add('oculto');
  try {
    const { historial } = await api('/historial');
    $('#tabla-historial').replaceChildren(
      historial.length
        ? tabla(['Fecha (UTC)', 'Búsqueda', 'Dato', 'Finalidad', 'Causa'], historial.map((x) => h('tr', {}, h('td', {}, h('span', { class: 'mono' }, x.fecha)), h('td', {}, x.tipo), h('td', {}, h('span', { class: 'mono' }, x.mascara)), h('td', {}, x.finalidad), h('td', {}, x.causa || '—'))))
        : h('p', {}, 'Aún no has realizado consultas.'),
    );
    panel.classList.remove('oculto');
    panel.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    mostrarError('#err-consulta', err.message);
  }
});

iniciar();
