export type EmbeddingInputType = 'passage' | 'query';

interface NvidiaEmbeddingResponse {
  data?: Array<{
    embedding?: number[];
    index?: number;
  }>;
  detail?: string;
  title?: string;
}

const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_MODEL = 'nvidia/nemotron-3.5-embed-1b';
const EXPECTED_DIMENSIONS = 2048;
const TIMEOUT_MS = 30_000;

export async function generateEmbedding(
  text: string,
  inputType: EmbeddingInputType = 'passage',
): Promise<number[]> {
  if (!text.trim()) {
    throw new Error('O texto para gerar o embedding não pode estar vazio.');
  }

  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw new Error('A variável NVIDIA_API_KEY não está configurada.');
  }

  const baseUrl = (
    process.env.NVIDIA_EMBEDDING_BASE_URL || DEFAULT_BASE_URL
  ).replace(/\/+$/, '');

  const model = process.env.NVIDIA_EMBEDDING_MODEL || DEFAULT_MODEL;

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
      input_type: inputType,
      encoding_format: 'float',
      truncate: 'NONE',
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Falha na API de embeddings da NVIDIA (HTTP ${response.status}).`,
    );
  }

  const result = (await response.json()) as NvidiaEmbeddingResponse;

  const embedding = result.data?.[0]?.embedding;

  if (
    !Array.isArray(embedding) ||
    embedding.length !== EXPECTED_DIMENSIONS ||
    !embedding.every(
      (value) => typeof value === 'number' && Number.isFinite(value),
    )
  ) {
    throw new Error(
      'A NVIDIA retornou um embedding inválido ou com dimensão inesperada.',
    );
  }

  return embedding;
}
