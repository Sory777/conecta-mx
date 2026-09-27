import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import {
  AIOutputError,
  AIRefusalError,
  type AIProvider,
  type JSONRequest,
  type ProviderResult,
  type ResearchRequest,
  type ResearchResult,
  type TextRequest,
  type Usage,
} from './provider';

// Haiku 4.5 rejects the effort parameter; the 5-series models accept it.
const supportsEffort = (model: string) => !model.startsWith('claude-haiku');
// Server-side refusal fallback is available for the Opus 5 family.
const supportsFallback = (model: string) => model.startsWith('claude-opus-5');

function usageOf(u: {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
}): Usage {
  return {
    input_tokens: u.input_tokens,
    output_tokens: u.output_tokens,
    cache_read_tokens: u.cache_read_input_tokens ?? 0,
  };
}

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  }

  async generateJSON<T>(req: JSONRequest<T>): Promise<ProviderResult<T>> {
    const fallback = supportsFallback(req.model);
    const response = await this.client.beta.messages.parse({
      model: req.model,
      max_tokens: req.maxTokens,
      // Stable system prompt first so repeated calls share a cacheable prefix.
      system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: req.user }],
      output_config: {
        format: betaZodOutputFormat(req.schema),
        ...(req.effort && supportsEffort(req.model) ? { effort: req.effort } : {}),
      },
      ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });
    if (response.stop_reason === 'refusal') throw new AIRefusalError(`refusal in ${req.task}`);
    if (response.stop_reason === 'max_tokens') throw new AIOutputError(`truncated output in ${req.task}`);
    if (!response.parsed_output) throw new AIOutputError(`unparseable output in ${req.task}`);
    return { data: response.parsed_output as T, usage: usageOf(response.usage), model: response.model };
  }

  async generateText(req: TextRequest): Promise<ProviderResult<string>> {
    const response = await this.client.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
      messages: req.messages,
      ...(req.effort && supportsEffort(req.model) ? { output_config: { effort: req.effort } } : {}),
    });
    if (response.stop_reason === 'refusal') throw new AIRefusalError(`refusal in ${req.task}`);
    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();
    return { data: text, usage: usageOf(response.usage), model: response.model };
  }

  async research(req: ResearchRequest): Promise<ProviderResult<ResearchResult>> {
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: req.query }];
    const usage: Usage = { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0 };
    let response: Anthropic.Message | null = null;
    // The server-side search loop may pause; resume by re-sending the assistant turn.
    for (let i = 0; i < 3; i++) {
      response = await this.client.messages.create({
        model: req.model,
        max_tokens: 8000,
        system: req.system,
        messages,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: req.maxSearches }],
        output_config: { effort: 'low' },
      });
      const u = usageOf(response.usage);
      usage.input_tokens += u.input_tokens;
      usage.output_tokens += u.output_tokens;
      usage.cache_read_tokens += u.cache_read_tokens;
      if (response.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: response.content });
    }
    if (!response || response.stop_reason === 'refusal') throw new AIRefusalError('refusal in research');

    const found = new Map<string, { url: string; title: string; page_age: string | null }>();
    const cited = new Set<string>();
    let brief = '';
    for (const block of response.content) {
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) found.set(r.url, { url: r.url, title: r.title, page_age: r.page_age ?? null });
      } else if (block.type === 'text') {
        brief += block.text;
        for (const c of block.citations ?? []) {
          if (c.type === 'web_search_result_location') cited.add(c.url);
        }
      }
    }
    // Prefer sources the model actually cited; fall back to what it found.
    const sources = [...found.values()].filter((s) => cited.size === 0 || cited.has(s.url)).slice(0, 8);
    return { data: { brief: brief.trim(), sources }, usage, model: response.model };
  }
}
