// Mapa IMEI -> device_token.
//
// El tracker físico solo sabe su IMEI (viene grabado de fábrica). El token
// de dispositivo lo generó el dueño una vez desde el dashboard web
// (RPC create_device) y se lo pega aquí, en este archivo de configuración
// del gateway. Es la misma idea que el token que se pega en la app del
// celular (ver web/src/pages/DriverPage.tsx), solo que aquí vive en el
// servidor en vez de en el dispositivo del usuario porque un tracker GT06
// no tiene forma de "teclear" un token largo.
//
// En producción esto normalmente se reemplaza por una consulta a una tabla
// propia del gateway (o a Supabase, guardando el token cifrado) en vez de
// un archivo plano. Para el alcance de este proyecto, un JSON es más que
// suficiente y fácil de entender.

import { readFileSync, existsSync } from 'node:fs';

export interface DeviceMap {
  [imei: string]: string; // imei -> device_token en claro
}

const MAP_FILE = process.env.DEVICE_MAP_FILE ?? new URL('../device-map.json', import.meta.url).pathname;

let cache: DeviceMap = {};

export function loadDeviceMap(): DeviceMap {
  if (!existsSync(MAP_FILE)) {
    console.warn(`[deviceRegistry] No existe ${MAP_FILE}. Copia device-map.example.json y llénalo.`);
    cache = {};
    return cache;
  }
  const raw = readFileSync(MAP_FILE, 'utf-8');
  cache = JSON.parse(raw) as DeviceMap;
  return cache;
}

export function tokenForImei(imei: string): string | undefined {
  return cache[imei];
}
