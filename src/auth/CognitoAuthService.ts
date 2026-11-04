/**
 * Aether — Servicio de Autenticación AWS Cognito (Flujo PKCE RFC 7636)
 *
 * Implementa el protocolo OAuth 2.0 Authorization Code con PKCE usando
 * exclusivamente la Web Crypto API nativa del navegador (cero dependencias externas).
 */
import { COGNITO_CONFIG } from './config';
import type { AuthTokens, AuthorProfile, AuthState, AuthListener } from './types';

const STORAGE_KEYS = {
  TOKENS: 'aether_auth_tokens',
  AUTHOR: 'aether_auth_author',
  VERIFIER: 'aether_auth_code_verifier',
  STATE: 'aether_auth_state'
} as const;

export class CognitoAuthService {
  private static instance: CognitoAuthService;
  private state: AuthState = {
    status: 'unauthenticated',
    author: null
  };
  private tokens: AuthTokens | null = null;
  private listeners: Set<AuthListener> = new Set();
  private refreshTimeoutId: number | null = null;

  private constructor() {}

  public static getInstance(): CognitoAuthService {
    if (!CognitoAuthService.instance) {
      CognitoAuthService.instance = new CognitoAuthService();
    }
    return CognitoAuthService.instance;
  }

  // ============================================================================
  // CRIPTOGRAFÍA PKCE NATIVA (RFC 7636)
  // ============================================================================

