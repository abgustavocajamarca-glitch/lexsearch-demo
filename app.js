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
  pintarPublicidad();
  for (const id of ['#btn-demo', '#btn-demo-nav']) $(id).classList.toggle('oculto', !cfg.demo);
  $('#finalidad').replaceChildren(h('option', { value: '' }, 'Selecciona…'), ...cfg.finalidades.map((f) => h('option', { value: f }, f)));
  if (ESTATICO) adaptarPortadaEstatica();
  const yo = await api('/yo').catch(() => ({ usuario: null }));
  yo.usuario ? entrarApp(yo) : mostrarAcceso();
}

function adaptarPortadaEstatica() {
  const ins = $('.insignia');
  if (ins) ins.textContent = 'Versión de demostración · datos ficticios';
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
    if (r.pendiente) mostrarError('#err-registro', 'Cuenta creada. Quedará habilitada cuando validemos tu matrícula.');
    else entrarApp(await api('/yo'));
    e.target.reset();
  } catch (err) {
    mostrarError('#err-registro', err.message);
  }
});

async function entrarDemo() {
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

const fallo = (m) => h('div', { class: 'aviso peligro' }, `No se pudo consultar esta fuente ahora: ${m.error}. Intenta nuevamente o consulta directamente el portal oficial.`);

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
    sec.append(
      h('h3', { class: 'sec-sub' }, `Establecimientos (${d.establecimientos.length})`),
      tabla(
        ['N.º', 'Nombre comercial', 'Dirección', 'Estado'],
        d.establecimientos.map((e) =>
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
