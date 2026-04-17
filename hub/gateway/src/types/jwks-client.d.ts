// Type declarations for jwks-client package
declare module 'jwks-client' {
  interface JwksClient {
    getSigningKey(kid: string): Promise<{ getPublicKey(): string; rsaPublicKey: string }>;
    getSigningKeys(): Promise<Array<{ kid: string; getPublicKey(): string; rsaPublicKey: string }>>;
  }

  interface ClientOptions {
    jwksUri: string;
    requestHeaders?: Record<string, string>;
    timeout?: number;
    cache?: boolean;
    rateLimit?: boolean;
    jwksRequestsPerMinute?: number;
    strictSsl?: boolean;
  }

  function jwksClient(options: ClientOptions): JwksClient;
  export = jwksClient;
}