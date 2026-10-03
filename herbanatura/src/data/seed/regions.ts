import type { Region } from '@/lib/domain/types';
import { L } from './helpers';

const macro = (slug: string, es: string, en: string): Region => ({ slug, name: L(es, en), level: 'macro_region', parentSlug: null });

/** INEGI state codes (Marco Geoestadístico). */
const MX_STATES: [code: string, slug: string, name: string][] = [
  ['01', 'aguascalientes', 'Aguascalientes'],
  ['02', 'baja-california', 'Baja California'],
  ['03', 'baja-california-sur', 'Baja California Sur'],
  ['04', 'campeche', 'Campeche'],
  ['05', 'coahuila', 'Coahuila de Zaragoza'],
  ['06', 'colima', 'Colima'],
  ['07', 'chiapas', 'Chiapas'],
  ['08', 'chihuahua', 'Chihuahua'],
  ['09', 'ciudad-de-mexico', 'Ciudad de México'],
  ['10', 'durango', 'Durango'],
  ['11', 'guanajuato', 'Guanajuato'],
  ['12', 'guerrero', 'Guerrero'],
  ['13', 'hidalgo', 'Hidalgo'],
  ['14', 'jalisco', 'Jalisco'],
  ['15', 'estado-de-mexico', 'Estado de México'],
  ['16', 'michoacan', 'Michoacán de Ocampo'],
  ['17', 'morelos', 'Morelos'],
  ['18', 'nayarit', 'Nayarit'],
  ['19', 'nuevo-leon', 'Nuevo León'],
  ['20', 'oaxaca', 'Oaxaca'],
  ['21', 'puebla', 'Puebla'],
  ['22', 'queretaro', 'Querétaro'],
  ['23', 'quintana-roo', 'Quintana Roo'],
  ['24', 'san-luis-potosi', 'San Luis Potosí'],
  ['25', 'sinaloa', 'Sinaloa'],
  ['26', 'sonora', 'Sonora'],
  ['27', 'tabasco', 'Tabasco'],
  ['28', 'tamaulipas', 'Tamaulipas'],
  ['29', 'tlaxcala', 'Tlaxcala'],
  ['30', 'veracruz', 'Veracruz de Ignacio de la Llave'],
  ['31', 'yucatan', 'Yucatán'],
  ['32', 'zacatecas', 'Zacatecas'],
];

/** The 46 municipalities of Guanajuato (codes omitted until imported from INEGI). */
const GUANAJUATO_MUNICIPALITIES = [
  'Abasolo', 'Acámbaro', 'Apaseo el Alto', 'Apaseo el Grande', 'Atarjea', 'Celaya', 'Comonfort', 'Coroneo',
  'Cortazar', 'Cuerámaro', 'Doctor Mora', 'Dolores Hidalgo Cuna de la Independencia Nacional', 'Guanajuato',
  'Huanímaro', 'Irapuato', 'Jaral del Progreso', 'Jerécuaro', 'León', 'Manuel Doblado', 'Moroleón', 'Ocampo',
  'Pénjamo', 'Pueblo Nuevo', 'Purísima del Rincón', 'Romita', 'Salamanca', 'Salvatierra', 'San Diego de la Unión',
  'San Felipe', 'San Francisco del Rincón', 'San José Iturbide', 'San Luis de la Paz', 'San Miguel de Allende',
  'Santa Catarina', 'Santa Cruz de Juventino Rosas', 'Santiago Maravatío', 'Silao de la Victoria', 'Tarandacuao',
  'Tarimoro', 'Tierra Blanca', 'Uriangato', 'Valle de Santiago', 'Victoria', 'Villagrán', 'Xichú', 'Yuriria',
];

export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const REGIONS: Region[] = [
  macro('america-latina', 'América Latina', 'Latin America'),
  macro('asia', 'Asia', 'Asia'),
  macro('africa', 'África', 'Africa'),
  macro('europa', 'Europa', 'Europe'),
  macro('medio-oriente', 'Medio Oriente', 'Middle East'),
  macro('america-del-norte', 'América del Norte', 'North America'),
  { slug: 'pueblos-indigenas', name: L('Pueblos indígenas', 'Indigenous peoples'), level: 'cultural', parentSlug: null },
  {
    slug: 'tradiciones-historicas',
    name: L('Tradiciones medicinales históricas', 'Historical medical traditions'),
    level: 'cultural',
    parentSlug: null,
  },
  { slug: 'ayurveda', name: L('Ayurveda (India)', 'Ayurveda (India)'), level: 'cultural', parentSlug: 'asia' },
  {
    slug: 'medicina-tradicional-china',
    name: L('Medicina tradicional china', 'Traditional Chinese medicine'),
    level: 'cultural',
    parentSlug: 'asia',
  },
  {
    slug: 'grecorromana',
    name: L('Medicina grecorromana', 'Greco-Roman medicine'),
    level: 'cultural',
    parentSlug: 'tradiciones-historicas',
  },
  { slug: 'mexico', name: L('México', 'Mexico'), level: 'country', parentSlug: 'america-latina', code: 'MX' },
  { slug: 'india', name: L('India', 'India'), level: 'country', parentSlug: 'asia', code: 'IN' },
  { slug: 'china', name: L('China', 'China'), level: 'country', parentSlug: 'asia', code: 'CN' },
  { slug: 'japon', name: L('Japón', 'Japan'), level: 'country', parentSlug: 'asia', code: 'JP' },
  { slug: 'corea', name: L('Corea', 'Korea'), level: 'country', parentSlug: 'asia', code: 'KR' },
  { slug: 'estados-unidos', name: L('Estados Unidos', 'United States'), level: 'country', parentSlug: 'america-del-norte', code: 'US' },
  ...MX_STATES.map<Region>(([code, slug, name]) => ({ slug, name: L(name), level: 'state', parentSlug: 'mexico', code })),
  ...GUANAJUATO_MUNICIPALITIES.map<Region>((name) => ({
    slug: `gto-${slugify(name)}`,
    name: L(name),
    level: 'municipality',
    parentSlug: 'guanajuato',
    code: null,
  })),
];
