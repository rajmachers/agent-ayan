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
    cacheMaxEntries?: number;
    cacheMaxAge?: number;
    strictSsl?: boolean;
    [key: string]: any;
  }

  function jwksClient(options: ClientOptions): JwksClient;
  export = jwksClient;
}