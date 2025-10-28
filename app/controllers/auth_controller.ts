import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import Vine from '@vinejs/vine'
import Database from '@adonisjs/lucid/services/db'
import GoogleAuthService from '#services/google_auth_service'
import env from '#start/env'

export default class AuthController {
  public async signUp({ request, response }: HttpContext) {
    const validate = await Vine.compile(
      Vine.object({
        nombre: Vine.string(),
        correo: Vine.string().email().unique({
          table: 'users',
          column: 'correo',
        }),
        contrasena: Vine.string(),
      })
    )

    await validate.validate(request.all())

    const user = await User.create(request.only(['nombre', 'correo', 'contrasena']))

    return response.status(201).json({
      message: 'Registro exitoso',
      user: user,
    })
  }

  public async logIn({ request, response }: HttpContext) {
    const validate = await Vine.compile(
      Vine.object({
        correo: Vine.string().email(),
        contrasena: Vine.string(),
      })
    )

    await validate.validate(request.all())

    const user = await User.query().where('correo', request.input('correo')).first()

    if (!user || user?.contrasena !== request.input('contrasena')) {
      return response.status(401).json({
        message: 'Credenciales incorrectas',
      })
    }

    const token = await User.accessTokens.create(user)

    return response.status(200).json({
      message: 'Sesión iniciada',
      token: token.toJSON().token,
    })
  }

