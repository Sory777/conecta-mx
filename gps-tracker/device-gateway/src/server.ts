// Gateway TCP para trackers GPS/GSM físicos (protocolo GT06).
//
// Flujo:
//  1. El tracker abre una conexión TCP y manda un paquete LOGIN con su IMEI.
//  2. Buscamos ese IMEI en device-map.json -> obtenemos el device_token.
//  3. Confirmamos el login (ACK) para que el tracker no cuelgue.
//  4. Cada vez que llega un paquete LOCATION, lo traducimos a JSON y lo
//     mandamos por HTTPS a la Edge Function ingest-position — el mismo
//     endpoint que usa la app del celular. Desde ahí para adelante, el
//     backend no distingue si el dato vino de un teléfono o de hardware.

import { createServer, type Socket } from 'node:net';
import { extractFrame, parseFrame, buildAck, PROTOCOL } from './gt06.js';
import { loadDeviceMap, tokenForImei } from './deviceRegistry.js';

const PORT = Number(process.env.GATEWAY_PORT ?? 5023);
const INGEST_URL = process.env.INGEST_URL ?? 'http://localhost:54321/functions/v1/ingest-position';

loadDeviceMap();

interface ConnectionState {
  imei?: string;
  buffer: Buffer;
}

const connections = new WeakMap<Socket, ConnectionState>();

async function forwardPosition(params: {
  token: string;
  lat: number;
  lng: number;
  speedKmh: number;
  headingDeg: number;
  recordedAt: Date;
}) {
  try {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_token: params.token,
        lat: params.lat,
        lng: params.lng,
        speed_kmh: params.speedKmh,
        heading: params.headingDeg,
        recorded_at: params.recordedAt.toISOString(),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[gateway] ingest-position respondió ${res.status}: ${body}`);
    }
  } catch (err) {
    console.error('[gateway] error reenviando posición', err);
  }
}

function handleData(socket: Socket, chunk: Buffer) {
  const state = connections.get(socket)!;
  state.buffer = Buffer.concat([state.buffer, chunk]);

  // Puede llegar más de un paquete por chunk, o un paquete partido en dos
  // chunks: por eso se procesa en bucle contra un buffer acumulado.
  while (true) {
    const result = extractFrame(state.buffer);
    if (!result) break;

    state.buffer = state.buffer.subarray(result.consumed);
    if (result.frame.length === 0) continue; // frame corrupto descartado

    const packet = parseFrame(result.frame);
    if (!packet) continue;

    if (packet.type === 'login') {
      state.imei = packet.imei;
      const token = tokenForImei(packet.imei);
      if (!token) {
        console.warn(`[gateway] IMEI ${packet.imei} no está en device-map.json, se ignoran sus datos.`);
      } else {
        console.log(`[gateway] login OK, imei=${packet.imei}`);
      }
      socket.write(buildAck(PROTOCOL.LOGIN, packet.serial));
    } else if (packet.type === 'heartbeat') {
      socket.write(buildAck(PROTOCOL.HEARTBEAT, packet.serial));
    } else if (packet.type === 'location') {
      socket.write(buildAck(PROTOCOL.LOCATION, packet.serial));

      if (!state.imei) {
        console.warn('[gateway] ubicación recibida antes de login, se ignora');
        continue;
      }
      const token = tokenForImei(state.imei);
      if (!token) continue;

      void forwardPosition({
        token,
        lat: packet.lat,
        lng: packet.lng,
        speedKmh: packet.speedKmh,
        headingDeg: packet.headingDeg,
        recordedAt: packet.recordedAt,
      });
    }
  }
}

const server = createServer((socket) => {
  connections.set(socket, { buffer: Buffer.alloc(0) });
  const remote = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[gateway] conexión nueva ${remote}`);

  socket.on('data', (chunk) => handleData(socket, chunk));
  socket.on('error', (err) => console.error(`[gateway] error en socket ${remote}`, err));
  socket.on('close', () => console.log(`[gateway] conexión cerrada ${remote}`));
});

server.listen(PORT, () => {
  console.log(`[gateway] escuchando trackers GT06 en el puerto ${PORT}`);
  console.log(`[gateway] reenviando posiciones a ${INGEST_URL}`);
});
