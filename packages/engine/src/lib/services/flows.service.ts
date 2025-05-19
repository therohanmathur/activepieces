import { FlowsContext } from '@activepieces/pieces-framework'
import { PopulatedFlow } from '@activepieces/shared'

type CreateFlowsServiceParams = {
    engineToken: string
    internalApiUrl: string
    flowId: string
    flowVersionId: string
}

export const createFlowsContext = ({ engineToken, internalApiUrl, flowId, flowVersionId }: CreateFlowsServiceParams): FlowsContext => {
    return {
        async list() {
            const response = await fetch(`${internalApiUrl}v1/engine/populated-flows`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${engineToken}`,
                },
            })
            const data = await response.json();
            return {
                data: data.data,
                next: data.next || undefined
            };
        },
        current: {
            id: flowId,
            version: {
                id: flowVersionId,
            },
        },
    }
}