  public async logout({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()

    await Database.from('auth_access_tokens').where('tokenable_id', user.id).delete()

    return response.ok({ message: 'All sessions closed successfully' })
  }

  /**
   * Redirige al usuario a la página de autorización de Google
   */
  public async googleRedirect({ request, response }: HttpContext) {
    console.log(' [OAuth] Ruta /auth/google accedida desde IP:', request.ip())
    console.log(' [OAuth] User-Agent:', request.header('user-agent'))
    console.log(' [OAuth] Iniciando flujo de autenticación con Google')

    const authUrl = GoogleAuthService.generateAuthUrl()
    console.log(' [OAuth] URL de autorización generada:', authUrl)

    console.log(' [OAuth] Redirigiendo usuario a Google para autorización')
    return response.redirect(authUrl)
  }

  /**
   * Maneja el callback de Google OAuth
   */
  public async googleCallback({ request, response }: HttpContext) {
    console.log(' [OAuth] Callback recibido desde IP:', request.ip())
    console.log(' [OAuth] Referrer:', request.header('referer'))
    console.log(' [OAuth] Callback recibido de Google')
    console.log(' [OAuth] Query params:', request.qs())

    try {
      const code = request.input('code')
      console.log(' [OAuth] Código de autorización recibido:', code ? 'SÍ' : 'NO')

      if (!code) {
        console.error(' [OAuth] Error: Código de autorización no encontrado')
        return response.status(400).json({
          message: 'Código de autorización no encontrado',
        })
      }

      console.log(' [OAuth] Intercambiando código por tokens...')
      // Obtener tokens de Google
      const tokens = await GoogleAuthService.getTokens(code)
      console.log(' [OAuth] Tokens obtenidos:', {
        hasAccessToken: !!tokens.access_token,
        hasIdToken: !!tokens.id_token,
        hasRefreshToken: !!tokens.refresh_token,
      })

      if (!tokens.id_token) {
        console.error(' [OAuth] Error: Token de ID no encontrado en respuesta')
        return response.status(400).json({
          message: 'Token de ID no encontrado',
        })
      }

      console.log(' [OAuth] Verificando token de ID y obteniendo información del usuario...')
      // Verificar el token y obtener información del usuario
      const googleUser = await GoogleAuthService.verifyIdToken(tokens.id_token)
      console.log(' [OAuth] Información del usuario de Google:', {
        googleId: googleUser.googleId,
        email: googleUser.email,
        name: googleUser.name,
        hasAvatar: !!googleUser.picture,
        emailVerified: googleUser.emailVerified,
      })

      console.log(' [OAuth] Buscando usuario existente en base de datos...')
      // Buscar usuario existente por Google ID o email
      let user = await User.query()
        .where('google_id', googleUser.googleId)
        .orWhere('correo', googleUser.email)
        .first()

      if (!user) {
        console.log('👤 [OAuth] Usuario no encontrado, creando nuevo usuario...')
        // Crear nuevo usuario
        user = await User.create({
          nombre: googleUser.name,
          correo: googleUser.email,
          googleId: googleUser.googleId,
          avatar: googleUser.picture,
          provider: 'google',
          contrasena: null, // No se necesita contraseña para OAuth
        })
        console.log(' [OAuth] Nuevo usuario creado con ID:', user.id)
      } else {
        console.log(' [OAuth] Usuario existente encontrado con ID:', user.id)
        // Actualizar usuario existente con información de Google si no la tiene
        if (!user.googleId) {
          console.log(' [OAuth] Actualizando usuario existente con datos de Google...')
          user.googleId = googleUser.googleId
          user.provider = 'google'
          user.avatar = googleUser.picture
          await user.save()
          console.log(' [OAuth] Usuario actualizado con información de Google')
        } else {
          console.log(' [OAuth] Usuario ya tenía información de Google')
        }
      }

      console.log(' [OAuth] Generando token de acceso...')
      // Crear token de acceso
      const token = await User.accessTokens.create(user)
      console.log(
        ' [OAuth] Token de acceso generado:',
        token.toJSON().token?.substring(0, 20) + '...'
      )

      // Preparar datos del usuario para el frontend
      const userData = {
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        avatar: user.avatar,
      }
      console.log(' [OAuth] Datos del usuario preparados para frontend:', userData)

      // Redirigir al frontend con el token
      const redirectUrl = `${env.get('GOOGLE_REDIRECT_SUCCESS')}?token=${token.toJSON().token}&user=${encodeURIComponent(
        JSON.stringify(userData)
      )}`

      console.log(' [OAuth] Redirigiendo al frontend:', env.get('GOOGLE_REDIRECT_SUCCESS'))
      console.log(' [OAuth] Autenticación OAuth completada exitosamente')

      return response.redirect(redirectUrl)
    } catch (error) {
      console.error(' [OAuth] Error en proceso de autenticación:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })

      // Redirigir al frontend con error
      const redirectUrl = `${env.get('GOOGLE_REDIRECT_SUCCESS')}?error=${encodeURIComponent('Error al autenticar con Google: ' + error.message)}`
      console.log(' [OAuth] Redirigiendo al frontend con error')
      return response.redirect(redirectUrl)
    }
  }

  /**
   * Obtiene la información del usuario autenticado
   */
  public async getUserInfo({ auth, response }: HttpContext) {
    console.log(' [UserInfo] Solicitando información del usuario autenticado')
    try {
      // Obtener el usuario autenticado
      const user = auth.getUserOrFail()
      console.log(' [UserInfo] Usuario autenticado encontrado, ID:', user.id)

      // Preparar la respuesta con la información solicitada
      const userInfo = {
        email: user.correo,
        foto: user.avatar || null,
        // Información adicional que podría ser útil
        nombre: user.nombre,
        id: user.id,
        provider: user.provider || 'local',
      }

      console.log(' [UserInfo] Información del usuario preparada:', {
        email: userInfo.email,
        hasFoto: !!userInfo.foto,
        provider: userInfo.provider,
      })

      return response.ok({
        email: userInfo.email,
        foto: userInfo.foto,
        // Opcionalmente puedes incluir más campos si los necesitas
        nombre: userInfo.nombre,
        provider: userInfo.provider,
      })
    } catch (error) {
      console.error(' [UserInfo] Error obteniendo información del usuario:', {
        message: error.message,
        name: error.name,
      })

      return response.status(401).json({
        message: 'No autenticado o token inválido',
        error: error.message,
      })
    }
  }
}
