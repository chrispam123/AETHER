/**
 * Aether — Tipos de Identidad y Autenticación (AWS Cognito PKCE)
 */

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  obtainedAt: number; // Timestamp Unix en ms
}

export interface AuthorProfile {
  sub: string;             // ID único del autor en AWS Cognito
  email: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
}

export type AuthStatus = 'unauthenticated' | 'authenticating' | 'authenticated' | 'error';

export interface AuthState {
  status: AuthStatus;
  author: AuthorProfile | null;
  error?: string;
}

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  domain: string;
  region: string;
  redirectUri: string;
  logoutUri: string;
}

export type AuthListener = (state: AuthState) => void;
