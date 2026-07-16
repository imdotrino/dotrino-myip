<script setup>
import { ref, computed, onMounted } from 'vue'
import { lang, setLang, t } from '@/i18n.js'
import iconUrl from '/icon.svg'

// ---------- estado ----------
const trace = ref(null)      // objeto parseado de /cdn-cgi/trace
const status = ref('loading') // 'loading' | 'ok' | 'error' | 'dev'
const conn = ref(null)       // navigator.connection
const latency = ref(null)    // ms (mínimo medido)
const localIps = ref(null)   // array | 'masked' | 'none' | null(no probado)
const detectingLocal = ref(false)
const ip4remote = ref('')    // IPv4 leída del endpoint solo-IPv4 (ipv4.dotrino.com)
const ip6remote = ref('')    // IPv6 leída del endpoint solo-IPv6 (ipv6.dotrino.com)
const copiedKey = ref('')

// ¿Estamos en producción same-origin (subdominio .dotrino.com tras Cloudflare)?
const isProdHost = computed(() => /(^|\.)dotrino\.com$/i.test(location.hostname))

// La IP del trace es la que usó tu navegador (IPv6 en dual-stack por Happy Eyeballs).
const traceIp = computed(() => (trace.value && trace.value.ip) || '')
// IPv6 = la del trace si es v6. IPv4 = la del endpoint solo-IPv4, o la del trace si fue v4.
const v4 = computed(() => ip4remote.value || (traceIp.value && !traceIp.value.includes(':') ? traceIp.value : ''))
const v6 = computed(() => ip6remote.value || (traceIp.value.includes(':') ? traceIp.value : ''))
const ips = computed(() => {
  const out = []
  if (v4.value) out.push({ key: 'v4', fam: t('ipv4'), value: v4.value })
  if (v6.value) out.push({ key: 'v6', fam: t('ipv6'), value: v6.value })
  return out
})

const countryName = computed(() => {
  const code = trace.value && trace.value.loc
  if (!code) return ''
  try { return new Intl.DisplayNames([lang.value], { type: 'region' }).of(code) || code }
  catch { return code }
})
const flag = computed(() => {
  const code = trace.value && trace.value.loc
  if (!code || code.length !== 2) return ''
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)))
})
const encryption = computed(() => {
  if (!trace.value) return ''
  const parts = []
  if (trace.value.tls) parts.push(trace.value.tls)
  if (trace.value.http) parts.push(trace.value.http.toUpperCase())
  return parts.join(' · ')
})
const warpOn = computed(() => trace.value && trace.value.warp && trace.value.warp !== 'off')

const speed = computed(() => {
  if (!conn.value || !conn.value.downlink) return ''
  return `${conn.value.downlink} Mbps`
})

// ---------- IP + red (Cloudflare trace, mismo origen: cero terceros) ----------
async function loadTrace () {
  status.value = 'loading'
  trace.value = null
  try {
    const res = await fetch('/cdn-cgi/trace', { cache: 'no-store' })
    if (!res.ok) throw new Error('http ' + res.status)
    const text = await res.text()
    const obj = {}
    text.trim().split('\n').forEach((line) => {
      const i = line.indexOf('=')
      if (i > 0) obj[line.slice(0, i)] = line.slice(i + 1)
    })
    if (!obj.ip) throw new Error('no ip')
    trace.value = obj
    status.value = 'ok'
  } catch {
    status.value = isProdHost.value ? 'error' : 'dev'
  }
}

