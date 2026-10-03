import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HerbaNatura',
    short_name: 'HerbaNatura',
    description: 'El conocimiento de la naturaleza, investigado con ciencia.',
    start_url: '/es',
    display: 'standalone',
    background_color: '#faf8f2',
    theme_color: '#1f4a29',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
