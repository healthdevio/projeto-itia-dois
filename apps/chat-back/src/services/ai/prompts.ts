import {
  DEFAULT_PROMPT,
  withPromptDefaults,
  type PromptTemplate,
  type ResolvedPromptTemplate,
} from '../../models/prompt-template.js';
const registry = new Map<string, ResolvedPromptTemplate>();
export function registeredTenants(): string[] {
  return [...registry.keys()];
}
export function registerPrompt(tenant: string, template: PromptTemplate): void {
  const key = tenant.trim();
  if (key === '') {
    throw new Error('registerPrompt: o id do tenant não pode ser vazio.');
  }
  registry.set(key, withPromptDefaults(template));
}
export function unregisterPrompt(tenant: string): void {
  registry.delete(tenant.trim());
}
export function resolvePrompt(tenant?: string | null): ResolvedPromptTemplate {
  const key = tenant?.trim();
  if (!key) return withPromptDefaults(DEFAULT_PROMPT);
  return registry.get(key) ?? withPromptDefaults(DEFAULT_PROMPT);
}