// ---------- IPv4 / IPv6 explícitas (endpoints por familia de Dotrino) ----------
// El navegador elige la familia (prefiere IPv6), así que el trace suele dar solo
// una. Para tener AMBAS se pregunta a un host solo-IPv4 (ipv4.dotrino.com, solo
// registro A → fuerza IPv4) y a uno solo-IPv6 (ipv6.dotrino.com, solo AAAA). Cada
// endpoint devuelve la IP en texto plano con CORS. Si el cliente no tiene esa
// familia (o el endpoint no responde), la petición falla y esa línea no se muestra.
const IP4_URL = 'https://ipv4.dotrino.com/'
const IP6_URL = 'https://ipv6.dotrino.com/'
async function fetchIp (url, isV6) {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return ''
    const txt = (await res.text()).trim()
    const ok = isV6 ? (txt.includes(':') && /^[0-9a-fA-F:]+$/.test(txt)) : /^(\d{1,3}\.){3}\d{1,3}$/.test(txt)
    return ok ? txt : ''
  } catch { return '' }
}
async function loadIp4 () { ip4remote.value = await fetchIp(IP4_URL, false) }
async function loadIp6 () { ip6remote.value = await fetchIp(IP6_URL, true) }

// ---------- latencia (RTT mínimo contra un asset de mismo origen) ----------
async function measureLatency () {
  latency.value = null
  const times = []
  for (let i = 0; i < 4; i++) {
    const start = performance.now()
    try { await fetch(`/icon.svg?ts=${i}-${start}`, { cache: 'no-store' }) }
    catch { return }
    times.push(performance.now() - start)
  }
  if (times.length) latency.value = Math.round(Math.min(...times))
}

// ---------- IP local (WebRTC, solo candidatos host; SIN STUN → sin terceros) ----------
async function detectLocal () {
  detectingLocal.value = true
  localIps.value = null
  const found = new Set()
  let masked = false
  try {
    const pc = new RTCPeerConnection() // sin iceServers → solo candidatos locales
    pc.createDataChannel('x')
    pc.onicecandidate = (e) => {
      if (!e.candidate) return
      const cand = e.candidate.candidate || ''
      const m = cand.match(/([0-9a-fA-F.:]+)\s+\d+\s+typ\s+host/) || cand.match(/(\d+\.\d+\.\d+\.\d+)/)
      const addr = m && m[1]
      if (!addr) return
      if (/\.local$/i.test(addr) || /\.local$/i.test(cand)) { masked = true; return }
      // Muestra las direcciones reales de la interfaz: IPv4 privada de LAN y/o la
      // IPv6 (que en IPv6, sin NAT, es la propia dirección del equipo).
      if (addr && addr !== '0.0.0.0') found.add(addr)
    }
    await pc.setLocalDescription(await pc.createOffer())
    await new Promise((r) => setTimeout(r, 1200))
    try { pc.close() } catch { /* noop */ }
  } catch { /* WebRTC no disponible */ }
  detectingLocal.value = false
  if (found.size) localIps.value = [...found]
  else localIps.value = masked ? 'masked' : 'none'
}

// ---------- acciones ----------
async function copyVal (item) {
  try {
    await navigator.clipboard.writeText(item.value)
    copiedKey.value = item.key
    setTimeout(() => { if (copiedKey.value === item.key) copiedKey.value = '' }, 1400)
  } catch { /* sin permiso de portapapeles */ }
}
function refresh () { loadTrace(); loadIp4(); loadIp6(); measureLatency() }

