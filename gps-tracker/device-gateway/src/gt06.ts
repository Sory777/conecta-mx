// Decodificador simplificado del protocolo GT06.
//
// GT06 es el protocolo (no oficial, pero de facto estándar) que hablan la
// mayoría de los trackers GPS/GSM baratos ("TK103", "GT06N", muchos clones
// chinos). Un tracker real: se le pone un chip SIM, se configura la IP y
// puerto del servidor (este gateway), y al encender abre una conexión TCP
// que mantiene viva, mandando paquetes binarios.
//
// Esta implementación cubre los dos paquetes esenciales para tener rastreo
// funcionando (login + ubicación). NO es una implementación completa del
// protocolo (hay variantes por fabricante, paquetes LBS, alarmas, etc.).
// Para producción real se recomienda una librería madura o el proyecto
// Traccar (open source, soporta ~200 protocolos de hardware GPS).
//
// Estructura de un paquete GT06:
//   [0x78 0x78] [longitud] [protocolo] [contenido...] [serial:2] [crc:2] [0x0D 0x0A]
//
// Protocolos que manejamos:
//   0x01       -> login (el tracker se identifica con su IMEI)
//   0x12       -> ubicación GPS
//   0x13       -> heartbeat / estado (batería, señal) — lo confirmamos pero no lo parseamos

const START_BYTES = Buffer.from([0x78, 0x78]);
const STOP_BYTES = Buffer.from([0x0d, 0x0a]);

export const PROTOCOL = {
  LOGIN: 0x01,
  LOCATION: 0x12,
  HEARTBEAT: 0x13,
} as const;

export interface LoginPacket {
  type: 'login';
  imei: string;
  serial: number;
}

export interface LocationPacket {
  type: 'location';
  imei: string; // se resuelve desde el estado de la conexión, no viene en este paquete
  lat: number;
  lng: number;
  speedKmh: number;
  headingDeg: number;
  recordedAt: Date;
  serial: number;
}

export interface HeartbeatPacket {
  type: 'heartbeat';
  serial: number;
}

export type ParsedPacket = LoginPacket | LocationPacket | HeartbeatPacket | null;

/** CRC-ITU (X.25), el que usa GT06 sobre [longitud..antes del crc]. */
function crcItu(buf: Buffer): number {
  let fcs = 0xffff;
  for (const byte of buf) {
    fcs ^= byte;
    for (let i = 0; i < 8; i++) {
      if (fcs & 1) {
        fcs = (fcs >> 1) ^ 0x8408;
      } else {
        fcs >>= 1;
      }
    }
  }
  return (~fcs) & 0xffff;
}

/**
 * Busca un paquete completo al inicio del buffer. Devuelve el paquete crudo
 * y cuántos bytes consumir, o null si todavía no hay un paquete completo
 * (hay que esperar más datos del socket).
 */
export function extractFrame(buffer: Buffer): { frame: Buffer; consumed: number } | null {
  const start = buffer.indexOf(START_BYTES);
  if (start === -1) return null;
  if (buffer.length < start + 3) return null; // aún no llega ni la longitud

  const length = buffer[start + 2]; // largo de "protocolo + contenido + serial + crc"
  const totalLen = 2 /* start */ + 1 /* length byte */ + length + 2 /* stop */;

  if (buffer.length < start + totalLen) return null; // paquete incompleto

  const frame = buffer.subarray(start, start + totalLen);
  const stop = frame.subarray(frame.length - 2);
  if (!stop.equals(STOP_BYTES)) {
    // Frame corrupto: descarta solo el start byte encontrado y reintenta.
    return { frame: Buffer.alloc(0), consumed: start + 2 };
  }

  return { frame, consumed: start + totalLen };
}

export function parseFrame(frame: Buffer): ParsedPacket {
  if (frame.length < 7) return null;

  const length = frame[2];
  const protocol = frame[3];
  const content = frame.subarray(4, 2 + 1 + length - 2); // sin serial+crc
  const serial = frame.readUInt16BE(2 + 1 + length - 4);

  switch (protocol) {
    case PROTOCOL.LOGIN: {
      // Contenido: 8 bytes IMEI en BCD (cada byte = 2 dígitos decimales).
      const imeiBcd = content.subarray(0, 8);
      const imei = imeiBcd.toString('hex').replace(/^0+/, '');
      return { type: 'login', imei, serial };
    }

    case PROTOCOL.LOCATION: {
      // Contenido: fecha(6) + satelites(1) + lat(4) + lng(4) + velocidad(1) + curso/estado(2)
      const yy = content[0];
      const mm = content[1];
      const dd = content[2];
      const hh = content[3];
      const min = content[4];
      const ss = content[5];

      const rawLat = content.readUInt32BE(7);
      const rawLng = content.readUInt32BE(11);
      const speedKmh = content[15];
      const courseStatus = content.readUInt16BE(16);

      // Fórmula estándar GT06: grados = raw / 30000 / 60
      let lat = rawLat / 30000 / 60;
      let lng = rawLng / 30000 / 60;

      const isSouth = ((courseStatus >> 10) & 0x1) === 0; // bit "north/south" invertido en varios firmwares
      const isWest = ((courseStatus >> 11) & 0x1) === 1;
      if (isSouth) lat = -lat;
      if (isWest) lng = -lng;

      const headingDeg = courseStatus & 0x3ff; // 10 bits menos significativos

      const recordedAt = new Date(Date.UTC(2000 + yy, mm - 1, dd, hh, min, ss));

      return {
        type: 'location',
        imei: '', // se completa en server.ts con el IMEI de la sesión
        lat,
        lng,
        speedKmh,
        headingDeg,
        recordedAt,
        serial,
      };
    }

    case PROTOCOL.HEARTBEAT:
      return { type: 'heartbeat', serial };

    default:
      return null;
  }
}

/** Construye el ACK que el tracker espera para no reintentar / cortar la conexión. */
export function buildAck(protocol: number, serial: number): Buffer {
  const content = Buffer.from([protocol]);
  const serialBuf = Buffer.alloc(2);
  serialBuf.writeUInt16BE(serial, 0);

  const length = content.length + serialBuf.length + 2; // + crc
  const body = Buffer.concat([Buffer.from([length]), content, serialBuf]);
  const crc = crcItu(body);
  const crcBuf = Buffer.alloc(2);
  crcBuf.writeUInt16BE(crc, 0);

  return Buffer.concat([START_BYTES, body, crcBuf, STOP_BYTES]);
}
