// Identidad = vault id.dotrino.com (única fuente del ecosistema). No se
// reimplementa nada: el paquete @dotrino/identity es el shim del vault.
// Aunque Mi IP sea una utilidad local, toda app del ecosistema lleva identidad
// (CONVENCIONES §6.1): es lo que hace que quien la usa sea alguien.
import { Identity } from '@dotrino/identity'

/** @type {Identity | null} */
let identity = null

/**
 * Instancia compartida de identidad (o null si el vault no responde).
 *
 * @returns {Promise<Identity | null>}
 */
export async function getIdentity () {
  if (identity) return identity
  try {
    identity = await Identity.connect()
  } catch (e) {
    console.warn('[identity] vault unreachable:', e && /** @type {{ message?: string }} */ (e).message)
    identity = null
  }
  return identity
}

/** @returns {string | null} */
export function myPubkey () { return identity?.me?.publickey || null }
/** @returns {string | null} */
export function myName () { return identity?.me?.nickname || null }
