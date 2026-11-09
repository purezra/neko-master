import { describe, expect, it } from 'vitest';
import { getDiagnosticConnectionStatus } from '@neko-master/shared';
import type { DiagnosticConnection } from '@neko-master/shared';
import { matchesDiagnosticService } from './service-filter.js';

const row = (overrides: Partial<DiagnosticConnection> = {}): DiagnosticConnection => ({
  id: 'test', host: '', destinationIP: '', destinationPort: '443', sourceIP: '', sourcePort: '', network: 'tcp',
  process: '', chains: ['DIRECT'], rule: 'Match', rulePayload: '', upload: 0, download: 0, start: '',
  firstSeen: 1000, lastSeen: 12_000, active: true, ...overrides,
});

describe('service quick filters', () => {
  it.each([
    ['chatgpt', 'ab.chatgpt.com'], ['chatgpt', 'persistent.oaistatic.com'], ['chatgpt', 'files.oaiusercontent.com'],
    ['gemini', 'gemini.google.com'], ['gemini', 'generativelanguage.googleapis.com'],
    ['grok', 'grok.x.com'], ['grok', 'cli-chat-proxy.grok.com'], ['perplexity', 'pplx-res.cloudinary.com'],
    ['telegram', 'api.telegram.org'], ['twitter', 'video.twimg.com'], ['claude', 'downloads.claude.ai'],
    ['workbuddy', 'www.workbuddy.ai'], ['cursor', 'api3.cursor.sh'], ['cursor', 'agent-stores.s3.us-east-1.amazonaws.com'],
    ['opencode', 'models.opencode.ai'], ['github', 'raw.githubusercontent.com'], ['tabbit', 'web.tabbit.com'],
    ['alma', 'relay.alma.now'], ['muse', 'hatch.metaaivm.com'], ['cline', 'api.cline.bot'],
    ['downloads', 'release-assets.githubusercontent.com'], ['cloudflare', 'challenges.cloudflare.com'], ['youtube', 'rr3---sn-abc.googlevideo.com'],
  ] as const)('matches %s at %s', (service, host) => {
    expect(matchesDiagnosticService(row({ host }), service)).toBe(true);
  });

  it.each([
    ['telegram', 'gemini.google.com'], ['gemini', 'www.google.com'], ['gemini', 'storage.googleapis.com'],
    ['perplexity', 'other.s3.amazonaws.com'], ['chatgpt', 'fakechatgpt.com'], ['chatgpt', 'chatgpt.com.example.org'],
    ['twitter', 'grok.x.com'], ['cloudflare', 'speed.cloudflare.com'],
  ] as const)('does not overmatch %s at %s', (service, host) => {
    expect(matchesDiagnosticService(row({ host }), service)).toBe(false);
  });

  it('matches IP-only traffic via rule-set payloads and nested service policies', () => {
    expect(matchesDiagnosticService(row({ rulePayload: 'telegram_ip' }), 'telegram')).toBe(true);
    expect(matchesDiagnosticService(row({ chains: ['HK-01', 'tg-a2', '📲 Telegram'] }), 'telegram')).toBe(true);
    expect(matchesDiagnosticService(row({ chains: ['HK-01', 'openai-fb', '🧠 OpenAI/Codex'] }), 'chatgpt')).toBe(true);
    expect(matchesDiagnosticService(row({ chains: ['HK-X-01', 'a2b'] }), 'twitter')).toBe(false);
    expect(matchesDiagnosticService(row({ host: 'gemini.google.com', chains: ['🧠 OpenAI/Codex'] }), 'chatgpt')).toBe(false);
  });
});

describe('connection response evidence', () => {
  it.each([
    [{ download: 100 }, 'responded'], [{ chains: ['REJECT'] }, 'rejected'],
    [{ upload: 1, firstUploadAt: 1000 }, 'suspectedTimeout'], [{ upload: 1, firstUploadAt: 11_000 }, 'waiting'],
    [{ upload: 1, network: 'udp' }, 'waiting'], [{ active: false }, 'noResponse'],
  ] as const)('classifies %j as %s', (overrides, expected) => {
    expect(getDiagnosticConnectionStatus(row({ ...overrides, chains: 'chains' in overrides ? [...overrides.chains] : ['DIRECT'] }), 12_000, 12_001)).toBe(expected);
  });

  it('never presents stale observations as current connectivity', () => {
    expect(getDiagnosticConnectionStatus(row({ download: 100 }), 12_000, 28_000)).toBe('stale');
    expect(getDiagnosticConnectionStatus(row(), null, 28_000)).toBe('stale');
  });
});
