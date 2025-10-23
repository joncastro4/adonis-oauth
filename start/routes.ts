/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import AuthController from '#controllers/auth_controller'
import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

router.group(() => {
  router.post("/usuarios", [AuthController, 'signUp'])
  router.post("/ingresar", [AuthController, 'logIn'])
  router.post("/salir", [AuthController, 'logout']).use(middleware.auth())
}).prefix("/api/v1")