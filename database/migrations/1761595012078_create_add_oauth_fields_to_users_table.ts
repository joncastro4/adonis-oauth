import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('google_id').nullable().unique()
      table.string('avatar').nullable()
      table.string('provider').nullable().defaultTo('local')

      // Hacer la contraseña nullable para usuarios que se registren con OAuth
      table.string('contrasena').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('google_id')
      table.dropColumn('avatar')
      table.dropColumn('provider')

      // Revertir la contraseña a not nullable
      table.string('contrasena').notNullable().alter()
    })
  }
}
