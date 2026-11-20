// Crea la versión de archivo único AVGH-app.html (se puede abrir con doble clic,
// sin necesidad de servidor). Genera dist/AVGH-app.html y una copia en la raíz.
import { build } from 'vite'
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs'

await build({ configFile: 'vite.singlefile.config.js' })

const outDir = 'dist-singlefile'
const html = readdirSync(outDir).find((f) => f.endsWith('.html'))
if (!html) {
  console.error('No se encontró el HTML generado')
  process.exit(1)
}

if (!existsSync('dist')) mkdirSync('dist')
copyFileSync(`${outDir}/${html}`, 'dist/AVGH-app.html')
copyFileSync(`${outDir}/${html}`, 'AVGH-app.html')
console.log('✅ Versión de archivo único creada:')
console.log('   -> AVGH-app.html  (en la raíz del proyecto)')
console.log('   Ábrela con doble clic. No necesita servidor.')
process.exit(0)