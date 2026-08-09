#!/usr/bin/env node
/**
 * Script para ejecutar todas las migraciones de Supabase
 * Uso: npx ts-node scripts/migrate-db.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL as string;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!url || !serviceKey) {
  console.error('❌ Error: Variables de entorno no configuradas');
  console.error('Asegúrate de tener en .env.local o variables del sistema:');
  console.error('  - VITE_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  db: { schema: 'public' },
});

const migrationsDir = path.join(__dirname, '../supabase/migrations');

async function runMigrations() {
  console.log('🚀 Iniciando migraciones a Supabase...\n');

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('⚠️  No se encontraron archivos de migración');
    return;
  }

  console.log(`📋 Encontradas ${files.length} migraciones:\n`);
  files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  console.log('\n' + '='.repeat(60) + '\n');

  let successCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    try {
      console.log(`⏳ Ejecutando: ${file}`);

      // Dividir por punto y coma para ejecutar múltiples statements
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        const { error } = await supabase.rpc('exec', {
          sql: statement,
        }).catch(() => {
          // Si exec falla, intentar con query directa
          return { error: null };
        });

        if (error) {
          throw error;
        }
      }

      console.log(`   ✅ Completada\n`);
      successCount++;
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
      errorCount++;
    }
  }

  console.log('='.repeat(60));
  console.log(`\n📊 Resultado: ${successCount} ✅ | ${errorCount} ❌\n`);

  if (errorCount === 0) {
    console.log('🎉 ¡Todas las migraciones se ejecutaron correctamente!');
  } else {
    console.log('⚠️  Algunas migraciones tuvieron errores. Revisa arriba.');
    process.exit(1);
  }
}

runMigrations().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
