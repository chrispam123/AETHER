/**
 * Aether — Configuración del Cliente Cognito (España: eu-south-2)
 *
 * Admite variables de entorno de Vite con valores de producción preconfigurados.
 */
import type { CognitoConfig } from './types';

export const COGNITO_CONFIG: CognitoConfig = {
  userPoolId: (import.meta as any).env?.VITE_COGNITO_USER_POOL_ID || 'eu-south-2_rAdkAQRGQ',
  clientId: (import.meta as any).env?.VITE_COGNITO_CLIENT_ID || '5kbc28hvh3nj8u9gcheo889rmr',
  domain: (import.meta as any).env?.VITE_COGNITO_DOMAIN || 'https://aether-auth-orzdg8.auth.eu-south-2.amazoncognito.com',
  region: (import.meta as any).env?.VITE_AWS_REGION || 'eu-south-2',
  get redirectUri(): string {
    return typeof window !== 'undefined' ? window.location.origin : 'https://d1creuco3vvhk7.cloudfront.net';
  },
  get logoutUri(): string {
    return typeof window !== 'undefined' ? window.location.origin : 'https://d1creuco3vvhk7.cloudfront.net';
  }
};
