# Mi IP — Dotrino

Muestra tu **IP pública** al instante, junto con los datos de tu conexión: país,
punto de entrada a la red, cifrado, si usas VPN, tipo de conexión y latencia.
También detecta la IP de tu equipo en la **red local**.

Todo se calcula contra la propia infraestructura de Dotrino: ni un servicio de
terceros ni un solo script ajeno.

PWA instalable. Bilingüe (es/en).

## Stack

Vite + Vue 3 + `vite-plugin-pwa`. Pilares: `@dotrino/identity`,
`@dotrino/reputation`, `@dotrino/topbar`, `@dotrino/install`.

## Desarrollo

```sh
npm install
npm run dev        # http://localhost:3140
npm run build      # → dist/
npm run type-check
```

## Deploy

GitHub Actions construye `dist/` y lo publica en Pages bajo
**`https://myip.dotrino.com/`** (`.github/workflows/deploy.yml`).

## Privacidad

Tu IP se te muestra a ti y no se guarda en ninguna parte. No hay servicios de
geolocalización de terceros. Analítica cookieless autohospedada (GoatCounter),
agregada y sin datos personales.

## Licencia

MIT — © Dotrino
