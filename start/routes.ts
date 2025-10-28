/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

const AuthController = () => import('#controllers/auth_controller')
import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

router
  .group(() => {
    router.post('/usuarios', [AuthController, 'signUp'])
    router.post('/ingresar', [AuthController, 'logIn'])
    router.post('/salir', [AuthController, 'logout']).use(middleware.auth())

    // Rutas de OAuth con Google
    router.get('/auth/google', [AuthController, 'googleRedirect'])

    // Ruta para obtener información del usuario autenticado
    router.get('/usuario-info', [AuthController, 'getUserInfo']).use(middleware.auth())
  })
  .prefix('/api/v1')

// Ruta de callback sin prefijo (para coincidir con Google OAuth config)
router.get('/callback', [AuthController, 'googleCallback'])
