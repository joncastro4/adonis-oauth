import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import Vine from '@vinejs/vine'

export default class AuthController {
    public async signUp({ request, response }: HttpContext) {
        const validate = await Vine.compile(
            Vine.object({
                name: Vine.string(),
                email: Vine.string().email().unique({
                    table: "users",
                    column: "email"
                }),
                password: Vine.string()
            })
        )

        await validate.validate(request.all())

        const user = await User.create(request.only(["name", "email", "password"]))

        return response.status(201).json({
            message: "Registro exitoso",
            user: user
        })
    }

    public async logIn({ request, response }: HttpContext) {
        const validate = await Vine.compile(
            Vine.object({
                email: Vine.string().email(),
                password: Vine.string()
            })
        )

        await validate.validate(request.all())

        const user = await User.query().where('email', request.input("email")).first()

        if (!user || !(await hash.verify(user.password, request.input("password")))) {
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
}