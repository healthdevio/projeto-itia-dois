import {
  findRelevantMemories,
  buscarMemoriasSimilares,
  createMemory,
  updateMemory,
  getMemory,
  type Memory,
  type RelevantMemory,
} from '../../repositories/memory-repository.js';
import { getProvider } from './index.js';
import type { AIContext, AIProviderRequest } from './index.js';
import type { ChatConfig } from '../../models/chat-config.js';
import { DEFAULT_CHAT_CONFIG } from '../../models/chat-config.js';

const CATEGORIAS_VALIDAS = [
  'geral',
  'preferencia',
  'objetivo',
  'projeto',
  'contexto',
] as const;
type CategoriaMemoria = (typeof CATEGORIAS_VALIDAS)[number];

const IMPORTANCIA_MIN = 1;
const IMPORTANCIA_MAX = 5;
const MEMORIAS_MAX_POR_RECUPERACAO = 5;
const MEMORIAS_SIMILARES_MAX = 10;

/**
 * Resultado da avaliação de atualização de memória, devolvido pela IA.
 */
interface AvaliacaoMemoria {
  acao: 'criar' | 'atualizar' | 'ignorar';
  conteudo?: string;
  categoria?: CategoriaMemoria;
  importancia?: number;
  memoriaId?: string;
  justificativa?: string;
}

/**
 * Extrai um único objeto JSON de um texto, tolerando marcações e texto ao redor.
 * Retorna null quando não há objeto válido.
 */
function extrairObjetoJson(texto: string): Record<string, unknown> | null {
  const start = texto.indexOf('{');
  const end = texto.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(texto.slice(start, end + 1));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {}
  return null;
}

/**
 * Normaliza a categoria devolvida pela IA para um valor válido.
 */
function normalizarCategoria(valor: unknown): CategoriaMemoria {
  if (
    typeof valor === 'string' &&
    CATEGORIAS_VALIDAS.includes(valor as CategoriaMemoria)
  ) {
    return valor as CategoriaMemoria;
  }
  return 'geral';
}

/**
 * Normaliza a importância para o intervalo válido.
 */
function normalizarImportancia(valor: unknown): number {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) return IMPORTANCIA_MIN;
  return Math.min(
    IMPORTANCIA_MAX,
    Math.max(IMPORTANCIA_MIN, Math.round(numero)),
  );
}

/**
 * Normaliza a ação devolvida pela IA.
 */
function normalizarAcao(valor: unknown): 'criar' | 'atualizar' | 'ignorar' {
  if (typeof valor === 'string') {
    const a = valor.toLowerCase().trim();
    if (a === 'criar' || a === 'atualizar' || a === 'ignorar') return a;
  }
  return 'ignorar';
}

/**
 * Normaliza um campo de texto opcional, aceitando apenas strings válidas.
 */
function normalizarTextoOpcional(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() !== ''
    ? valor.trim()
    : undefined;
}

/**
 * Monta o prompt de avaliação enviado ao provider para decidir se a interação
 * gera ou não uma memória permanente.
 */
function promptAvaliacao(
  mensagemUsuario: string,
  respostaIA: string,
  memóriasRelevantes: RelevantMemory[],
): string {
  const memoriaContexto = memóriasRelevantes.length
    ? memóriasRelevantes
        .map(
          (m) => `- [${m.category}] ${m.content} (importância ${m.importance})`,
        )
        .join('\n')
    : 'Nenhuma memória relevante encontrada.';

  return [
    'Você é um assistente que avalia se uma conversa contém informações que',
    'deveriam ser armazenadas como memória permanente do usuário.',
    '',
    'Mensagem do usuário:',
    JSON.stringify(mensagemUsuario),
    '',
    'Resposta da IA:',
    JSON.stringify(respostaIA),
    '',
    'Memórias já armazenadas do usuário (para evitar duplicar ou contradição):',
    memoriaContexto,
    '',
    'Regras:',
    '1. Não crie memória para mensagens triviais (saudações, agradecimentos,',
    '   perguntas gerais sem fato duradouro sobre o usuário).',
    '2. Crie memória (acao: "criar") apenas quando houver uma informação',
    '   persistente e útil sobre o usuário: preferências, objetivos, projetos,',
    '   contexto que ajude conversas futuras.',
    '3. Atualize memória existente (acao: "atualizar") quando a nova',
    '   informação complementar ou corrigir uma memória já armazenada; informe',
    '   memoriaId com o id da memória a ser complementada.',
    '4. Ignore (acao: "ignorar") quando não houver valor futuro suficiente.',
    '5. Nunca armazene a mensagem inteira; armazene um resumo curato do fato.',
    '6. Nunca invente memoriaId; use apenas ids da lista acima.',
    '',
    'Responda APENAS com um objeto JSON válido, sem texto fora dele:',
    JSON.stringify({
      acao: 'criar | atualizar | ignorar',
      conteudo: 'resumo curto da informação para a memória',
      categoria: 'geral | preferencia | objetivo | projeto | contexto',
      importancia: 1,
      memoriaId: 'id da memória existente apenas quando acao for atualizar',
      justificativa: 'por que essa decisão',
    }),
  ].join('\n');
}

/**
 * I.A [10] — Recuperar memória relevante.
 *
 * Busca memórias do usuário que possam contribuir para a resposta da solicitação
 * atual, limitando a quantidade e ordenando por importância e atualização.
 * Nunca retorna memórias de outro usuário.
 */
