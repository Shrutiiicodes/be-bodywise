// Errors shared by every model provider.
export class ModelError extends Error {
  constructor(message, kind) { super(message); this.kind = kind; }
}
// A non-2xx HTTP response from a provider called over plain fetch (Groq).
export class ProviderError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
