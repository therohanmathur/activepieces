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
            const cloudRequest: ClaimWithCloudRequest = {
                code: request.code,
                codeVerifier: request.codeVerifier,
                authorizationMethod: request.authorizationMethod,
                clientId: request.clientId,
                tokenUrl: request.tokenUrl,
                pieceName,
                edition: system.getEdition(),
            }
            
            // Add detailed logging
            log.info('Making claim request to secrets.activepieces.com/claim with:')
            log.info({
                request: cloudRequest,
                pieceName,
                tokenUrl: request.tokenUrl,
            })

            const response = await axios.post<CloudOAuth2ConnectionValue>(
                'https://secrets.activepieces.com/claim',
                cloudRequest,
                {
                    timeout: 10000,
                },
            )

            // Log the response
            log.info('Received response from secrets.activepieces.com/claim:')
            log.info({
                status: response.status,
                statusText: response.statusText,
                data: response.data,
            })

            const value = response.data
            return {
                ...value,
                token_url: request.tokenUrl,
                props: request.props,
            }
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
