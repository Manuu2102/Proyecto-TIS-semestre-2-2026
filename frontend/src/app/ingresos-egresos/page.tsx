'use client'
import { useRef, useState } from 'react'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { Modal } from '../../../components/Modal'
import { PlusIcon, WalletIcon, CheckIcon, FileIcon } from '../../../components/Icons'

type Tipo = 'Ingreso' | 'Gasto'
type Metodo = 'Efectivo' | 'Transferencia' | 'Depósito'
type Categoria = {
  id: number
  nombre: string
  tipo: Tipo
  descripcion: string
  activa: boolean
  predeterminada: boolean
}
type Cuenta = { id: number; banco: string; numero: string; saldo: number }
type Comprobante = { id: number; nombre: string; tamano: number; url: string | null }
type Movimiento = {
  id: number
  fecha: string // "2026-10-06"
  tipo: Tipo
  categoriaId: number
  monto: number
  descripcion: string
  contraparte: string // proveedor o beneficiario (gastos)
  metodo: Metodo
  cuentaId: number | null
  estado: 'Vigente' | 'Anulado'
  comprobantes: Comprobante[]
  creadoPor: string
  creadoEn: string
  anulacion?: { motivo: string; usuario: string; fecha: string }
}
type CambioCategoria = {
  id: number
  fecha: string
  usuario: string
  accion: string
  categoria: string
  anterior: string
  nuevo: string
}
type Saldos = { caja: number; cuentas: Cuenta[] }
type Form = {
  fecha: string
  monto: string
  categoriaId: string
  descripcion: string
  contraparte: string
  metodo: Metodo
  cuentaId: string
  archivos: Comprobante[]
}
type Errores = { fecha?: string; monto?: string; categoria?: string; cuenta?: string }

const METODOS: Metodo[] = ['Efectivo', 'Transferencia', 'Depósito']
const MAX_BYTES = 5 * 1024 * 1024
const EXT_OK = ['pdf', 'jpg', 'jpeg', 'png']

// =====================================================================
// DATOS DE EJEMPLO (los reemplaza backend)
// =====================================================================

// BACKEND: GET /categorias
const CATEGORIAS_INICIALES: Categoria[] = [
  {
    id: 1,
    nombre: 'Donación',
    tipo: 'Ingreso',
    descripcion: 'Aportes voluntarios al edificio',
    activa: true,
    predeterminada: true
  },
  {
    id: 2,
    nombre: 'Multa',
    tipo: 'Ingreso',
    descripcion: 'Multas a copropietarios',
    activa: true,
    predeterminada: true
  },
  {
    id: 3,
    nombre: 'Alquiler de áreas comunes',
    tipo: 'Ingreso',
    descripcion: '',
    activa: true,
    predeterminada: true
  },
  {
    id: 4,
    nombre: 'Otro ingreso',
    tipo: 'Ingreso',
    descripcion: '',
    activa: true,
    predeterminada: true
  },
  {
    id: 5,
    nombre: 'Intereses bancarios',
    tipo: 'Ingreso',
    descripcion: '',
    activa: false,
    predeterminada: true
  },
  {
    id: 6,
    nombre: 'Mantenimiento',
    tipo: 'Gasto',
    descripcion: 'Reparaciones y mantenimiento',
    activa: true,
    predeterminada: true
  },
  {
    id: 7,
    nombre: 'Servicios básicos',
    tipo: 'Gasto',
    descripcion: 'Luz, agua, gas',
    activa: true,
    predeterminada: true
  },
  { id: 8, nombre: 'Limpieza', tipo: 'Gasto', descripcion: '', activa: true, predeterminada: true },
  {
    id: 9,
    nombre: 'Seguridad',
    tipo: 'Gasto',
    descripcion: '',
    activa: true,
    predeterminada: true
  },
  {
    id: 10,
    nombre: 'Otro gasto',
    tipo: 'Gasto',
    descripcion: '',
    activa: true,
    predeterminada: true
  }
]

// BACKEND: GET /auditoria?entidad=categoria
const CAMBIOS_INICIALES: CambioCategoria[] = [
  {
    id: 1,
    fecha: '05/08/2026 09:00',
    usuario: 'Administrador',
    accion: 'Editada',
    categoria: 'Limpieza',
    anterior: 'Limpieza general',
    nuevo: 'Limpieza'
  }
]

// BACKEND: GET /cuentas-bancarias (solo activas)
const CUENTAS_INICIALES: Cuenta[] = [
  { id: 1, banco: 'Banco Nacional de Bolivia', numero: '1000-123456', saldo: 15000 },
  { id: 2, banco: 'Banco Mercantil Santa Cruz', numero: '4020-998877', saldo: 5200 }
]

// BACKEND: GET /caja/saldo
const SALDO_CAJA_INICIAL = 3120

// BACKEND: GET /movimientos-financieros (listado unificado)
const MOVIMIENTOS_INICIALES: Movimiento[] = [
  {
    id: 1,
    fecha: '2026-08-12',
    tipo: 'Gasto',
    categoriaId: 6,
    monto: 1200,
    descripcion: 'Reparación de ascensor',
    contraparte: 'Ascensores Andinos S.R.L.',
    metodo: 'Transferencia',
    cuentaId: 1,
    estado: 'Vigente',
    comprobantes: [{ id: 1, nombre: 'factura-ascensor.pdf', tamano: 182400, url: null }],
    creadoPor: 'Administrador',
    creadoEn: '12/08/2026 10:15'
  },
  {
    id: 2,
    fecha: '2026-08-20',
    tipo: 'Ingreso',
    categoriaId: 3,
    monto: 300,
    descripcion: 'Alquiler del salón de eventos',
    contraparte: '',
    metodo: 'Efectivo',
    cuentaId: null,
    estado: 'Vigente',
    comprobantes: [],
    creadoPor: 'Administrador',
    creadoEn: '20/08/2026 17:40'
  },
  {
    id: 3,
    fecha: '2026-09-05',
    tipo: 'Gasto',
    categoriaId: 7,
    monto: 620,
    descripcion: 'Electricidad de áreas comunes',
    contraparte: 'Empresa de Luz',
    metodo: 'Transferencia',
    cuentaId: 1,
    estado: 'Vigente',
    comprobantes: [{ id: 2, nombre: 'recibo-luz.jpg', tamano: 95300, url: null }],
    creadoPor: 'Administrador',
    creadoEn: '05/09/2026 11:02'
  },
  {
    id: 4,
    fecha: '2026-09-10',
    tipo: 'Gasto',
    categoriaId: 8,
    monto: 180,
    descripcion: 'Insumos de limpieza',
    contraparte: 'Ferretería Central',
    metodo: 'Efectivo',
    cuentaId: null,
    estado: 'Vigente',
    comprobantes: [],
    creadoPor: 'Administrador',
    creadoEn: '10/09/2026 15:20'
  },
  {
    id: 5,
    fecha: '2026-09-14',
    tipo: 'Ingreso',
    categoriaId: 2,
    monto: 150,
    descripcion: 'Multa por ruido fuera de horario',
    contraparte: '',
    metodo: 'Efectivo',
    cuentaId: null,
    estado: 'Vigente',
    comprobantes: [],
    creadoPor: 'Administrador',
    creadoEn: '14/09/2026 19:05'
  },
  {
    id: 6,
    fecha: '2026-10-06',
    tipo: 'Ingreso',
    categoriaId: 1,
    monto: 500,
    descripcion: 'Aporte para jardinería',
    contraparte: '',
    metodo: 'Depósito',
    cuentaId: 1,
    estado: 'Vigente',
    comprobantes: [{ id: 3, nombre: 'deposito-aporte.png', tamano: 210400, url: null }],
    creadoPor: 'Administrador',
    creadoEn: '06/10/2026 09:30'
  },
  {
    id: 7,
    fecha: '2026-10-08',
    tipo: 'Ingreso',
    categoriaId: 4,
    monto: 250,
    descripcion: 'Ingreso registrado por error',
    contraparte: '',
    metodo: 'Efectivo',
    cuentaId: null,
    estado: 'Anulado',
    comprobantes: [{ id: 4, nombre: 'boleta.jpg', tamano: 120800, url: null }],
    creadoPor: 'Administrador',
    creadoEn: '08/10/2026 08:10',
    anulacion: {
      motivo: 'Registrado por error: el monto correspondía a otro edificio.',
      usuario: 'Administrador',
      fecha: '09/10/2026 08:40'
    }
  }
]

