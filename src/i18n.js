// i18n minimalista del ecosistema: reactivo, sin dependencias. Español neutro
// (tuteo, SIN voseo) e inglés. Detecta el idioma del navegador y lo persiste en
// localStorage (preferencia de UI efímera, permitido por §4).
import { ref, computed } from 'vue'

const STORE_KEY = 'myip.lang'

const messages = {
  es: {
    appName: 'Mi IP',
    tagline: 'Tu IP y tu conexión',
    yourIp: 'Tu IP pública',
    ipv4: 'IPv4',
    ipv6: 'IPv6',
    copy: 'Copiar',
    copied: 'Copiado',
    refresh: 'Actualizar',
    loading: 'Consultando…',
    unavailable: 'No disponible',
    ipError: 'No se pudo leer tu IP. Reintenta o revisa tu conexión.',
    ipErrorDev: 'La IP solo se resuelve en producción (myip.dotrino.com). En desarrollo no hay endpoint.',
    country: 'País',
    entryPoint: 'Punto de entrada a la red',
    entryHint: 'El centro de datos más cercano por el que sales a internet.',
    encryption: 'Cifrado de la conexión',
    vpn: '¿VPN / Warp activo?',
    yes: 'Sí',
    no: 'No',
    connection: 'Tu conexión',
    connType: 'Tipo estimado',
    speed: 'Velocidad estimada',
    latency: 'Latencia a Dotrino',
    dataSaver: 'Ahorro de datos',
    on: 'activado',
    off: 'desactivado',
    localNet: 'Tu red local',
    localHint: 'Detecta las direcciones privadas de tu equipo en la red local. No sale de tu navegador.',
    detectLocal: 'Detectar mi red local',
    detecting: 'Detectando…',
    localMasked: 'Tu navegador oculta la dirección local por privacidad (nombre .local).',
    localNone: 'No se detectaron direcciones locales.',
    privacyNote: 'Todo se calcula al momento, contra la propia infraestructura de Dotrino. No guardamos tu IP ni la enviamos a terceros.',
  },
  en: {
    appName: 'My IP',
    tagline: 'Your IP and connection',
    yourIp: 'Your public IP',
    ipv4: 'IPv4',
    ipv6: 'IPv6',
    copy: 'Copy',
    copied: 'Copied',
    refresh: 'Refresh',
    loading: 'Checking…',
    unavailable: 'Unavailable',
    ipError: 'Could not read your IP. Retry or check your connection.',
    ipErrorDev: 'The IP only resolves in production (myip.dotrino.com). There is no endpoint in development.',
    country: 'Country',
    entryPoint: 'Network entry point',
    entryHint: 'The nearest data center you exit to the internet through.',
    encryption: 'Connection encryption',
    vpn: 'VPN / Warp active?',
    yes: 'Yes',
    no: 'No',
    connection: 'Your connection',
    connType: 'Estimated type',
    speed: 'Estimated speed',
    latency: 'Latency to Dotrino',
    dataSaver: 'Data saver',
    on: 'on',
    off: 'off',
    localNet: 'Your local network',
    localHint: 'Detects the private addresses of your device on the local network. Never leaves your browser.',
    detectLocal: 'Detect my local network',
    detecting: 'Detecting…',
    localMasked: 'Your browser hides the local address for privacy (.local name).',
    localNone: 'No local addresses detected.',
    privacyNote: 'Everything is computed on the spot, against Dotrino’s own infrastructure. We don’t store your IP or send it to third parties.',
  },
}

function detect () {
  try {
    const saved = localStorage.getItem(STORE_KEY)
    if (saved === 'es' || saved === 'en') return saved
  } catch { /* modo privado */ }
  return (navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es'
}

export const lang = ref(detect())

export function setLang (l) {
  lang.value = l
  try { localStorage.setItem(STORE_KEY, l) } catch { /* modo privado */ }
  document.documentElement.lang = l
}

document.documentElement.lang = lang.value

export function t (key) {
  const parts = key.split('.')
  let node = messages[lang.value]
  for (const p of parts) node = node && node[p]
  return node == null ? key : node
}

// Helper reactivo para plantillas (`tt.value('...')` fuerza reactividad).
export const tt = computed(() => (key) => {
  void lang.value
  return t(key)
})