  /**
   * Genera una cadena aleatoria de alta entropía compatible con RFC 7636
   */
  private generateRandomString(length: number = 64): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const values = new Uint8Array(length);
    window.crypto.getRandomValues(values);
    return Array.from(values)
      .map((x) => charset[x % charset.length])
      .join('');
  }

  /**
   * Calcula el hash SHA-256 de una cadena de texto
   */
  private async sha256(plain: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
  }

  /**
   * Codifica un ArrayBuffer en Base64 URL-Safe sin padding
   */
  private base64UrlEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Genera el par criptográfico code_verifier y code_challenge
   */
  private async generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
    const verifier = this.generateRandomString(64);
    const hashed = await this.sha256(verifier);
    const challenge = this.base64UrlEncode(hashed);
    return { verifier, challenge };
  }

  // ============================================================================
  // CICLO DE VIDA E INICIALIZACIÓN
  // ============================================================================

  /**
   * Inicializa el servicio, procesa callbacks de redirección y restaura sesiones activas
   */
  public async init(): Promise<void> {
    // 1. Comprobar si volvemos de una redirección OAuth con código
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      await this.handleAuthCallback(code, state);
      return;
    }

    // 2. Restaurar sesión existente desde almacenamiento local si no hay código en la URL
    this.restoreStoredSession();
  }

  /**
   * Procesa el código de autorización devuelto por Cognito tras el login
   */
  private async handleAuthCallback(code: string, state: string): Promise<boolean> {
    this.updateState({ status: 'authenticating', author: null });

    const savedState = sessionStorage.getItem(STORAGE_KEYS.STATE);
    const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.VERIFIER);

    // Verificación de protección CSRF
    if (!savedState || savedState !== state) {
      console.error('[Aether Auth] Error de validación CSRF en el parámetro state.');
      this.updateState({
        status: 'error',
        author: null,
        error: 'Error de validación de seguridad (CSRF state mismatch).'
      });
      this.cleanupUrl();
      return false;
    }

    if (!codeVerifier) {
      console.error('[Aether Auth] Falta el code_verifier en sessionStorage.');
      this.updateState({
        status: 'error',
        author: null,
        error: 'Sesión de autenticación expirada o code_verifier ausente.'
      });
      this.cleanupUrl();
      return false;
    }

    try {
      // Canjear Authorization Code + PKCE code_verifier por los 3 JWT de AWS Cognito
      const tokenEndpoint = `${COGNITO_CONFIG.domain}/oauth2/token`;
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: COGNITO_CONFIG.clientId,
        code: code,
        redirect_uri: COGNITO_CONFIG.redirectUri,
        code_verifier: codeVerifier
      });

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error_description || errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      const tokens: AuthTokens = {
        idToken: data.id_token,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        obtainedAt: Date.now()
      };

      const author = this.extractAuthorProfile(data.id_token);

      this.saveSession(tokens, author);
      this.updateState({ status: 'authenticated', author });

      // Limpiar datos temporales de PKCE y limpiar la barra de direcciones
      sessionStorage.removeItem(STORAGE_KEYS.STATE);
      sessionStorage.removeItem(STORAGE_KEYS.VERIFIER);
      this.cleanupUrl();

      // Programar renovación automática antes de que expire el Access Token
      this.scheduleTokenRefresh(tokens.expiresIn);

      return true;
    } catch (err: any) {
      console.error('[Aether Auth] Error durante el intercambio de tokens:', err);
      this.updateState({
        status: 'error',
        author: null,
        error: err?.message || 'Error al canjear el código de autorización.'
      });
      this.cleanupUrl();
      return false;
    }
  }

  /**
   * Limpia los parámetros ?code= y ?state= de la URL sin recargar la página
   */
  private cleanupUrl(): void {
    if (typeof window !== 'undefined' && window.history && window.location) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }

  // ============================================================================
  // DISPARADORES DE INICIO DE SESIÓN
  // ============================================================================

  /**
   * Inicia el flujo PKCE redirigiendo directamente al selector de cuentas de Google
   */
  public async signInWithGoogle(): Promise<void> {
    const { verifier, challenge } = await this.generatePkcePair();
    const state = this.generateRandomString(32);

    // Guardar temporalmente en sessionStorage para la vuelta
    sessionStorage.setItem(STORAGE_KEYS.VERIFIER, verifier);
    sessionStorage.setItem(STORAGE_KEYS.STATE, state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: COGNITO_CONFIG.clientId,
      redirect_uri: COGNITO_CONFIG.redirectUri,
      identity_provider: 'Google',
      scope: 'email openid profile',
      state: state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });

    const authorizeUrl = `${COGNITO_CONFIG.domain}/oauth2/authorize?${params.toString()}`;
    window.location.assign(authorizeUrl);
  }

  /**
   * Inicia el flujo PKCE general de Cognito (con soporte para correo y contraseña)
   */
  public async signInWithCognito(): Promise<void> {
    const { verifier, challenge } = await this.generatePkcePair();
    const state = this.generateRandomString(32);

    sessionStorage.setItem(STORAGE_KEYS.VERIFIER, verifier);
    sessionStorage.setItem(STORAGE_KEYS.STATE, state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: COGNITO_CONFIG.clientId,
      redirect_uri: COGNITO_CONFIG.redirectUri,
      scope: 'email openid profile',
      state: state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });

    const authorizeUrl = `${COGNITO_CONFIG.domain}/oauth2/authorize?${params.toString()}`;
    window.location.assign(authorizeUrl);
  }

  // ============================================================================
  // RENOVACIÓN DE TOKENS (REFRESH TOKEN)
  // ============================================================================

  /**
   * Renueva el Access Token y el ID Token de forma silenciosa usando el Refresh Token
   */
  public async refreshTokens(): Promise<boolean> {
    if (!this.tokens?.refreshToken) {
      return false;
    }

    try {
      const tokenEndpoint = `${COGNITO_CONFIG.domain}/oauth2/token`;
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: COGNITO_CONFIG.clientId,
        refresh_token: this.tokens.refreshToken
      });

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      });

      if (!response.ok) {
        throw new Error(`Error en refresco HTTP ${response.status}`);
      }

      const data = await response.json();

      const updatedTokens: AuthTokens = {
        idToken: data.id_token || this.tokens.idToken,
        accessToken: data.access_token,
        refreshToken: this.tokens.refreshToken, // El refresh token se mantiene
        expiresIn: data.expires_in,
        obtainedAt: Date.now()
      };

      const author = this.extractAuthorProfile(updatedTokens.idToken);
      this.saveSession(updatedTokens, author);
      this.updateState({ status: 'authenticated', author });

      this.scheduleTokenRefresh(updatedTokens.expiresIn);
      return true;
    } catch (err) {
      console.warn('[Aether Auth] Falló el refresco automático de sesión:', err);
      return false;
    }
  }

  private scheduleTokenRefresh(expiresInSeconds: number): void {
    if (this.refreshTimeoutId) {
      window.clearTimeout(this.refreshTimeoutId);
      this.refreshTimeoutId = null;
    }

    // Renovar 5 minutos antes de la expiración (o a la mitad si es muy breve)
    const refreshMargin = Math.min(300, expiresInSeconds / 2);
    const delayMs = Math.max(10, (expiresInSeconds - refreshMargin) * 1000);

    this.refreshTimeoutId = window.setTimeout(() => {
      this.refreshTokens();
    }, delayMs);
  }

  // ============================================================================
  // GESTIÓN DE SESIÓN Y ALMACENAMIENTO
  // ============================================================================

  private saveSession(tokens: AuthTokens, author: AuthorProfile): void {
    this.tokens = tokens;
    try {
      localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));
      localStorage.setItem(STORAGE_KEYS.AUTHOR, JSON.stringify(author));
    } catch (e) {
      console.warn('[Aether Auth] No se pudo persistir la sesión en localStorage:', e);
    }
  }

  private restoreStoredSession(): void {
    try {
      const storedTokens = localStorage.getItem(STORAGE_KEYS.TOKENS);
      const storedAuthor = localStorage.getItem(STORAGE_KEYS.AUTHOR);

      if (!storedTokens || !storedAuthor) {
        this.updateState({ status: 'unauthenticated', author: null });
        return;
      }

      const tokens: AuthTokens = JSON.parse(storedTokens);
      const author: AuthorProfile = JSON.parse(storedAuthor);

      const elapsedSeconds = (Date.now() - tokens.obtainedAt) / 1000;
      const isExpired = elapsedSeconds >= tokens.expiresIn;

      this.tokens = tokens;

      if (isExpired) {
        // Si ha expirado pero tenemos refresh token, refrescamos al vuelo
        this.refreshTokens().then((success) => {
          if (!success) {
            this.logout();
          }
        });
      } else {
        this.updateState({ status: 'authenticated', author });
        const remainingSeconds = tokens.expiresIn - elapsedSeconds;
        this.scheduleTokenRefresh(remainingSeconds);
      }
    } catch (e) {
      this.logout();
    }
  }

  /**
   * Cierra la sesión del autor localmente y limpia los tokens
   */
  public logout(): void {
    if (this.refreshTimeoutId) {
      window.clearTimeout(this.refreshTimeoutId);
      this.refreshTimeoutId = null;
    }

    this.tokens = null;
    try {
      localStorage.removeItem(STORAGE_KEYS.TOKENS);
      localStorage.removeItem(STORAGE_KEYS.AUTHOR);
    } catch {}

    this.updateState({ status: 'unauthenticated', author: null });
  }

  /**
   * Cierra sesión globalmente invalidando la sesión en AWS Cognito
   */
  public logoutGlobal(): void {
    this.logout();
    const logoutUrl = `${COGNITO_CONFIG.domain}/logout?client_id=${COGNITO_CONFIG.clientId}&logout_uri=${encodeURIComponent(COGNITO_CONFIG.logoutUri)}`;
    window.location.assign(logoutUrl);
  }

  // ============================================================================
  // EXTRACCIÓN DE IDENTIDAD JWT
  // ============================================================================

  /**
   * Decodifica de forma segura la carga útil (payload) del JWT sin librerías externas
   */
  private extractAuthorProfile(idToken: string): AuthorProfile {
    try {
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Formato JWT inválido');
      }

      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      const claims = JSON.parse(jsonPayload);

      return {
        sub: claims.sub,
        email: claims.email || '',
        name: claims.name || claims['cognito:username'] || claims.email?.split('@')[0] || 'Autor',
        picture: claims.picture,
        emailVerified: Boolean(claims.email_verified)
      };
    } catch (e) {
      console.warn('[Aether Auth] No se pudo decodificar el perfil del ID Token:', e);
      return {
        sub: 'unknown',
        email: '',
        name: 'Autor'
      };
    }
  }

  // ============================================================================
  // MÉTODOS PÚBLICOS DE CONSULTA Y SUSCRIPCIÓN
  // ============================================================================

  public getState(): AuthState {
    return { ...this.state };
  }

  public getAuthor(): AuthorProfile | null {
    return this.state.author;
  }

  public getTokens(): AuthTokens | null {
    return this.tokens;
  }

  public getAccessToken(): string | null {
    return this.tokens?.accessToken || null;
  }

  public getIdToken(): string | null {
    return this.tokens?.idToken || null;
  }

  public isAuthenticated(): boolean {
    return this.state.status === 'authenticated' && !!this.state.author;
  }

  public onAuthStateChanged(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(partial: Partial<AuthState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      try {
        listener(this.getState());
      } catch (e) {
        console.error('[Aether Auth] Error en listener de estado:', e);
      }
    }
  }
}

// Exportar la instancia singleton
export const cognitoAuth = CognitoAuthService.getInstance();
