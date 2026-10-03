import { describe, expect, it } from 'vitest';
import { parseFileName } from './filename';
import { parseId3 } from './id3';

describe('parseFileName', () => {
  it('separa artista y título', () => {
    expect(parseFileName('01. Daft Punk - One More Time.mp3')).toEqual({
      artist: 'Daft Punk',
      title: 'One More Time',
    });
    expect(parseFileName('Artista_X – Tema (Extended Mix).wav')).toEqual({
      artist: 'Artista X',
      title: 'Tema (Extended Mix)',
    });
  });
  it('sin separador: todo es título', () => {
    expect(parseFileName('grabacion.m4a')).toEqual({ artist: '', title: 'grabacion' });
  });
});

function frame(id: string, text: string): number[] {
  const body = [3, ...new TextEncoder().encode(text)];
  const n = body.length;
  return [...id].map((c) => c.charCodeAt(0)).concat([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255, 0, 0], body);
}

describe('parseId3', () => {
  it('lee TIT2, TPE1, TBPM y TKEY (v2.3)', () => {
    const frames = [...frame('TIT2', 'Canción'), ...frame('TPE1', 'Artista'), ...frame('TBPM', '124'), ...frame('TKEY', '8A')];
    const size = frames.length + 16; // con padding
    const header = [0x49, 0x44, 0x33, 3, 0, 0, (size >> 21) & 127, (size >> 14) & 127, (size >> 7) & 127, size & 127];
    const tags = parseId3(new Uint8Array([...header, ...frames, ...new Array(16).fill(0)]));
    expect(tags).toEqual({ title: 'Canción', artist: 'Artista', bpm: 124, key: '8A' });
  });
  it('ignora archivos sin ID3', () => {
    expect(parseId3(new Uint8Array(20))).toBeNull();
  });
});
