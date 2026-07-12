/** OpenAI-compatible embedding request */
export interface EmbeddingRequest {
  model: string;
  input: string | string[];
}

/** Single embedding in response */
export interface EmbeddingObject {
  object: 'embedding';
  index: number;
  embedding: number[];
}

/** OpenAI-compatible embedding response */
export interface EmbeddingResponse {
  object: 'list';
  data: EmbeddingObject[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/** Model info for /v1/models */
export interface ModelObject {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

/** OpenAI-compatible model list response */
export interface ModelListResponse {
  object: 'list';
  data: ModelObject[];
}
