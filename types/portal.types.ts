export interface PortalUser {
  id: string;
  email: string;
  name: string;
  lastLogin: string | null;
  active: boolean;
  createdAt: string;
}

export interface PortalUserFormData {
  email: string;
  name: string;
  password: string;
}

export interface PortalShare {
  id: string;
  portalUserId: string;
  relatedToType: string;
  relatedToId: string;
  permission: string;
  createdAt: string;
}

export interface PortalShareFormData {
  portalUserId: string;
  relatedToType: string;
  relatedToId: string;
  permission: string;
}

export interface PortalAuthResponse {
  session: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  } | null;
  user: PortalUser | null;
  error: string | null;
}

export interface PortalLoginRequest {
  email: string;
  password: string;
}

export interface PortalPasswordResetRequest {
  email: string;
}
