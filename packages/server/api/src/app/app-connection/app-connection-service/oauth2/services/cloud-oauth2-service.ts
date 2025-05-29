import { OAuth2AuthorizationMethod } from '@activepieces/pieces-framework'
import {
    ActivepiecesError,
    AppConnectionType,
    CloudOAuth2ConnectionValue,
    ErrorCode,
} from '@activepieces/shared'
import axios from 'axios'
import { FastifyBaseLogger } from 'fastify'
import { system } from '../../../../helper/system/system'
import {
    ClaimOAuth2Request,
    OAuth2Service,
    RefreshOAuth2Request,
} from '../oauth2-service'
import { repoFactory } from '../../../../core/db/repo-factory'
import { encryptUtils } from '../../../../helper/encryption'
import { AppSystemProp } from '@activepieces/server-shared'
import { EntitySchema } from 'typeorm'
import { BaseColumnSchemaPart, JSONB_COLUMN_TYPE } from '../../../../database/database-common'
import { EncryptedObject } from '../../../../helper/encryption'

// Define a simplified OAuthAppEntity schema
type OAuthAppSchema = {
    pieceName: string
    platformId: string
    clientId: string
    clientSecret: EncryptedObject
}

const OAuthAppEntity = new EntitySchema<OAuthAppSchema>({
    name: 'oauth_app',
    columns: {
        ...BaseColumnSchemaPart,
        pieceName: {
            type: String,
        },
        platformId: {
            type: String,
        },
        clientId: {
            type: String,
        },
        clientSecret: {
            type: JSONB_COLUMN_TYPE,
        },
    },
})

const oauthAppRepo = repoFactory(OAuthAppEntity)

export const cloudOAuth2Service = (log: FastifyBaseLogger): OAuth2Service<CloudOAuth2ConnectionValue> => ({
    refresh: async ({
        pieceName,
        connectionValue,
    }: RefreshOAuth2Request<CloudOAuth2ConnectionValue>): Promise<CloudOAuth2ConnectionValue> => {
        const requestBody = {
            refreshToken: connectionValue.refresh_token,
            pieceName,
            clientId: connectionValue.client_id,
            edition: system.getEdition(),
            authorizationMethod: connectionValue.authorization_method,
            tokenUrl: connectionValue.token_url,
        }
        const response = (
            await axios.post('https://secrets.activepieces.com/refresh', requestBody, {
                timeout: 10000,
            })
        ).data
        return {
            ...connectionValue,
            ...response,
            props: connectionValue.props,
            type: AppConnectionType.CLOUD_OAUTH2,
        }
    },
    claim: async ({
        request,
        pieceName,
    }: ClaimOAuth2Request): Promise<CloudOAuth2ConnectionValue> => {
        try {
            // 1. Get the OAuth app with decrypted client secret
            const oauthApp = await oauthAppRepo().findOneByOrFail({
                pieceName,
                clientId: request.clientId,
                platformId: system.getOrThrow(AppSystemProp.CLOUD_PLATFORM_ID),
            })

            // 2. Prepare the token exchange request
            const tokenExchangeBody: Record<string, string> = {
                grant_type: 'authorization_code',
                code: request.code,
                client_id: request.clientId,
                client_secret: encryptUtils.decryptString(oauthApp.clientSecret),
            }

            if (request.redirectUrl) {
                tokenExchangeBody.redirect_uri = request.redirectUrl
            }

            if (request.codeVerifier) {
                tokenExchangeBody.code_verifier = request.codeVerifier
            }

            // 3. Set up headers based on authorization method
            const headers: Record<string, string> = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            }

            // 4. Make the token exchange request directly to the OAuth provider
            log.info('Making token exchange request to OAuth provider:')
            log.info({
                tokenUrl: request.tokenUrl,
                clientId: request.clientId,
                redirectUrl: request.redirectUrl,
            })

            const response = await axios.post(
                request.tokenUrl,
                new URLSearchParams(tokenExchangeBody).toString(),
                {
                    headers,
                    timeout: 10000,
                }
            )

            // 5. Log the response
            log.info('Received response from OAuth provider:')
            log.info({
                status: response.status,
                statusText: response.statusText,
                data: response.data,
            })

            // 6. Format and return the response
            const value: CloudOAuth2ConnectionValue = {
                ...response.data,
                token_url: request.tokenUrl,
                client_id: request.clientId,
                props: request.props,
                type: AppConnectionType.CLOUD_OAUTH2,
                claimed_at: Math.floor(Date.now() / 1000),
            }

            return value
        }
        catch (e: unknown) {
            // Enhanced error logging
            log.error('Error in cloudOAuth2Service.claim:')
            if (axios.isAxiosError(e)) {
                log.error({
                    status: e.response?.status,
                    statusText: e.response?.statusText,
                    data: e.response?.data,
                    headers: e.response?.headers,
                    request: {
                        url: e.config?.url,
                        method: e.config?.method,
                        data: e.config?.data,
                        headers: e.config?.headers,
                    }
                })
            } else {
                log.error(e)
            }
            throw new ActivepiecesError({
                code: ErrorCode.INVALID_CLOUD_CLAIM,
                params: {
                    pieceName,
                },
            })
        }
    },
})

type ClaimWithCloudRequest = {
    pieceName: string
    code: string
    codeVerifier: string | undefined
    authorizationMethod: OAuth2AuthorizationMethod | undefined
    edition: string
    clientId: string
    tokenUrl: string
}