// =====================================================================
// SIMULACIÓN de lo que hace backend. Se reemplaza por los fetch reales.
// =====================================================================

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
function r2(n: number) {
  return Math.round(n * 100) / 100
}

type NuevoMov = Omit<Movimiento, 'id' | 'estado' | 'creadoPor' | 'creadoEn' | 'anulacion'>

async function registrarMovimientoApi(n: NuevoMov, saldos: Saldos) {
  await esperar(900)
  // BACKEND: POST /ingresos  o  POST /gastos
  // 403 → "Permiso denegado: solo el administrador puede registrar movimientos."
  // 422 → mensaje del servidor (campo faltante, monto inválido, categoría inactiva, saldo insuficiente...)
  // 5xx → "Fallo del servicio al generar el movimiento de caja o banco."
  const delta = n.tipo === 'Ingreso' ? n.monto : -n.monto
  let caja = saldos.caja
  let cuentas = saldos.cuentas
  if (n.metodo === 'Efectivo') {
    if (caja + delta < 0)
      throw new Error(
        `Saldo insuficiente en caja. Disponible: ${bs(caja)}; el gasto es de ${bs(n.monto)}.`
      )
    caja = r2(caja + delta)
  } else {
    const c = saldos.cuentas.find((x) => x.id === n.cuentaId)
    if (!c) throw new Error('La cuenta bancaria seleccionada no existe o está inactiva.')
    if (c.saldo + delta < 0)
      throw new Error(
        `Saldo insuficiente en la cuenta ${c.banco}. Disponible: ${bs(c.saldo)}; el gasto es de ${bs(n.monto)}.`
      )
    cuentas = saldos.cuentas.map((x) => (x.id === c.id ? { ...x, saldo: r2(x.saldo + delta) } : x))
  }
  const movimiento: Movimiento = {
    ...n,
    id: Date.now(),
    estado: 'Vigente',
    creadoPor: readNombre(),
    creadoEn: ahoraTxt()
  }
  return { movimiento, caja, cuentas }
}

async function anularIngresoApi(m: Movimiento, motivo: string, saldos: Saldos) {
  await esperar(700)
  // BACKEND: POST /ingresos/{id}/anular  { motivo }  → revierte el saldo de caja o banco y registra auditoría
  let caja = saldos.caja
  let cuentas = saldos.cuentas
  if (m.metodo === 'Efectivo') {
    if (caja - m.monto < 0)
      throw new Error(`No se puede anular: la caja quedaría en ${bs(caja - m.monto)}.`)
    caja = r2(caja - m.monto)
  } else {
    const c = saldos.cuentas.find((x) => x.id === m.cuentaId)
    if (!c) throw new Error('La cuenta bancaria del ingreso no existe o está inactiva.')
    if (c.saldo - m.monto < 0)
      throw new Error(
        `No se puede anular: la cuenta ${c.banco} quedaría en ${bs(c.saldo - m.monto)}.`
      )
    cuentas = saldos.cuentas.map((x) =>
      x.id === c.id ? { ...x, saldo: r2(x.saldo - m.monto) } : x
    )
  }
  return { anulacion: { motivo, usuario: readNombre(), fecha: ahoraTxt() }, caja, cuentas }
}

// =====================================================================
// Utilidades de presentación
// =====================================================================

function bs(n: number) {
  return 'Bs. ' + n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fechaCorta(iso: string) {
  return iso.split('-').reverse().join('/')
}
function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function ahoraTxt() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function kb(n: number) {
  return n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} KB`
    : `${(n / (1024 * 1024)).toFixed(1)} MB`
}
// Monto válido: mayor a 0 y máximo 2 decimales (acepta coma o punto)
function parseMonto(txt: string): number | null {
  const t = txt.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const v = Number(t)
  return v > 0 ? v : null
}
function readRol(): string {
  if (typeof window === 'undefined') return ''
  return (sessionStorage.getItem('rolUsuario') || '').toUpperCase()
}
function readNombre(): string {
  if (typeof window === 'undefined') return 'Administrador'
  return sessionStorage.getItem('nombreUsuario') || 'Administrador'
}
function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}
function imprimirHtml(titulo: string, cuerpo: string) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) {
    alert('Tu navegador bloqueó la ventana. Permite las ventanas emergentes para imprimir.')
    return
  }
  w.document.write(
    `<html><head><title>${titulo}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#222}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f3f3f3}h2{margin:0 0 8px}p{margin:4px 0}</style></head><body>${cuerpo}</body></html>`
  )
  w.document.close()
  w.focus()
  w.print()
}
// Valida cada archivo por separado: los válidos se conservan aunque otros fallen
function procesarArchivos(files: File[]) {
  const validos: Comprobante[] = []
  const errores: string[] = []
  for (const f of files) {
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    if (!EXT_OK.includes(ext)) {
      errores.push(`"${f.name}": formato no permitido. Usa PDF, JPG o PNG.`)
      continue
    }
    if (f.size > MAX_BYTES) {
      errores.push(`"${f.name}": supera el máximo de 5 MB.`)
      continue
    }
    validos.push({
      id: Date.now() + Math.floor(Math.random() * 100000),
      nombre: f.name,
      tamano: f.size,
      url: URL.createObjectURL(f)
    })
  }
  return { validos, errores }
}