export async function recuperarMemoriaRelevante(
  userId: string,
  mensagem: string,
  limite = MEMORIAS_MAX_POR_RECUPERACAO,
): Promise<RelevantMemory[]> {
  try {
    return await findRelevantMemories(userId, mensagem, limite);
  } catch (error) {
    console.error(
      `[Memória] Erro ao recuperar memórias relevantes do usuário ${userId}:`,
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

/**
 * Insere as memórias recuperadas no contexto entregue à IA, como uma instrução
 * de sistema separada do histórico da conversa.
 */
export function injetarMemoriasNoContexto(
  contexto: AIContext,
  memórias: RelevantMemory[],
): AIContext {
  if (!memórias.length) return contexto;
  return {
    ...contexto,
    relevant_memories: memórias,
  };
}

/**
 * Renderiza as memórias recuperadas como texto de instrução para o provider.
 */
export function renderizarMemoriasContexto(memórias: RelevantMemory[]): string {
  if (!memórias.length) return '';
  return [
    'Memórias relevantes do usuário (use apenas se pertinentes à pergunta):',
    ...memórias.map(
      (m) => `- [${m.category}] ${m.content} (atualizada em ${m.updatedAt})`,
    ),
    '',
  ].join('\n');
}

/**
 * I.A [11] — Atualizar memória.
 *
 * Avalia se a interação atual gera uma informação que deve ser armazenada,
 * complementada ou ignorada. Utiliza o provider de IA existente (echo ou
 * nvidia) para a avaliação, mas valida rigorosamente a resposta antes de
 * gravar qualquer coisa no banco. Não bloqueia a resposta principal: falhas
 * na avaliação ou persistência são apenas registradas.
 */
export async function avaliarEAtualizarMemoria(
  userId: string,
  mensagemUsuario: string,
  respostaIA: string,
  contexto: AIContext,
  config: ChatConfig = DEFAULT_CHAT_CONFIG,
  tenant?: string,
): Promise<{
  acao: 'criar' | 'atualizar' | 'ignorar';
  memoria?: Memory;
  erro?: string;
}> {
  try {
    const memóriasRelevantes = await findRelevantMemories(
      userId,
      mensagemUsuario,
      MEMORIAS_SIMILARES_MAX,
    );

    const provider = await getProvider();
    const avaliacaoRequest: AIProviderRequest = {
      message: promptAvaliacao(mensagemUsuario, respostaIA, memóriasRelevantes),
      context: {
        ...contexto,
        previous_messages: [],
        history_ids: [],
      },
      config,
      tenant,
    };

    const resposta = await provider.respond(avaliacaoRequest);
    const avaliacao = extrairObjetoJson(resposta.response);
    if (!avaliacao) {
      return {
        acao: 'ignorar',
        erro: 'Resposta do provider não contém objeto JSON de avaliação',
      };
    }

    const acao = normalizarAcao(avaliacao.acao);
    if (acao === 'ignorar') {
      return { acao: 'ignorar' };
    }

    const conteudo =
      typeof avaliacao.conteudo === 'string' && avaliacao.conteudo.trim()
        ? avaliacao.conteudo.trim()
        : null;
    if (!conteudo) {
      return {
        acao: 'ignorar',
        erro: 'Avaliação não trouxe conteúdo válido para a memória',
      };
    }

    const categoria = normalizarCategoria(avaliacao.category);
    const importancia = normalizarImportancia(avaliacao.importancia);

    if (acao === 'atualizar') {
      const memoriaId =
        typeof avaliacao.memoriaId === 'string' && avaliacao.memoriaId
          ? avaliacao.memoriaId
          : null;
      if (!memoriaId) {
        return {
          acao: 'atualizar',
          erro: 'Ação atualizar requer memoriaId, mas nenhum foi informado',
        };
      }
      const existente = await getMemory(memoriaId, userId);
      if (!existente) {
        return {
          acao: 'atualizar',
          erro: `Memória ${memoriaId} não encontrada para este usuário`,
        };
      }
      // Complementa: não substitui o conteúdo anterior sem justificativa.
      const conteudoCombinado = `${existente.content}. ${conteudo}`;
      const atualizada = await updateMemory(memoriaId, userId, {
        content: conteudoCombinado,
        category: categoria,
        importance: importancia,
        context:
          normalizarTextoOpcional(avaliacao.justificativa) ??
          existente.context ??
          undefined,
      });
      if (!atualizada) {
        return {
          acao: 'atualizar',
          erro: 'Falha ao atualizar a memória existente',
        };
      }
      return { acao: 'atualizar', memoria: atualizada };
    }

    // acao === 'criar': evitar duplicados antes de criar.
    const similares = await buscarMemoriasSimilares(userId, conteudo, 3);
    const equivalente = similares.find(
      (m) => m.content.toLowerCase() === conteudo.toLowerCase(),
    );
    if (equivalente) {
      const atualizada = await updateMemory(equivalente.id, userId, {
        category: categoria,
        importance: Math.max(equivalente.importance, importancia),
      });
      if (atualizada) {
        return { acao: 'atualizar', memoria: atualizada };
      }
    }

    const nova = await createMemory({
      userId,
      content: conteudo,
      category: categoria,
      importance: importancia,
      context: normalizarTextoOpcional(avaliacao.justificativa),
    });
    return { acao: 'criar', memoria: nova };
  } catch (error) {
    console.error(
      `[Memória] Erro ao avaliar/atualizar memória do usuário ${userId}:`,
      error instanceof Error ? error.message : String(error),
    );
    return {
      acao: 'ignorar',
      erro: error instanceof Error ? error.message : String(error),
    };
  }
}

export {
  CATEGORIAS_VALIDAS,
  MEMORIAS_MAX_POR_RECUPERACAO,
  type AvaliacaoMemoria,
};
