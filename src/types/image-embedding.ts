export interface ImageEmbeddingRequest {
  model?: string;
  input?: string | string[];
  imageUrl?: string;
  imageUrls?: string[];
}

export interface ImageEmbeddingObject {
  object: "embedding";
  index: number;
  embedding: number[];
}

export interface ImageEmbeddingResponse {
  object: "list";
  data: ImageEmbeddingObject[];
  model: string;
  usage: {
    image_count: number;
    total_images: number;
  };
}