const AVISO = { background: '#fbf1df', color: '#a16d25', border: '1px solid #f0dcb4' }
const FILA = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '8px 0',
  borderBottom: '1px solid #F1ECE8',
  fontSize: 13
} as const
const MUTED = { fontSize: 11, color: '#766E69' } as const
const BTN_SM = { padding: '6px 10px', fontSize: 11 } as const
const ERR = { color: '#9F2727', fontSize: 11, marginTop: 4 } as const
const clave = (t: string) => t.trim().toLowerCase()

function formVacio(): Form {
  return {
    fecha: hoyISO(),
    monto: '',
    categoriaId: '',
    descripcion: '',
    contraparte: '',
    metodo: 'Efectivo',
    cuentaId: '',
    archivos: []
  }
}

// =====================================================================
// Página
// =====================================================================

export default function IngresosEgresosPage() {
  const [rol] = useState(readRol)
  const esAdmin = rol.startsWith('ADMIN')

  const [vista, setVista] = useState<'movimientos' | 'categorias'>('movimientos')
  const [categorias, setCategorias] = useState<Categoria[]>(CATEGORIAS_INICIALES)
  const [cambios, setCambios] = useState<CambioCategoria[]>(CAMBIOS_INICIALES)
  const [movimientos, setMovimientos] = useState<Movimiento[]>(MOVIMIENTOS_INICIALES)
  const [saldoCaja, setSaldoCaja] = useState(SALDO_CAJA_INICIAL)
  const [cuentas, setCuentas] = useState<Cuenta[]>(CUENTAS_INICIALES)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  // Filtros del historial (HU-19)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [tipoF, setTipoF] = useState('')
  const [categoriaF, setCategoriaF] = useState('')
  const [montoMin, setMontoMin] = useState('')
  const [montoMax, setMontoMax] = useState('')
  const [orden, setOrden] = useState<'desc' | 'asc'>('desc')

  // Formulario de registro (HU-15 / HU-16 / HU-18)
  const [formOpen, setFormOpen] = useState(false)
  const [tipoForm, setTipoForm] = useState<Tipo>('Ingreso')
  const [form, setForm] = useState<Form>(formVacio())
  const [errores, setErrores] = useState<Errores>({})
  const [errArchForm, setErrArchForm] = useState<string[]>([])
  const [errorServidor, setErrorServidor] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Detalle del movimiento (HU-19 / HU-18 / HU-15 anulación)
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [msgDetalle, setMsgDetalle] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [errArchDetalle, setErrArchDetalle] = useState<string[]>([])
  const [anulando, setAnulando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [errMotivo, setErrMotivo] = useState('')
  const [guardandoAnul, setGuardandoAnul] = useState(false)
  const [reemplazoId, setReemplazoId] = useState<number | null>(null)
  const reemplazoRef = useRef<HTMLInputElement>(null)
  const agregarRef = useRef<HTMLInputElement>(null)

  // Categorías (HU-17)
  const [catOpen, setCatOpen] = useState(false)
  const [catEdit, setCatEdit] = useState<Categoria | null>(null)
  const [catForm, setCatForm] = useState<{ nombre: string; tipo: '' | Tipo; descripcion: string }>({
    nombre: '',
    tipo: '',
    descripcion: ''
  })
  const [catErr, setCatErr] = useState<{ nombre?: string; tipo?: string; duplicado?: string }>({})

  // ---------- Datos derivados ----------
  const nombreCat = (id: number) => categorias.find((c) => c.id === id)?.nombre ?? '—' // HU-17 criterio 5
  const cuentaDe = (id: number | null) => cuentas.find((c) => c.id === id) ?? null

  const vigentes = movimientos.filter((m) => m.estado === 'Vigente')
  const totalIngresos = vigentes
    .filter((m) => m.tipo === 'Ingreso')
    .reduce((s, m) => s + m.monto, 0)
  const totalGastos = vigentes.filter((m) => m.tipo === 'Gasto').reduce((s, m) => s + m.monto, 0)

  const num = (t: string) => {
    if (t.trim() === '') return null
    const v = Number(t.trim().replace(',', '.'))
    return Number.isNaN(v) ? null : v
  }
  const minNum = num(montoMin)
  const maxNum = num(montoMax)
  const rangoInvalido = desde !== '' && hasta !== '' && desde > hasta

  const filtrados = movimientos
    .filter(
      (m) =>
        (desde === '' || m.fecha >= desde) &&
        (hasta === '' || m.fecha <= hasta) &&
        (tipoF === '' || m.tipo === tipoF) &&
        (categoriaF === '' || String(m.categoriaId) === categoriaF) &&
        (minNum === null || m.monto >= minNum) &&
        (maxNum === null || m.monto <= maxNum)
    )
    .sort((a, b) =>
      orden === 'desc'
        ? b.fecha.localeCompare(a.fecha) || b.id - a.id
        : a.fecha.localeCompare(b.fecha) || a.id - b.id
    )

  const filtrosTxt =
    [
      desde && `Desde: ${fechaCorta(desde)}`,
      hasta && `Hasta: ${fechaCorta(hasta)}`,
      tipoF && `Tipo: ${tipoF}`,
      categoriaF && `Categoría: ${nombreCat(Number(categoriaF))}`,
      minNum !== null && `Monto mínimo: ${bs(minNum)}`,
      maxNum !== null && `Monto máximo: ${bs(maxNum)}`
    ]
      .filter(Boolean)
      .join(' · ') || 'Sin filtros'

  const categoriasFiltro = categorias.filter((c) => tipoF === '' || c.tipo === tipoF)
  const detalle = movimientos.find((m) => m.id === detalleId) ?? null

  // ---------- Filtros ----------
  function limpiarFiltros() {
    setDesde('')
    setHasta('')
    setTipoF('')
    setCategoriaF('')
    setMontoMin('')
    setMontoMax('')
  }

  // ---------- Registro de ingresos y gastos ----------
  const categoriasForm = categorias.filter((c) => c.activa && c.tipo === tipoForm) // HU-15/16: solo activas del tipo
  const montoForm = parseMonto(form.monto)
  const cuentaForm = cuentaDe(form.cuentaId === '' ? null : Number(form.cuentaId))

  function abrirForm(tipo: Tipo) {
    setTipoForm(tipo)
    setForm(formVacio())
    setErrores({})
    setErrArchForm([])
    setErrorServidor('')
    setAviso(null)
    setFormOpen(true)
  }
  function cerrarForm() {
    if (guardando) return
    setFormOpen(false)
  }
  function validarForm(): Errores {
    const e: Errores = {}
    if (!form.fecha) e.fecha = 'El campo fecha es obligatorio.'
    else if (form.fecha > hoyISO()) e.fecha = 'La fecha no puede ser futura.'
    if (form.monto.trim() === '') e.monto = 'El campo monto es obligatorio.'
    else if (montoForm === null) e.monto = 'El monto debe ser mayor a 0 y tener máximo 2 decimales.'
    if (!form.categoriaId) e.categoria = 'El campo categoría es obligatorio.'
    if (form.metodo !== 'Efectivo' && !form.cuentaId) e.cuenta = 'Selecciona la cuenta bancaria.'
    return e
  }
  function agregarArchivosForm(files: FileList | null) {
    if (!files) return
    const { validos, errores: errs } = procesarArchivos(Array.from(files))
    setErrArchForm(errs)
    setForm((f) => ({ ...f, archivos: [...f.archivos, ...validos] }))
  }
  async function guardarMovimiento() {
    if (guardando) return
    const e = validarForm()
    setErrores(e)
    if (Object.keys(e).length > 0 || montoForm === null) return

    setGuardando(true)
    setErrorServidor('')
    try {
      const res = await registrarMovimientoApi(
        {
          fecha: form.fecha,
          tipo: tipoForm,
          categoriaId: Number(form.categoriaId),
          monto: montoForm,
          descripcion: form.descripcion.trim(),
          contraparte: form.contraparte.trim(),
          metodo: form.metodo,
          cuentaId: form.metodo === 'Efectivo' ? null : Number(form.cuentaId),
          comprobantes: form.archivos
        },
        { caja: saldoCaja, cuentas }
      )
      setMovimientos((prev) => [res.movimiento, ...prev])
      setSaldoCaja(res.caja)
      setCuentas(res.cuentas)
      setFormOpen(false)
      setAviso({
        tipo: 'ok',
        texto: `${tipoForm} registrado correctamente por ${bs(montoForm)}. ${
          form.metodo === 'Efectivo'
            ? 'El saldo de caja se actualizó.'
            : 'El saldo de la cuenta bancaria se actualizó.'
        }`
      })
    } catch (err) {
      // HU-15 criterio 7 / HU-16 criterio 7: si falla el movimiento de caja o banco, se informa
      setErrorServidor(
        `El ${tipoForm.toLowerCase()} no pudo registrarse. ${err instanceof Error ? err.message : ''}`
      )
    } finally {
      setGuardando(false)
    }
  }

  // ---------- Detalle, comprobantes y anulación ----------
  function abrirDetalle(id: number) {
    setDetalleId(id)
    setMsgDetalle(null)
    setErrArchDetalle([])
    setAnulando(false)
    setMotivo('')
    setErrMotivo('')
  }
  function actualizarMov(id: number, fn: (m: Movimiento) => Movimiento) {
    setMovimientos((prev) => prev.map((m) => (m.id === id ? fn(m) : m)))
  }
  function verComprobante(c: Comprobante) {
    if (!c.url) {
      alert('Es un archivo de ejemplo. Podrá visualizarse cuando se conecte con el backend.')
      return
    }
    window.open(c.url, '_blank')
  }
  function descargarComprobante(c: Comprobante) {
    if (!c.url) {
      alert('Es un archivo de ejemplo. Podrá descargarse cuando se conecte con el backend.')
      return
    }
    const a = document.createElement('a')
    a.href = c.url
    a.download = c.nombre
    a.click()
  }
  function agregarComprobantes(files: FileList | null) {
    if (!files || !detalle) return
    const { validos, errores: errs } = procesarArchivos(Array.from(files))
    setErrArchDetalle(errs)
    if (validos.length === 0) return
    // BACKEND: POST /movimientos/{id}/comprobantes
    actualizarMov(detalle.id, (m) => ({ ...m, comprobantes: [...m.comprobantes, ...validos] }))
    setMsgDetalle({
      tipo: 'ok',
      texto: `${validos.length} ${validos.length === 1 ? 'comprobante adjuntado' : 'comprobantes adjuntados'} correctamente.`
    })
  }
  function reemplazarComprobante(files: FileList | null) {
    const id = reemplazoId
    setReemplazoId(null)
    if (!files || files.length === 0 || id === null || !detalle) return
    const { validos, errores: errs } = procesarArchivos([files[0]])
    setErrArchDetalle(errs)
    if (validos.length === 0) return
    // BACKEND: PUT /movimientos/{id}/comprobantes/{comprobanteId}
    actualizarMov(detalle.id, (m) => ({
      ...m,
      comprobantes: m.comprobantes.map((c) => (c.id === id ? validos[0] : c))
    }))
    setMsgDetalle({ tipo: 'ok', texto: 'Comprobante reemplazado correctamente.' })
  }
  function eliminarComprobante(c: Comprobante) {
    if (!detalle) return
    if (!window.confirm(`¿Eliminar el comprobante "${c.nombre}"?`)) return
    // BACKEND: DELETE /movimientos/{id}/comprobantes/{comprobanteId}
    actualizarMov(detalle.id, (m) => ({
      ...m,
      comprobantes: m.comprobantes.filter((x) => x.id !== c.id)
    }))
    // HU-18 criterio 6: el monto y el saldo no cambian
    setMsgDetalle({
      tipo: 'ok',
      texto: 'Comprobante eliminado. El monto y el saldo del movimiento no cambiaron.'
    })
  }
  async function confirmarAnulacion() {
    if (guardandoAnul || !detalle) return
    if (motivo.trim() === '') {
      setErrMotivo('El motivo de anulación es obligatorio.')
      return
    }
    setErrMotivo('')
    setGuardandoAnul(true)
    try {
      const res = await anularIngresoApi(detalle, motivo.trim(), { caja: saldoCaja, cuentas })
      actualizarMov(detalle.id, (m) => ({ ...m, estado: 'Anulado', anulacion: res.anulacion }))
      setSaldoCaja(res.caja)
      setCuentas(res.cuentas)
      setAnulando(false)
      setMotivo('')
      setMsgDetalle({
        tipo: 'ok',
        texto: 'Ingreso anulado. El saldo se revirtió y el movimiento se conserva en el historial.'
      })
    } catch (err) {
      setMsgDetalle({
        tipo: 'error',
        texto:
          err instanceof Error ? err.message : 'No se pudo anular el ingreso. Intenta nuevamente.'
      })
    } finally {
      setGuardandoAnul(false)
    }
  }

  // ---------- Exportar (HU-19 criterio 6): exporta lo que se ve con los filtros actuales ----------
  function exportarExcel() {
    // BACKEND: GET /movimientos-financieros/exportar?formato=xlsx&<filtros>. Aquí se simula con un CSV que abre Excel.
    if (filtrados.length === 0) {
      alert('No hay datos para exportar.')
      return
    }
    const lineas: (string | number)[][] = [
      ['Historial de ingresos y gastos'],
      [`Filtros aplicados: ${filtrosTxt}`],
      [],
      ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Método', 'Estado', 'Comprobantes'],
      ...filtrados.map((m) => [
        fechaCorta(m.fecha),
        m.tipo,
        nombreCat(m.categoriaId),
        m.descripcion,
        m.monto,
        m.metodo,
        m.estado,
        m.comprobantes.length
      ])
    ]
    const csv = lineas
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')
    descargar('ingresos-y-gastos.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8')
  }
  function exportarPdf() {
    // BACKEND: GET /movimientos-financieros/exportar?formato=pdf&<filtros>. Aquí se simula con la ventana de impresión.
    if (filtrados.length === 0) {
      alert('No hay datos para exportar.')
      return
    }
    const filas = filtrados
      .map(
        (m) =>
          `<tr><td>${fechaCorta(m.fecha)}</td><td>${m.tipo}</td><td>${nombreCat(m.categoriaId)}</td><td>${m.descripcion}</td><td>${bs(m.monto)}</td><td>${m.metodo}</td><td>${m.estado}</td><td>${m.comprobantes.length}</td></tr>`
      )
      .join('')
    imprimirHtml(
      'Historial de ingresos y gastos',
      `<h2>Historial de ingresos y gastos</h2><p>Filtros aplicados: ${filtrosTxt}</p><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Monto</th><th>Método</th><th>Estado</th><th>Comprobantes</th></tr></thead><tbody>${filas}</tbody></table>`
    )
  }

  // ---------- Categorías (HU-17) ----------
  function abrirCategoria(c?: Categoria) {
    setCatEdit(c ?? null)
    setCatForm({ nombre: c?.nombre ?? '', tipo: c?.tipo ?? '', descripcion: c?.descripcion ?? '' })
    setCatErr({})
    setCatOpen(true)
  }
  function guardarCategoria() {
    const nombre = catForm.nombre.trim()
    const err: { nombre?: string; tipo?: string; duplicado?: string } = {}
    if (nombre === '') err.nombre = 'El nombre es obligatorio.'
    if (catForm.tipo === '') err.tipo = 'El tipo es obligatorio.'
    if (
      nombre !== '' &&
      catForm.tipo !== '' &&
      categorias.some(
        (c) => c.tipo === catForm.tipo && clave(c.nombre) === clave(nombre) && c.id !== catEdit?.id
      )
    ) {
      err.duplicado =
        'Ya existe una categoría con ese nombre en este tipo. No se permiten categorías duplicadas.'
    }
    setCatErr(err)
    if (Object.keys(err).length > 0 || catForm.tipo === '') return

    // BACKEND: POST /categorias  o  PUT /categorias/{id}. Si el servidor responde duplicado, se muestra su mensaje.
    if (catEdit) {
      setCategorias((prev) =>
        prev.map((c) =>
          c.id === catEdit.id ? { ...c, nombre, descripcion: catForm.descripcion.trim() } : c
        )
      )
      setCambios((prev) => [
        {
          id: Date.now(),
          fecha: ahoraTxt(),
          usuario: readNombre(),
          accion: 'Editada',
          categoria: nombre,
          anterior: `${catEdit.nombre} · ${catEdit.descripcion || 'sin descripción'}`,
          nuevo: `${nombre} · ${catForm.descripcion.trim() || 'sin descripción'}`
        },
        ...prev
      ])
      setAviso({
        tipo: 'ok',
        texto: `Categoría "${nombre}" actualizada. Los movimientos relacionados ya muestran el nombre nuevo.`
      })
    } else {
      setCategorias((prev) => [
        ...prev,
        {
          id: Date.now(),
          nombre,
          tipo: catForm.tipo as Tipo,
          descripcion: catForm.descripcion.trim(),
          activa: true,
          predeterminada: false
        }
      ])
      setCambios((prev) => [
        {
          id: Date.now(),
          fecha: ahoraTxt(),
          usuario: readNombre(),
          accion: 'Creada',
          categoria: nombre,
          anterior: '—',
          nuevo: `${nombre} (${catForm.tipo})`
        },
        ...prev
      ])
      setAviso({ tipo: 'ok', texto: `Categoría "${nombre}" creada.` })
    }
    setCatOpen(false)
  }
  function desactivarCategoria(c: Categoria) {
    if (
      !window.confirm(
        `¿Desactivar la categoría "${c.nombre}"? Dejará de aparecer en los formularios de registro. Los movimientos existentes la conservan.`
      )
    )
      return
    // BACKEND: PATCH /categorias/{id}/desactivar
    setCategorias((prev) => prev.map((x) => (x.id === c.id ? { ...x, activa: false } : x)))
    setCambios((prev) => [
      {
        id: Date.now(),
        fecha: ahoraTxt(),
        usuario: readNombre(),
        accion: 'Desactivada',
        categoria: c.nombre,
        anterior: 'Activa',
        nuevo: 'Inactiva'
      },
      ...prev
    ])
    setAviso({ tipo: 'ok', texto: `Categoría "${c.nombre}" desactivada.` })
  }

  // ---------- Render ----------
  if (!esAdmin) {
    return (
      <DashboardLayout active="ingresos-egresos">
        <div className="panel">
          <div className="empty-state">
            Acceso denegado. Solo el administrador puede ver y registrar ingresos y gastos.
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout active="ingresos-egresos">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-03 · FINANZAS</p>
          <h1>Ingresos y egresos</h1>
          <p>
            Registra ingresos extraordinarios y gastos, clasifícalos por categoría y respáldalos con
            comprobantes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => abrirForm('Ingreso')}>
            <PlusIcon size={16} /> Nuevo ingreso
          </button>
          <button className="btn btn-primary" onClick={() => abrirForm('Gasto')}>
            <PlusIcon size={16} /> Nuevo gasto
          </button>
        </div>
      </div>

      {aviso && (
        <div
          className={aviso.tipo === 'ok' ? 'alert alert-success' : 'alert alert-error'}
          style={{ marginBottom: 16 }}
        >
          {aviso.texto}
        </div>
      )}

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon soft">
            <WalletIcon size={20} />
          </div>
          <div>
            <span>Ingresos vigentes</span>
            <strong>{bs(totalIngresos)}</strong>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon attention">
            <WalletIcon size={20} />
          </div>
          <div>
            <span>Gastos vigentes</span>
            <strong>{bs(totalGastos)}</strong>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon">
            <CheckIcon size={20} />
          </div>
          <div>
            <span>Saldo de caja</span>
            <strong>{bs(saldoCaja)}</strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={vista === 'movimientos' ? 'filter-chip active' : 'filter-chip'}
          onClick={() => setVista('movimientos')}
        >
          Historial de movimientos
        </button>
        <button
          className={vista === 'categorias' ? 'filter-chip active' : 'filter-chip'}
          onClick={() => setVista('categorias')}
        >
          Categorías
        </button>
      </div>

      {vista === 'movimientos' ? (
        <>
          {/* HU-19 criterio 3: filtros combinables */}
          <section className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-toolbar">
              <div>
                <h3>Filtros</h3>
                <p>Los filtros se pueden combinar entre sí.</p>
              </div>
              <button className="btn btn-secondary" onClick={limpiarFiltros}>
                Limpiar filtros
              </button>
            </div>
            <div className="modal-form" style={{ paddingTop: 8 }}>
              <div className="form-grid">
                <label className="field">
                  <span>Desde</span>
                  <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </label>
                <label className="field">
                  <span>Hasta</span>
                  <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </label>
                <label className="field">
                  <span>Tipo de movimiento</span>
                  <select
                    value={tipoF}
                    onChange={(e) => {
                      setTipoF(e.target.value)
                      setCategoriaF('')
                    }}
                  >
                    <option value="">Todos</option>
                    <option value="Ingreso">Ingresos</option>
                    <option value="Gasto">Gastos</option>
                  </select>
                </label>
                <label className="field">
                  <span>Categoría</span>
                  <select value={categoriaF} onChange={(e) => setCategoriaF(e.target.value)}>
                    <option value="">Todas</option>
                    {categoriasFiltro.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.nombre} · {c.tipo}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Monto mínimo (Bs.)</span>
                  <input
                    value={montoMin}
                    inputMode="decimal"
                    onChange={(e) => setMontoMin(e.target.value)}
                    placeholder="Ej. 100"
                  />
                </label>
                <label className="field">
                  <span>Monto máximo (Bs.)</span>
                  <input
                    value={montoMax}
                    inputMode="decimal"
                    onChange={(e) => setMontoMax(e.target.value)}
                    placeholder="Ej. 1000"
                  />
                </label>
              </div>
              {rangoInvalido && (
                <div className="alert alert-error" style={{ marginTop: 12 }}>
                  La fecha inicial no puede ser posterior a la fecha final.
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-toolbar">
              <div>
                <h3>Historial de ingresos y gastos</h3>
                <p>Filtros aplicados: {filtrosTxt}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* HU-19 criterio 2: orden por defecto del más reciente al más antiguo, con opción de invertir */}
                <button
                  className="btn btn-secondary"
                  onClick={() => setOrden(orden === 'desc' ? 'asc' : 'desc')}
                >
                  Orden: {orden === 'desc' ? 'más recientes primero' : 'más antiguos primero'}
                </button>
                <button className="btn btn-secondary" onClick={exportarPdf}>
                  <FileIcon size={16} /> Exportar PDF
                </button>
                <button className="btn btn-secondary" onClick={exportarExcel}>
                  <FileIcon size={16} /> Exportar Excel
                </button>
              </div>
            </div>

            {filtrados.length === 0 ? (
              <div className="empty-state">
                No se encontraron resultados con los filtros aplicados.
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Categoría</th>
                      <th>Descripción</th>
                      <th>Monto</th>
                      <th>Método</th>
                      <th>Estado</th>
                      <th>Comprobante</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((m) => (
                      <tr key={m.id} style={m.estado === 'Anulado' ? { opacity: 0.6 } : undefined}>
                        <td>{fechaCorta(m.fecha)}</td>
                        <td>
                          <span
                            className={`status ${m.tipo === 'Ingreso' ? 'status-success' : 'status-attention'}`}
                          >
                            <span />
                            {m.tipo}
                          </span>
                        </td>
                        <td>
                          <span className="tag">{nombreCat(m.categoriaId)}</span>
                        </td>
                        <td>{m.descripcion || '—'}</td>
                        <td>{bs(m.monto)}</td>
                        <td>{m.metodo}</td>
                        <td>
                          {m.estado === 'Anulado' ? (
                            <span className="tag">Anulado</span>
                          ) : (
                            'Vigente'
                          )}
                        </td>
                        <td>
                          {m.comprobantes.length > 0
                            ? `${m.comprobantes.length} ${m.comprobantes.length === 1 ? 'adjunto' : 'adjuntos'}`
                            : 'Sin adjunto'}
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary"
                            style={BTN_SM}
                            onClick={() => abrirDetalle(m.id)}
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          {/* HU-17: administración de categorías */}
          <section className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-toolbar">
              <div>
                <h3>Categorías de ingresos y gastos</h3>
                <p>
                  Las predeterminadas se pueden editar o desactivar. El tipo no cambia una vez
                  creada la categoría.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => abrirCategoria()}>
                <PlusIcon size={16} /> Nueva categoría
              </button>
            </div>
            {(['Ingreso', 'Gasto'] as Tipo[]).map((t) => (
              <div key={t} style={{ padding: '0 0 8px' }}>
                <h3 style={{ fontSize: 13, margin: '8px 20px' }}>
                  {t === 'Ingreso' ? 'Categorías de ingresos' : 'Categorías de gastos'}
                </h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Descripción</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categorias
                        .filter((c) => c.tipo === t)
                        .map((c) => (
                          <tr key={c.id} style={!c.activa ? { opacity: 0.6 } : undefined}>
                            <td>
                              <strong>{c.nombre}</strong>{' '}
                              {c.predeterminada && <span className="tag">Predeterminada</span>}
                            </td>
                            <td>{c.descripcion || '—'}</td>
                            <td>
                              <span
                                className={`status ${c.activa ? 'status-success' : 'status-warning'}`}
                              >
                                <span />
                                {c.activa ? 'Activa' : 'Inactiva'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  className="btn btn-secondary"
                                  style={BTN_SM}
                                  onClick={() => abrirCategoria(c)}
                                >
                                  Editar
                                </button>
                                {c.activa && (
                                  <button
                                    className="btn btn-secondary"
                                    style={BTN_SM}
                                    onClick={() => desactivarCategoria(c)}
                                  >
                                    Desactivar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>

          {/* HU-17 criterio 7: cambios registrados en auditoría */}
          <section className="panel">
            <div className="panel-toolbar">
              <div>
                <h3>Cambios en categorías</h3>
                <p>Registro de auditoría: usuario, fecha y valores anteriores y nuevos.</p>
              </div>
            </div>
            {cambios.length === 0 ? (
              <div className="empty-state">Todavía no hay cambios registrados.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Usuario</th>
                      <th>Acción</th>
                      <th>Categoría</th>
                      <th>Valor anterior</th>
                      <th>Valor nuevo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cambios.map((c) => (
                      <tr key={c.id}>
                        <td>{c.fecha}</td>
                        <td>{c.usuario}</td>
                        <td>{c.accion}</td>
                        <td>
                          <span className="tag">{c.categoria}</span>
                        </td>
                        <td>{c.anterior}</td>
                        <td>{c.nuevo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ================= Registrar ingreso / gasto ================= */}
      <Modal
        open={formOpen}
        title={tipoForm === 'Ingreso' ? 'Registrar ingreso extraordinario' : 'Registrar gasto'}
        onClose={cerrarForm}
      >
        <div className="modal-form">
          <div className="form-grid">
            <label className="field">
              <span>
                Fecha <b>*</b>
              </span>
              <input
                type="date"
                max={hoyISO()}
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
              {errores.fecha && <small style={ERR}>{errores.fecha}</small>}
            </label>
            <label className="field">
              <span>
                Monto (Bs.) <b>*</b>
              </span>
              <input
                value={form.monto}
                inputMode="decimal"
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
                placeholder="Ej. 450,00"
              />
              {errores.monto && <small style={ERR}>{errores.monto}</small>}
            </label>
            <label className="field">
              <span>
                Categoría <b>*</b>
              </span>
              <select
                value={form.categoriaId}
                onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
              >
                <option value="">Selecciona una categoría</option>
                {categoriasForm.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {errores.categoria && <small style={ERR}>{errores.categoria}</small>}
            </label>
            <label className="field">
              <span>
                {tipoForm === 'Ingreso' ? 'Método de ingreso' : 'Método de pago'} <b>*</b>
              </span>
              <select
                value={form.metodo}
                onChange={(e) =>
                  setForm({ ...form, metodo: e.target.value as Metodo, cuentaId: '' })
                }
              >
                {METODOS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            {tipoForm === 'Gasto' && (
              <label className="field">
                <span>Proveedor o beneficiario</span>
                <input
                  value={form.contraparte}
                  onChange={(e) => setForm({ ...form, contraparte: e.target.value })}
                  placeholder="Ej. Ferretería Central"
                />
              </label>
            )}
            <label className="field">
              <span>Descripción</span>
              <input
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Ej. Reparación de bomba de agua"
              />
            </label>
          </div>

          {categoriasForm.length === 0 && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>
              No hay categorías activas de {tipoForm === 'Ingreso' ? 'ingreso' : 'gasto'}. Crea o
              activa una en la pestaña Categorías.
            </div>
          )}

          {/* Cuenta bancaria solo con transferencia o depósito */}
          {form.metodo !== 'Efectivo' ? (
            <div style={{ marginTop: 12 }}>
              <label className="field">
                <span>
                  Cuenta bancaria <b>*</b>
                </span>
                <select
                  value={form.cuentaId}
                  onChange={(e) => setForm({ ...form, cuentaId: e.target.value })}
                >
                  <option value="">Selecciona una cuenta</option>
                  {cuentas.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.banco} · {c.numero}
                    </option>
                  ))}
                </select>
                {errores.cuenta && <small style={ERR}>{errores.cuenta}</small>}
              </label>
              {cuentaForm && (
                <p style={{ ...MUTED, marginTop: 6 }}>
                  Saldo actual de la cuenta: {bs(cuentaForm.saldo)}.{' '}
                  {tipoForm === 'Ingreso'
                    ? 'El monto se sumará a este saldo.'
                    : 'El monto se descontará de este saldo.'}
                </p>
              )}
            </div>
          ) : (
            <p style={{ ...MUTED, marginTop: 12 }}>
              En efectivo no se pide cuenta bancaria.{' '}
              {tipoForm === 'Ingreso' ? 'El monto se sumará' : 'El monto se descontará'} del saldo
              de caja (actual: {bs(saldoCaja)}).
            </p>
          )}

          {/* HU-18: adjuntar uno o más comprobantes */}
          <div style={{ marginTop: 14 }}>
            <label className="field">
              <span>Comprobantes (PDF, JPG o PNG, máx. 5 MB cada uno)</span>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  agregarArchivosForm(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
            {errArchForm.length > 0 && (
              <div className="alert alert-error" style={{ marginTop: 8 }}>
                {errArchForm.map((m) => (
                  <div key={m}>{m}</div>
                ))}
              </div>
            )}
            {form.archivos.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {form.archivos.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 12,
                      padding: '4px 0'
                    }}
                  >
                    <span>
                      {a.nombre} <span style={MUTED}>· {kb(a.tamano)}</span>
                    </span>
                    <button
                      className="btn btn-secondary"
                      style={BTN_SM}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          archivos: f.archivos.filter((x) => x.id !== a.id)
                        }))
                      }
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {errorServidor && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>
              {errorServidor}
            </div>
          )}

          <div className="modal-actions">
            <button className="btn btn-secondary" disabled={guardando} onClick={cerrarForm}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              disabled={guardando || categoriasForm.length === 0}
              onClick={guardarMovimiento}
            >
              {guardando
                ? 'Guardando…'
                : tipoForm === 'Ingreso'
                  ? 'Registrar ingreso'
                  : 'Registrar gasto'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ================= Detalle del movimiento ================= */}
      <Modal
        open={detalle !== null}
        title="Detalle del movimiento"
        onClose={() => setDetalleId(null)}
      >
        {detalle && (
          <div className="modal-form">
            {msgDetalle && (
              <div
                className={msgDetalle.tipo === 'ok' ? 'alert alert-success' : 'alert alert-error'}
                style={{ marginBottom: 12 }}
              >
                {msgDetalle.texto}
              </div>
            )}

            <div style={FILA}>
              <span>Tipo</span>
              <strong>{detalle.tipo}</strong>
            </div>
            <div style={FILA}>
              <span>Fecha</span>
              <strong>{fechaCorta(detalle.fecha)}</strong>
            </div>
            <div style={FILA}>
              <span>Categoría</span>
              <strong>{nombreCat(detalle.categoriaId)}</strong>
            </div>
            <div style={FILA}>
              <span>Descripción</span>
              <strong>{detalle.descripcion || '—'}</strong>
            </div>
            {detalle.tipo === 'Gasto' && (
              <div style={FILA}>
                <span>Proveedor o beneficiario</span>
                <strong>{detalle.contraparte || '—'}</strong>
              </div>
            )}
            <div style={FILA}>
              <span>Monto</span>
              <strong>{bs(detalle.monto)}</strong>
            </div>
            <div style={FILA}>
              <span>Método</span>
              <strong>{detalle.metodo}</strong>
            </div>
            {detalle.cuentaId !== null && (
              <div style={FILA}>
                <span>Cuenta bancaria</span>
                <strong>
                  {cuentaDe(detalle.cuentaId)?.banco ?? '—'} ·{' '}
                  {cuentaDe(detalle.cuentaId)?.numero ?? ''}
                </strong>
              </div>
            )}
            <div style={FILA}>
              <span>Estado</span>
              <strong>{detalle.estado}</strong>
            </div>
            <div style={FILA}>
              <span>Registrado por</span>
              <strong>{detalle.creadoPor}</strong>
            </div>
            <div style={FILA}>
              <span>Fecha de registro</span>
              <strong>{detalle.creadoEn}</strong>
            </div>

            {/* HU-19 criterio 7: datos de la anulación */}
            {detalle.estado === 'Anulado' && detalle.anulacion && (
              <div className="alert" style={{ ...AVISO, marginTop: 12 }}>
                <strong>Movimiento anulado</strong>
                <div>Motivo: {detalle.anulacion.motivo}</div>
                <div>Anulado por: {detalle.anulacion.usuario}</div>
                <div>Fecha de anulación: {detalle.anulacion.fecha}</div>
              </div>
            )}

            {/* HU-18: comprobantes. Ver y descargar solo para usuarios autorizados (esta pantalla es solo del administrador). */}
            <h3 style={{ fontSize: 13, margin: '18px 0 6px' }}>Comprobantes</h3>
            {detalle.comprobantes.length === 0 ? (
              <p style={MUTED}>Este movimiento no tiene comprobantes adjuntos.</p>
            ) : (
              detalle.comprobantes.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 0',
                    borderBottom: '1px solid #F1ECE8',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <strong style={{ fontSize: 12 }}>{c.nombre}</strong>
                    <div style={MUTED}>{kb(c.tamano)}</div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={BTN_SM}
                    onClick={() => verComprobante(c)}
                  >
                    Ver
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={BTN_SM}
                    onClick={() => descargarComprobante(c)}
                  >
                    Descargar
                  </button>
                  {/* En movimientos anulados el comprobante solo se consulta (HU-18 criterio 7) */}
                  {detalle.estado === 'Vigente' && (
                    <>
                      <button
                        className="btn btn-secondary"
                        style={BTN_SM}
                        onClick={() => {
                          setReemplazoId(c.id)
                          reemplazoRef.current?.click()
                        }}
                      >
                        Reemplazar
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={BTN_SM}
                        onClick={() => eliminarComprobante(c)}
                      >
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              ))
            )}

            {errArchDetalle.length > 0 && (
              <div className="alert alert-error" style={{ marginTop: 8 }}>
                {errArchDetalle.map((m) => (
                  <div key={m}>{m}</div>
                ))}
              </div>
            )}

            {detalle.estado === 'Vigente' && (
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn btn-secondary"
                  style={BTN_SM}
                  onClick={() => agregarRef.current?.click()}
                >
                  Agregar comprobante
                </button>
              </div>
            )}

            <input
              ref={reemplazoRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={(e) => {
                reemplazarComprobante(e.target.files)
                e.target.value = ''
              }}
            />
            <input
              ref={agregarRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={(e) => {
                agregarComprobantes(e.target.files)
                e.target.value = ''
              }}
            />

            {/* HU-15 criterio 8: anular un ingreso con motivo obligatorio (no se elimina) */}
            {detalle.tipo === 'Ingreso' && detalle.estado === 'Vigente' && (
              <div style={{ marginTop: 18 }}>
                {!anulando ? (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setAnulando(true)
                      setMsgDetalle(null)
                    }}
                  >
                    Anular ingreso
                  </button>
                ) : (
                  <div className="alert" style={AVISO}>
                    <label className="field">
                      <span>
                        Motivo de anulación <b>*</b>
                      </span>
                      <input
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Explica por qué se anula este ingreso"
                      />
                      {errMotivo && <small style={ERR}>{errMotivo}</small>}
                    </label>
                    <p style={{ ...MUTED, margin: '8px 0' }}>
                      El ingreso no se elimina: queda en el historial como anulado y el saldo de{' '}
                      {detalle.metodo === 'Efectivo' ? 'caja' : 'la cuenta'} se revierte.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-secondary"
                        disabled={guardandoAnul}
                        onClick={() => {
                          setAnulando(false)
                          setMotivo('')
                          setErrMotivo('')
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        className="btn btn-primary"
                        disabled={guardandoAnul}
                        onClick={confirmarAnulacion}
                      >
                        {guardandoAnul ? 'Anulando…' : 'Confirmar anulación'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setDetalleId(null)}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ================= Crear / editar categoría ================= */}
      <Modal
        open={catOpen}
        title={catEdit ? 'Editar categoría' : 'Nueva categoría'}
        onClose={() => setCatOpen(false)}
      >
        <div className="modal-form">
          <div className="form-grid">
            <label className="field">
              <span>
                Nombre <b>*</b>
              </span>
              <input
                value={catForm.nombre}
                onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })}
                placeholder="Ej. Reparaciones menores"
              />
              {catErr.nombre && <small style={ERR}>{catErr.nombre}</small>}
            </label>
            <label className="field">
              <span>
                Tipo <b>*</b>
              </span>
              <select
                value={catForm.tipo}
                disabled={!!catEdit}
                onChange={(e) => setCatForm({ ...catForm, tipo: e.target.value as '' | Tipo })}
              >
                <option value="">Selecciona un tipo</option>
                <option value="Ingreso">Ingreso</option>
                <option value="Gasto">Gasto</option>
              </select>
              {catErr.tipo && <small style={ERR}>{catErr.tipo}</small>}
            </label>
          </div>
          <label className="field" style={{ marginTop: 12 }}>
            <span>Descripción (opcional)</span>
            <input
              value={catForm.descripcion}
              onChange={(e) => setCatForm({ ...catForm, descripcion: e.target.value })}
              placeholder="Para qué se usa esta categoría"
            />
          </label>
          {catErr.duplicado && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>
              {catErr.duplicado}
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setCatOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={guardarCategoria}>
              {catEdit ? 'Guardar cambios' : 'Crear categoría'}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
