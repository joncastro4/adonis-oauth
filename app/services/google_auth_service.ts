import { OAuth2Client } from 'google-auth-library'
import env from '#start/env'

class GoogleAuthService {
  private client: OAuth2Client

  constructor() {
    this.client = new OAuth2Client(
      env.get('GOOGLE_CLIENT_ID'),
      env.get('GOOGLE_CLIENT_SECRET'),
      env.get('GOOGLE_REDIRECT_URI')
    )
  }

  /**
   * Genera la URL de autorización de Google
   */
  generateAuthUrl(): string {
    console.log(' [GoogleAuth] Generando URL de autorización')
    console.log(' [GoogleAuth] Configuración OAuth:', {
      clientId: env.get('GOOGLE_CLIENT_ID')?.substring(0, 20) + '...',
      redirectUri: env.get('GOOGLE_REDIRECT_URI'),
      scopes: ['profile', 'email'],
    })

    const authUrl = this.client.generateAuthUrl({
      access_type: 'offline',
      scope: ['profile', 'email'],
      include_granted_scopes: true,
    })

    console.log(' [GoogleAuth] URL de autorización generada exitosamente')
    return authUrl
  }

  /**
   * Obtiene los tokens usando el código de autorización
   */
  async getTokens(code: string) {
    console.log(' [GoogleAuth] Intercambiando código por tokens')
    console.log(' [GoogleAuth] Código recibido:', code.substring(0, 20) + '...')

    try {
      const { tokens } = await this.client.getToken(code)
      console.log(' [GoogleAuth] Tokens obtenidos exitosamente:', {
        hasAccessToken: !!tokens.access_token,
        hasIdToken: !!tokens.id_token,
        hasRefreshToken: !!tokens.refresh_token,
        tokenType: tokens.token_type,
      })
      return tokens
    } catch (error) {
      console.error(' [GoogleAuth] Error obteniendo tokens:', error.message)
      throw error
    }
  }

  /**
   * Obtiene la información del usuario desde Google
   */
  async getUserInfo(accessToken: string) {
    this.client.setCredentials({ access_token: accessToken })

    const ticket = await this.client.verifyIdToken({
      idToken: accessToken,
      audience: env.get('GOOGLE_CLIENT_ID'),
    })

    const payload = ticket.getPayload()

    if (!payload) {
      throw new Error('No se pudo obtener la información del usuario')
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified,
    }
  }

  /**
   * Verifica el ID token y obtiene información del usuario
   */
  async verifyIdToken(idToken: string) {
    console.log(' [GoogleAuth] Verificando token de ID')
    console.log(' [GoogleAuth] Token ID recibido:', idToken.substring(0, 30) + '...')

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: idToken,
        audience: env.get('GOOGLE_CLIENT_ID'),
      })

      const payload = ticket.getPayload()

      if (!payload) {
        console.error(' [GoogleAuth] Token inválido - payload vacío')
        throw new Error('Token inválido')
      }

      const userInfo = {
        googleId: payload.sub,
        email: payload.email!,
        name: payload.name || '',
        picture: payload.picture || '',
        emailVerified: payload.email_verified || false,
      }

      console.log(' [GoogleAuth] Token verificado exitosamente')
      console.log(' [GoogleAuth] Información extraída del token:', {
        googleId: userInfo.googleId,
        email: userInfo.email,
        name: userInfo.name,
        hasAvatar: !!userInfo.picture,
        emailVerified: userInfo.emailVerified,
      })

      return userInfo
    } catch (error) {
      console.error(' [GoogleAuth] Error verificando token:', {
        message: error.message,
        name: error.name,
      })
      throw new Error(`Error verificando token: ${error.message}`)
    }
  }
}

export default new GoogleAuthService()
