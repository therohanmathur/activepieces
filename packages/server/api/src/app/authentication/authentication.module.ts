import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { authenticationController } from './authentication.controller'
import { googleAuthnController } from './google-authn.controller'

export const authenticationModule: FastifyPluginAsyncTypebox = async (app) => {
    await app.register(authenticationController, {
        prefix: '/v1/authentication',
    })
    await app.register(googleAuthnController, {
        prefix: '/v1/authentication',
    })
}
