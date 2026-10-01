// Importa/actualiza el catálogo del proveedor y recalcula precios de las 10 tiendas.
// Uso: npm run sync            (proveedor de .env)
//      npm run sync -- cj      (forzar proveedor)
import { syncCatalog } from '../src/services/catalog.js';

const r = await syncCatalog(process.argv[2]);
console.log(`Listo: ${r.imported} productos importados de ${r.supplier}.`);