onMounted(() => {
  loadTrace()
  loadIp4()
  loadIp6()
  measureLatency()
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  if (c) conn.value = c
})
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <img :src="iconUrl" alt="" />
      <b>{{ t('appName') }}</b>
      <span>· {{ t('tagline') }}</span>
    </div>
    <div class="topbar-actions">
      <dotrino-install
        class="install-btn"
        :lang="lang"
        style="--cc-install-color:var(--text);--cc-install-bg:var(--bg-elev);--cc-install-bg-hover:var(--bg-elev);--cc-install-radius:999px;--cc-install-pad:9px 15px;--cc-install-font-size:.9rem;--cc-install-accent:var(--accent);--cc-install-modal-bg:#161b22;--cc-install-modal-color:var(--text)"
      ></dotrino-install>
      <button class="btn btn-ghost" data-testid="refresh" @click="refresh">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
        {{ t('refresh') }}
      </button>
      <div class="lang-selector" role="group" aria-label="es / en">
        <button :class="{ on: lang === 'es' }" @click="setLang('es')">ES</button>
        <button :class="{ on: lang === 'en' }" @click="setLang('en')">EN</button>
      </div>
    </div>
  </header>

  <main class="wrap">
    <!-- HÉROE: la IP pública -->
    <section class="hero">
      <span class="hero-label">{{ t('yourIp') }}</span>

      <div v-if="status === 'loading'" class="ip-big muted" data-testid="ip">{{ t('loading') }}</div>

      <div v-else-if="status === 'ok'" class="ip-stack" data-testid="ip">
        <div v-for="item in ips" :key="item.key" class="ip-line" :data-testid="'ip-' + item.key">
          <span class="fam-badge">{{ item.fam }}</span>
          <span class="ip-big">{{ item.value }}</span>
          <button class="btn btn-ghost btn-copy" :data-testid="'copy-' + item.key" :aria-label="t('copy')" @click="copyVal(item)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
            {{ copiedKey === item.key ? t('copied') : t('copy') }}
          </button>
        </div>
      </div>

      <div v-else class="ip-big muted err" data-testid="ip">
        {{ status === 'dev' ? t('ipErrorDev') : t('ipError') }}
      </div>
    </section>

    <!-- DETALLES de la conexión -->
    <section v-if="status === 'ok'" class="grid" data-testid="details">
      <div v-if="countryName" class="card">
        <span class="card-k">{{ t('country') }}</span>
        <span class="card-v">{{ flag }} {{ countryName }}</span>
      </div>
      <div v-if="trace.colo" class="card">
        <span class="card-k">{{ t('entryPoint') }}</span>
        <span class="card-v">{{ trace.colo }}</span>
        <span class="card-hint">{{ t('entryHint') }}</span>
      </div>
      <div v-if="encryption" class="card">
        <span class="card-k">{{ t('encryption') }}</span>
        <span class="card-v">{{ encryption }}</span>
      </div>
      <div class="card">
        <span class="card-k">{{ t('vpn') }}</span>
        <span class="card-v">{{ warpOn ? t('yes') : t('no') }}</span>
      </div>
    </section>

    <!-- TU CONEXIÓN (client-side) -->
    <section class="grid">
      <div v-if="conn && conn.effectiveType" class="card">
        <span class="card-k">{{ t('connType') }}</span>
        <span class="card-v">{{ conn.effectiveType.toUpperCase() }}</span>
      </div>
      <div v-if="speed" class="card">
        <span class="card-k">{{ t('speed') }}</span>
        <span class="card-v">{{ speed }}</span>
      </div>
      <div class="card">
        <span class="card-k">{{ t('latency') }}</span>
        <span class="card-v">{{ latency == null ? '…' : latency + ' ms' }}</span>
      </div>
      <div v-if="conn && 'saveData' in conn" class="card">
        <span class="card-k">{{ t('dataSaver') }}</span>
        <span class="card-v">{{ conn.saveData ? t('on') : t('off') }}</span>
      </div>
    </section>

    <!-- RED LOCAL (WebRTC, sin terceros) -->
    <section class="panel">
      <h2>{{ t('localNet') }}</h2>
      <p class="panel-hint">{{ t('localHint') }}</p>
      <button class="btn btn-ghost" data-testid="detect-local" :disabled="detectingLocal" @click="detectLocal">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="14" width="20" height="8" rx="2" /><path d="M6 18h.01M12 6v4M8 4h8a2 2 0 0 1 2 2v4H6V6a2 2 0 0 1 2-2Z" /></svg>
        {{ detectingLocal ? t('detecting') : t('detectLocal') }}
      </button>
      <div v-if="Array.isArray(localIps)" class="ip-list" data-testid="local-ips">
        <code v-for="l in localIps" :key="l">{{ l }}</code>
      </div>
      <p v-else-if="localIps === 'masked'" class="panel-note">{{ t('localMasked') }}</p>
      <p v-else-if="localIps === 'none'" class="panel-note">{{ t('localNone') }}</p>
    </section>

    <p class="privacy">{{ t('privacyNote') }}</p>
  </main>
</template>
