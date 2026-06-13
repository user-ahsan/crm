export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ApiKeyFormData {
  name: string;
  scopes: string[];
  expiresAt?: string | null;
}

export interface ApiKeyCreateResponse {
  key: ApiKey;
  fullKey: string;
}
