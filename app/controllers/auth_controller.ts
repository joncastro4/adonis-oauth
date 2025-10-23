import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import Vine from '@vinejs/vine'
import Database from '@adonisjs/lucid/services/db'

export default class AuthController {
    public async signUp({ request, response }: HttpContext) {
        const validate = await Vine.compile(
            Vine.object({
                nombre: Vine.string(),
                correo: Vine.string().email().unique({
                    table: "users",
                    column: "correo"
                }),
                contrasena: Vine.string()
            })
        )

        await validate.validate(request.all())

        const user = await User.create(request.only(["nombre", "correo", "contrasena"]))

        return response.status(201).json({
            message: "Registro exitoso",
            user: user
        })
    }

    public async logIn({ request, response }: HttpContext) {
        const validate = await Vine.compile(
            Vine.object({
                correo: Vine.string().email(),
                contrasena: Vine.string()
            })
        )

        await validate.validate(request.all())

        const user = await User.query().where('correo', request.input("correo")).first()

        if (!user || user?.contrasena != request.input("contrasena")) {
            return response.status(401).json({
                message: "Credenciales incorrectas"
            })
        }

        const token = await User.accessTokens.create(user)

        return response.status(200).json({
            message: "Sesión iniciada",
            token: token.toJSON().token
        })
    }

    public async logout({ auth, response }: HttpContext) {
        const user = auth.getUserOrFail()
        
        await Database.from('auth_access_tokens')
            .where('tokenable_id', user.id)
            .delete()

        return response.ok({ message: 'All sessions closed successfully' })
    }
}