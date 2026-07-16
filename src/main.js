import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

// Web Components compartidos del ecosistema (custom elements, no Vue):
// instalar PWA. El topbar (App.vue) trae support, perfil y el "volver".
import '@dotrino/install'
import { registerSW } from 'virtual:pwa-register'

// SW con auto-actualización REAL: recarga al tomar control el SW nuevo y
// re-chequea cada 30 min (si no, la PWA instalada en móvil se queda vieja).
registerSW({
  immediate: true,
  onRegisteredSW (_url, reg) {
    if (!reg) return
    setInterval(() => { reg.update().catch(() => {}) }, 30 * 60_000)
  },
})

// La navegación "volver" unificada (botón físico Android / gesto iOS / atrás del
// navegador) la instala el propio <dotrino-topbar> con su <dotrino-back>: no se
// duplica aquí.

createApp(App).mount('#app')
