<script setup>
import { ref, computed, onMounted } from 'vue'
import { lang, setLang, t } from '@/i18n.js'
import iconUrl from '/icon.svg'

// ---------- estado ----------
const trace = ref(null)      // objeto parseado de /cdn-cgi/trace
const status = ref('loading') // 'loading' | 'ok' | 'error' | 'dev'
const copied = ref(false)
const conn = ref(null)       // navigator.connection
const latency = ref(null)    // ms (mínimo medido)
const localIps = ref(null)   // array | 'masked' | 'none' | null(no probado)
const detectingLocal = ref(false)

// ¿Estamos en producción same-origin (subdominio .dotrino.com tras Cloudflare)?
const isProdHost = computed(() => /(^|\.)dotrino\.com$/i.test(location.hostname))

const ip = computed(() => (trace.value && trace.value.ip) || '')
const isV6 = computed(() => ip.value.includes(':'))
const ipFamily = computed(() => (ip.value ? (isV6.value ? t('ipv6') : t('ipv4')) : ''))

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
async function copyIp () {
  if (!ip.value) return
  try { await navigator.clipboard.writeText(ip.value); copied.value = true; setTimeout(() => { copied.value = false }, 1400) }
  catch { /* sin permiso de portapapeles */ }
}
function refresh () { loadTrace(); measureLatency() }

onMounted(() => {
  loadTrace()
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

      <template v-else-if="status === 'ok'">
        <div class="ip-row">
          <span class="ip-big" data-testid="ip">{{ ip }}</span>
          <span class="fam-badge">{{ ipFamily }}</span>
        </div>
        <div class="hero-actions">
          <button class="btn btn-primary" data-testid="copy" @click="copyIp">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
            {{ copied ? t('copied') : t('copy') }}
          </button>
        </div>
      </template>

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

    <!-- LOS SALTOS: nota honesta -->
    <section class="panel">
      <h2>{{ t('hopsTitle') }}</h2>
      <p class="panel-hint" v-html="t('hopsBody')"></p>
    </section>

    <p class="privacy">{{ t('privacyNote') }}</p>
  </main>
</template>
