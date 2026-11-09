import type { DiagnosticConnection, DiagnosticServiceId } from '@neko-master/shared';

type ServiceDefinition = { domains: string[]; names: RegExp; exclude?: string[] };
// Service-owned domains and narrow hosts only: shared Google, S3 and CDN roots are not service identities.
const SERVICES: Record<DiagnosticServiceId, ServiceDefinition> = {
  chatgpt: { domains: ['chatgpt.com', 'openai.com', 'oaistatic.com', 'oaiusercontent.com', 'oaistatsig.com', 'chat.com', 'sora.com'], names: /(?:^|[^a-z0-9])(?:chatgpt|openai|codex|sora)(?:$|[^a-z0-9])/i },
  gemini: { domains: ['gemini.google.com', 'gemini.google', 'gemini.gstatic.com', 'geminiweb-pa.clients6.google.com', 'geminiweb-pa.clients.google.com', 'aistudio.google.com', 'ai.google.dev', 'generativelanguage.googleapis.com', 'makersuite.google.com', 'cloudaicompanion.googleapis.com', 'cloudcode-pa.googleapis.com', 'antigravity.google', 'antigravity.google.com', 'antigravity.googleapis.com', 'antigravity-pa.googleapis.com', 'antigravity-unleash.goog'], names: /(?:^|[^a-z0-9])(?:gemini|aistudio|antigravity)(?:$|[^a-z0-9])/i },
  grok: { domains: ['grok.com', 'x.ai', 'grok.x.com'], names: /(?:^|[^a-z0-9])(?:grok|xai|x\.ai)(?:$|[^a-z0-9])/i },
  perplexity: { domains: ['perplexity.ai', 'perplexity.com', 'pplx.ai', 'pplx-res.cloudinary.com', 'ppl-ai-file-upload.s3.amazonaws.com'], names: /(?:^|[^a-z0-9])(?:perplexity|pplx)(?:$|[^a-z0-9])/i },
  telegram: { domains: ['telegram.org', 'telegram.me', 'telegram.dog', 't.me', 'telegra.ph', 'telesco.pe', 'tdesktop.com'], names: /(?:^|[^a-z0-9])(?:telegram|tg)(?:$|[^a-z0-9])|电报/i },
  twitter: { domains: ['x.com', 'twitter.com', 'twimg.com', 't.co'], exclude: ['grok.x.com'], names: /(?:^|[^a-z0-9])twitter(?:$|[^a-z0-9])|推特/i },
  claude: { domains: ['claude.ai', 'claude.com', 'anthropic.com', 'anthropic.ai', 'claudeusercontent.com', 'claudemcpclient.com', 'claudemcpcontent.com'], names: /(?:^|[^a-z0-9])(?:claude|anthropic)(?:$|[^a-z0-9])/i },
  workbuddy: { domains: ['workbuddy.ai'], names: /(?:^|[^a-z0-9])workbuddy(?:$|[^a-z0-9])/i },
  cursor: { domains: ['cursor.sh', 'cursor.com', 'cursor-cdn.com', 'cursor.blob.core.windows.net', 'agent-stores.s3.us-east-1.amazonaws.com', 'cloud-agent-artifacts.s3.us-east-1.amazonaws.com'], names: /(?:^|[^a-z0-9])cursor(?:$|[^a-z0-9])/i },
  opencode: { domains: ['opencode.ai'], names: /(?:^|[^a-z0-9])opencode(?:$|[^a-z0-9])/i },
  github: { domains: ['github.com', 'githubusercontent.com', 'githubassets.com', 'ghcr.io'], names: /(?:^|[^a-z0-9])github(?:$|[^a-z0-9])/i },
  tabbit: { domains: ['tabbit.com'], names: /(?:^|[^a-z0-9])tabbit(?:$|[^a-z0-9])/i },
  alma: { domains: ['alma.now'], names: /(?:^|[^a-z0-9])alma(?:$|[^a-z0-9])/i },
  muse: { domains: ['muse.ai', 'metaaivm.com'], names: /(?:^|[^a-z0-9])(?:muse|metaaivm)(?:$|[^a-z0-9])/i },
  cline: { domains: ['cline.bot'], names: /(?:^|[^a-z0-9])cline(?:$|[^a-z0-9])/i },
  downloads: { domains: ['dl.google.com', 'iosapps.itunes.apple.com', 'updates.cdn-apple.com', 'release-assets.githubusercontent.com', 'persistent.oaistatic.com', 'downloads.claude.ai', 'downloads.cursor.com', 'releases.tabbit.com', 'updates.alma.now', 'files.pythonhosted.org', 'registry.npmjs.org', 'download.docker.com'], names: /下载更新|配环境下载|(?:^|[^a-z0-9])(?:downloads?|updates?)(?:$|[^a-z0-9])/i },
  cloudflare: { domains: ['challenges.cloudflare.com', 'turnstile.cloudflare.com', 'captcha.cloudflare.com', 'cloudflarechallenge.com'], names: /cloudflare/i },
  youtube: { domains: ['youtube.com', 'youtu.be', 'googlevideo.com', 'ytimg.com', 'youtube-nocookie.com'], names: /(?:^|[^a-z0-9])(?:youtube|yt)(?:$|[^a-z0-9])/i },
};

const isDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
const SERVICE_DEFINITIONS = Object.entries(SERVICES);

export function matchesDiagnosticService(connection: DiagnosticConnection, service: DiagnosticServiceId): boolean {
  const definition = SERVICES[service];
  const host = connection.host.toLowerCase().replace(/\.$/, '');
  if (definition.exclude?.some(domain => isDomain(host, domain))) return false;
  if (definition.domains.some(domain => isDomain(host, domain))) return true;
  // Specific known service hosts take precedence over incidental shared outer policy names.
  if (host && service !== 'downloads' && SERVICE_DEFINITIONS.some(([id, value]) => id !== 'downloads' && id !== service &&
    !value.exclude?.some(domain => isDomain(host, domain)) && value.domains.some(domain => isDomain(host, domain)))) return false;
  return [connection.rulePayload, ...connection.chains].some(value => definition.names.test(value));
}
