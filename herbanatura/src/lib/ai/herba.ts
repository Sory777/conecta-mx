import 'server-only';
import { z } from 'zod/v4';
import type { Locale, Source } from '@/lib/domain/types';
import type { KnowledgeRepository } from '@/lib/data/repository';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { serverEnv } from '@/lib/env';
import { log } from '@/lib/logger';
import { triage, type TriageResult } from '@/lib/safety/triage';
import { structuredCall } from './anthropic';
import { computeConfidence, renderDocuments, retrieve, type Confidence, type RagDocument } from './context';
import { guardAnswer } from './guard';
import { HERBA_SYSTEM_PROMPT } from './prompts';

export interface HerbaAnswer {
  mode: 'generative' | 'extractive' | 'emergency';
  answer: string;
  simple: string;
  gaps: string[];
  confidence: Confidence;
  triage: TriageResult;
  documents: Pick<RagDocument, 'key' | 'kind' | 'title' | 'level' | 'reviewStatus'>[];
  sources: Source[];
  disclaimers: string[];
  model?: string;
  removedReferences?: number;
}

const AnswerSchema = z.object({
  answer: z.string().describe('Answer with [Dn] citation keys after each factual sentence.'),
  simple: z.string().describe('Beginner-friendly version, same rules, with [Dn] keys.'),
  gaps: z.array(z.string()).describe('What the documents cannot answer.'),
});

function extractive(docs: RagDocument[], locale: Locale, dict: Dictionary): Pick<HerbaAnswer, 'answer' | 'simple' | 'gaps'> {
  if (!docs.length) {
    const none = locale === 'es' ? 'HerbaNatura no tiene información verificada para responder esta pregunta.' : 'HerbaNatura has no verified information to answer this question.';
    return { answer: none, simple: none, gaps: [] };
  }
  const head = locale === 'es' ? 'Esto es lo que contiene la base de conocimiento (sin generación automática):' : 'This is what the knowledge base contains (no automatic generation):';
  const lines = docs.slice(0, 12).map((d) => `- **${d.title}**: ${d.text.split('\n')[0]} [${d.key}]`);
  const simple = docs.filter((d) => d.kind === 'claim').slice(0, 5).map((d) => {
    const s = d.text.split('\n').find((l) => l.startsWith(dict.claim.simple));
    return `- ${s ? s.replace(`${dict.claim.simple}: `, '') : d.text.split('\n')[0]} [${d.key}]`;
  });
  return { answer: [head, ...lines].join('\n'), simple: simple.join('\n') || lines.slice(0, 3).join('\n'), gaps: [] };
}

export async function askHerba(repo: KnowledgeRepository, question: string, locale: Locale, dict: Dictionary): Promise<HerbaAnswer> {
  const t = triage(question);
  const disclaimers = [dict.disclaimers.general];
  if (t.cancerTreatmentIntent) disclaimers.unshift(dict.disclaimers.cancer);
  if (t.stopTreatmentIntent) disclaimers.unshift(dict.disclaimers.stopTreatment);
  if (t.pregnancyMention) disclaimers.unshift(dict.disclaimers.pregnancy);

  // Emergencies short-circuit: no remedies, no model call.
  if (t.withholdRemedies) {
    const body = [dict.disclaimers.emergencyTitle, dict.disclaimers.emergencyBody, t.emergency.includes('self_harm') ? dict.disclaimers.selfHarm : '', t.emergency.includes('poisoning') ? dict.disclaimers.poisoning : '']
      .filter(Boolean)
      .join('\n\n');
    return { mode: 'emergency', answer: body, simple: body, gaps: [], confidence: 'insufficient', triage: t, documents: [], sources: [], disclaimers };
  }

  const { documents } = await retrieve(repo, question, locale, dict);
  const confidence = computeConfidence(documents);
  const sourcesOf = (keys: string[]) => {
    const m = new Map<string, Source>();
    documents.filter((d) => keys.includes(d.key)).forEach((d) => d.sources.forEach((s) => m.set(s.id, s)));
    return [...m.values()];
  };
  const docMeta = documents.map(({ key, kind, title, level, reviewStatus }) => ({ key, kind, title, level, reviewStatus }));

  if (serverEnv.aiProvider === 'anthropic' && documents.length) {
    try {
      const lang = locale === 'es' ? 'Spanish (Mexico)' : 'English';
      const result = await structuredCall({
        system: HERBA_SYSTEM_PROMPT,
        schema: AnswerSchema,
        content: [
          {
            type: 'text',
            text: `<documents>\n${renderDocuments(documents)}\n</documents>\n\n<flags cancer_treatment_intent="${t.cancerTreatmentIntent}" stop_treatment_intent="${t.stopTreatmentIntent}" pregnancy="${t.pregnancyMention}" />\n\nAnswer language: ${lang}.\n\n<question>${question}</question>`,
          },
        ],
      });
      if (result) {
        const a = guardAnswer(result.data.answer, documents);
        const s = guardAnswer(result.data.simple, documents);
        if (a.cited.length) {
          const cited = [...new Set([...a.cited, ...s.cited])];
          return {
            mode: 'generative',
            answer: a.text,
            simple: s.text,
            gaps: result.data.gaps.slice(0, 8),
            confidence,
            triage: t,
            documents: docMeta,
            sources: sourcesOf(cited),
            disclaimers,
            model: result.model,
            removedReferences: a.removed + s.removed,
          };
        }
        log.warn('ai_answer_without_citations');
      }
    } catch (err) {
      log.error('ai_call_failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  const ex = extractive(documents, locale, dict);
  return { mode: 'extractive', ...ex, confidence, triage: t, documents: docMeta, sources: sourcesOf(documents.map((d) => d.key)), disclaimers };
}
