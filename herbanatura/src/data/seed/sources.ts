import type { Source } from '@/lib/domain/types';
import { L, SEED_DATE } from './helpers';

/**
 * Institutional sources referenced by the demo dataset.
 * Only top-level public fact sheets and databases are listed — no individual
 * studies, DOIs or PMIDs are hand-written. `reviewedAt` stays null until a
 * reviewer verifies each paraphrase against the live page.
 */
const s = (
  id: string,
  kind: Source['kind'],
  title: string,
  publisher: string,
  url: string,
  language = 'en',
  notes?: Source['notes'],
): Source => ({ id, kind, title, publisher, url, language, addedAt: SEED_DATE, reviewedAt: null, notes: notes ?? null });

const NCCIH = 'National Center for Complementary and Integrative Health (NCCIH, NIH)';
const NCI = 'National Cancer Institute (NCI, NIH)';
const WHO = 'Organización Mundial de la Salud (OMS/WHO)';

export const SOURCES: Source[] = [
  // NCCIH herb fact sheets
  s('nccih-turmeric', 'government', 'Turmeric', NCCIH, 'https://www.nccih.nih.gov/health/turmeric'),
  s('nccih-chamomile', 'government', 'Chamomile', NCCIH, 'https://www.nccih.nih.gov/health/chamomile'),
  s('nccih-ginger', 'government', 'Ginger', NCCIH, 'https://www.nccih.nih.gov/health/ginger'),
  s('nccih-garlic', 'government', 'Garlic', NCCIH, 'https://www.nccih.nih.gov/health/garlic'),
  s('nccih-peppermint-oil', 'government', 'Peppermint Oil', NCCIH, 'https://www.nccih.nih.gov/health/peppermint-oil'),
  s('nccih-valerian', 'government', 'Valerian', NCCIH, 'https://www.nccih.nih.gov/health/valerian'),
  s('nccih-aloe-vera', 'government', 'Aloe Vera', NCCIH, 'https://www.nccih.nih.gov/health/aloe-vera'),
  s('nccih-asian-ginseng', 'government', 'Asian Ginseng', NCCIH, 'https://www.nccih.nih.gov/health/asian-ginseng'),
  s('nccih-green-tea', 'government', 'Green Tea', NCCIH, 'https://www.nccih.nih.gov/health/green-tea'),
  s('nccih-echinacea', 'government', 'Echinacea', NCCIH, 'https://www.nccih.nih.gov/health/echinacea'),
  s('nccih-st-johns-wort', 'government', "St. John's Wort", NCCIH, 'https://www.nccih.nih.gov/health/st-johns-wort'),
  s('nccih-ginkgo', 'government', 'Ginkgo', NCCIH, 'https://www.nccih.nih.gov/health/ginkgo'),
  s('nccih-goldenseal', 'government', 'Goldenseal', NCCIH, 'https://www.nccih.nih.gov/health/goldenseal'),
  s(
    'nccih-cannabis',
    'government',
    'Cannabis (Marijuana) and Cannabinoids: What You Need To Know',
    NCCIH,
    'https://www.nccih.nih.gov/health/cannabis-marijuana-and-cannabinoids-what-you-need-to-know',
  ),
  s('nccih-herbs-at-a-glance', 'government', 'Herbs at a Glance', NCCIH, 'https://www.nccih.nih.gov/health/herbsataglance'),
  s(
    'nccih-supplements-wisely',
    'government',
    'Using Dietary Supplements Wisely',
    NCCIH,
    'https://www.nccih.nih.gov/health/using-dietary-supplements-wisely',
  ),
  // NCI
  s('nci-cam', 'government', 'Complementary and Alternative Medicine (CAM) for cancer', NCI, 'https://www.cancer.gov/about-cancer/treatment/cam'),
  s(
    'nci-cannabis-pdq',
    'government',
    'Cannabis and Cannabinoids (PDQ®) – Health Professional Version',
    NCI,
    'https://www.cancer.gov/about-cancer/treatment/cam/hp/cannabis-pdq',
  ),
  s(
    'nci-mushrooms-pdq',
    'government',
    'Medicinal Mushrooms (PDQ®) – Health Professional Version',
    NCI,
    'https://www.cancer.gov/about-cancer/treatment/cam/hp/mushrooms-pdq',
  ),
  s(
    'nci-cruciferous',
    'government',
    'Cruciferous Vegetables and Cancer Prevention',
    NCI,
    'https://www.cancer.gov/about-cancer/causes-prevention/risk/diet/cruciferous-vegetables-fact-sheet',
  ),
  s(
    'nci-garlic',
    'government',
    'Garlic and Cancer Prevention',
    NCI,
    'https://www.cancer.gov/about-cancer/causes-prevention/risk/diet/garlic-fact-sheet',
  ),
  s(
    'nci-antioxidants',
    'government',
    'Antioxidants and Cancer Prevention',
    NCI,
    'https://www.cancer.gov/about-cancer/causes-prevention/risk/diet/antioxidants-fact-sheet',
  ),
  s('nci-causes-prevention', 'government', 'Cancer Causes and Prevention', NCI, 'https://www.cancer.gov/about-cancer/causes-prevention'),
  // WHO / IARC
  s('who-cancer', 'government', 'Cancer — Fact sheet', WHO, 'https://www.who.int/news-room/fact-sheets/detail/cancer'),
  s(
    'who-red-meat',
    'government',
    'Cancer: Carcinogenicity of the consumption of red meat and processed meat (Q&A)',
    WHO,
    'https://www.who.int/news-room/questions-and-answers/item/cancer-carcinogenicity-of-the-consumption-of-red-meat-and-processed-meat',
  ),
  s('who-tobacco', 'government', 'Tobacco — Fact sheet', WHO, 'https://www.who.int/news-room/fact-sheets/detail/tobacco'),
  s('who-alcohol', 'government', 'Alcohol — Fact sheet', WHO, 'https://www.who.int/news-room/fact-sheets/detail/alcohol'),
  s(
    'who-physical-activity',
    'government',
    'Physical activity — Fact sheet',
    WHO,
    'https://www.who.int/news-room/fact-sheets/detail/physical-activity',
  ),
  s(
    'who-traditional-medicine',
    'government',
    'Traditional, Complementary and Integrative Medicine',
    WHO,
    'https://www.who.int/health-topics/traditional-complementary-and-integrative-medicine',
  ),
  s('iarc-monographs', 'government', 'IARC Monographs on the Identification of Carcinogenic Hazards to Humans', 'International Agency for Research on Cancer (IARC)', 'https://monographs.iarc.who.int/'),
  // Clinical / drug references
  s('msk-herbs', 'academic', 'About Herbs, Botanicals & Other Products', 'Memorial Sloan Kettering Cancer Center', 'https://www.mskcc.org/cancer-care/diagnosis-treatment/symptom-management/integrative-medicine/herbs'),
  s('medlineplus-herbs', 'government', 'Herbs and Supplements', 'MedlinePlus (U.S. National Library of Medicine)', 'https://medlineplus.gov/druginfo/herb_All.html'),
  s('medlineplus-warfarin', 'government', 'Warfarin', 'MedlinePlus (U.S. National Library of Medicine)', 'https://medlineplus.gov/druginfo/meds/a682277.html'),
  s('ods', 'government', 'Office of Dietary Supplements', 'National Institutes of Health (NIH)', 'https://ods.od.nih.gov/'),
  // Bibliographic / registries
  s('pubmed', 'database', 'PubMed', 'National Library of Medicine (NLM)', 'https://pubmed.ncbi.nlm.nih.gov/'),
  s('clinicaltrials', 'database', 'ClinicalTrials.gov', 'National Library of Medicine (NLM)', 'https://clinicaltrials.gov/'),
  s('pubchem', 'database', 'PubChem', 'National Center for Biotechnology Information (NCBI)', 'https://pubchem.ncbi.nlm.nih.gov/'),
  // Botanical
  s('powo', 'database', 'Plants of the World Online', 'Royal Botanic Gardens, Kew', 'https://powo.science.kew.org/'),
  s('gbif', 'database', 'Global Biodiversity Information Facility', 'GBIF', 'https://www.gbif.org/'),
  s('enciclovida', 'database', 'EncicloVida', 'CONABIO (México)', 'https://enciclovida.mx/', 'es'),
  // Ethnobotany
  s(
    'bdmtm-unam',
    'ethnobotanical',
    'Biblioteca Digital de la Medicina Tradicional Mexicana',
    'Universidad Nacional Autónoma de México (UNAM)',
    'http://www.medicinatradicionalmexicana.unam.mx/',
    'es',
    L(
      'Fuente etnobotánica de referencia para México. Los registros que la citan están pendientes de contrastar con la monografía específica.',
      'Reference ethnobotanical source for Mexico. Records citing it are pending verification against the specific monograph.',
    ),
  ),
  s('inegi', 'government', 'Marco Geoestadístico', 'Instituto Nacional de Estadística y Geografía (INEGI)', 'https://www.inegi.org.mx/', 'es'),
];

export const SOURCE_BY_ID = new Map(SOURCES.map((x) => [x.id, x]));
