/**
 * Registro de prompts por tenant.
 *
 * Escolhe qual `PromptTemplate` cada tenant recebe. É o único lugar do Core
 * que sabe que existe mais de um — em qualquer outro lugar, "qual prompt" é
 * uma pergunta sem resposta, e a montagem em `prompt.ts` só sabe aplicar.
 *
 * ## Onde os prompts são registrados
 *
 * Em código, no boot. Uma implantação registra os seus tenants e pronto:
 *
 * ```ts
 * registerPrompt('acme', {
 *   persona: 'Você é o assistente da Acme.',
 *   languageHints: { 'en-US': 'Reply in English.' },
 * });
 * ```
 *
 * Isso serve para um punhado de tenants. Para muitos, o registro em código
 * vira um deploy por tenant, e o lugar certo passa a ser o banco — a interface
 * deste arquivo não muda quando isso acontecer, o que muda é o que roda por
 * trás dela.
 *
 * ## Ausência não é erro
 *
 * Tenant sem registro, id desconhecido, header ausente: todos caem em
 * `DEFAULT_PROMPT`. Um typo no id do tenant degrada a persona em vez de
 * derrubar o chat com um 500, que é o pior desfecho possível para o usuário —
 * ele não está nem em posição de corrigir.
 */

import {
  DEFAULT_PROMPT,
  withPromptDefaults,
  type PromptTemplate,
  type ResolvedPromptTemplate,
} from '../../models/prompt-template.js';

/** Tenant → template já completo, com os defaults preenchidos. */
const registry = new Map<string, ResolvedPromptTemplate>();

/** Tenants registrados. Para log e diagnóstico. */
export function registeredTenants(): string[] {
  return [...registry.keys()];
}

/**
 * Registra o template de um tenant.
 *
 * Chamar de novo com o mesmo tenant substitui o template — é assim que um
 * hot reload de configuração funciona, quando existir.
 *
 * @param tenant - Id do tenant
 * @param template - Template; o que faltar vem de `DEFAULT_PROMPT`
 */
export function registerPrompt(tenant: string, template: PromptTemplate): void {
  const key = tenant.trim();

  if (key === '') {
    throw new Error('registerPrompt: o id do tenant não pode ser vazio.');
  }

  registry.set(key, withPromptDefaults(template));
}

/**
 * Remove o template de um tenant.
 *
 * O tenant volta a usar `DEFAULT_PROMPT`. Útil em teste e no teardown de uma
 * implantação.
 */
export function unregisterPrompt(tenant: string): void {
  registry.delete(tenant.trim());
}

/**
 * O template de um tenant.
 *
 * Nunca lança: um tenant desconhecido é o caso esperado de uma implantação que
 * ainda não registrou tudo, e o fallback no padrão é o desfecho que mantém o
 * chat funcionando.
 *
 * @param tenant - Id do tenant; ausente ou desconhecido usa o padrão
 */
export function resolvePrompt(tenant?: string | null): ResolvedPromptTemplate {
  const key = tenant?.trim();

  if (!key) return withPromptDefaults(DEFAULT_PROMPT);

  return registry.get(key) ?? withPromptDefaults(DEFAULT_PROMPT);
}
