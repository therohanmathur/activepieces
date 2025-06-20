import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import {
    ALL_PRINCIPAL_TYPES,
    assertNotNullOrUndefined,
    AuthenticationResponse,
    UserIdentityProvider,
} from '@activepieces/shared'
import { system } from '../helper/system/system'
import { AppSystemProp, WorkerSystemProp } from '@activepieces/server-shared'
import jwksClient from 'jwks-rsa'
import { jwtUtils, JwtSignAlgorithm } from '../helper/jwt-utils'
import { authenticationService } from './authentication.service'
import { platformUtils } from '../platform/platform.utils'

const JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs'

const combinePaths = (...args: string[]) => {
    return args
        .map(part => part.replace(/(^\/|\/$)/g, ''))
        .join('/')
}

const keyLoader = jwksClient({
    rateLimit: true,
    cache: true,
    jwksUri: JWKS_URI,
})

export const googleAuthnController: FastifyPluginAsyncTypebox = async (app) => {
    // Start Login
    app.get('/google/login', {
        config: {
            allowedPrincipals: ALL_PRINCIPAL_TYPES,
        },
    }, async (req, res) => {
        const clientId = system.getOrThrow(AppSystemProp.GOOGLE_CLIENT_ID)
        const frontendUrl = system.getOrThrow(WorkerSystemProp.FRONTEND_URL)
        const callbackUrl = `${frontendUrl}/api/v1/authentication/google/callback`

        const loginUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        loginUrl.searchParams.set('client_id', clientId)
        loginUrl.searchParams.set('redirect_uri', callbackUrl)
        loginUrl.searchParams.set('scope', 'email profile')
        loginUrl.searchParams.set('response_type', 'code')
        
        return res.redirect(loginUrl.href)
    })

    // Handle Callback
    app.get('/google/callback', {
        config: {
            allowedPrincipals: ALL_PRINCIPAL_TYPES,
        },
    }, async (req, res) => {
        const { code } = req.query as { code: string }
        
        const clientId = system.getOrThrow(AppSystemProp.GOOGLE_CLIENT_ID)
        const clientSecret = system.getOrThrow(AppSystemProp.GOOGLE_CLIENT_SECRET)
        const frontendUrl = system.getOrThrow(WorkerSystemProp.FRONTEND_URL)
        const callbackUrl = `${frontendUrl}/api/v1/authentication/google/callback`
        
        // Exchange code for token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: callbackUrl,
                grant_type: 'authorization_code',
            }),
        })
        const { id_token: idToken } = await tokenResponse.json()

        // Verify token and get user info
        const { header } = jwtUtils.decode({ jwt: idToken })
        const signingKey = await keyLoader.getSigningKey(header.kid)
        const publicKey = signingKey.getPublicKey()
        const payload = await jwtUtils.decodeAndVerify<any>({
            jwt: idToken,
            key: publicKey,
            issuer: ['accounts.google.com', 'https://accounts.google.com'],
            algorithm: JwtSignAlgorithm.RS256,
            audience: clientId,
        })
        
        assertNotNullOrUndefined(payload.email_verified, 'email_verified')

        const platformId = await platformUtils.getPlatformIdForRequest(req)

        // Authenticate or create user
        const authResponse: AuthenticationResponse = await authenticationService(req.log).federatedAuthn({
            email: payload.email,
            firstName: payload.given_name,
            lastName: payload.family_name,
            provider: UserIdentityProvider.GOOGLE,
            predefinedPlatformId: platformId ?? null,
            trackEvents: true,
            newsLetter: false,
        })

        // Redirect user with token
        const url = new URL(combinePaths(frontendUrl, '/authenticate'))
        url.searchParams.set('response', JSON.stringify(authResponse))
        
        return res.redirect(url.href)
    })
} 