import { AppSystemProp } from '@activepieces/server-shared'
import { CreateFlowTemplateRequest } from '@activepieces/ee-shared'
import {
    ALL_PRINCIPAL_TYPES,
    isNil,
    ListFlowTemplatesRequest,
    FlowTemplate,
    PrincipalType,
    SERVICE_KEY_SECURITY_OPENAPI,
    EndpointScope,
    ActivepiecesError,
    ErrorCode,
    TemplateType,
    apId,
    flowPieceUtil,
    sanitizeObjectForPostgresql,
    SeekPage,
} from '@activepieces/shared'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { StatusCodes } from 'http-status-codes'
import { paginationHelper } from '../helper/pagination/pagination-utils'
import { system } from '../helper/system/system'
import { repoFactory } from '../core/db/repo-factory'
import { FlowTemplateEntity } from '../ee/flow-template/flow-template.entity'
import { ArrayContains, ArrayOverlap, Equal, ILike } from 'typeorm'

const templateRepo = repoFactory<FlowTemplate>(FlowTemplateEntity)

export const communityFlowTemplateModule: FastifyPluginAsyncTypebox = async (
    app,
) => {
    await app.register(flowTemplateController, { prefix: '/v1/flow-templates' })
}

const flowTemplateController: FastifyPluginAsyncTypebox = async (fastify) => {
    // List templates endpoint
    fastify.get(
        '/',
        {
            config: {
                allowedPrincipals: ALL_PRINCIPAL_TYPES,
            },
            schema: {
                querystring: ListFlowTemplatesRequest,
            },
        },
        async (request) => {
            const commonFilters: Record<string, unknown> = {}
            if (request.query.pieces) {
                commonFilters.pieces = ArrayOverlap(request.query.pieces)
            }
            if (request.query.tags) {
                commonFilters.tags = ArrayContains(request.query.tags)
            }
            if (request.query.search) {
                commonFilters.name = ILike(`%${request.query.search}%`)
                commonFilters.description = ILike(`%${request.query.search}%`)
            }
            commonFilters.platformId = Equal(request.principal.platform.id)
            commonFilters.type = Equal(TemplateType.PLATFORM)
            const templates = await templateRepo()
                .createQueryBuilder('flow_template')
                .where(commonFilters)
                .getMany()
            return paginationHelper.createPage(templates, null)
        },
    )

    // Get single template endpoint
    fastify.get(
        '/:id',
        {
            config: {
                allowedPrincipals: ALL_PRINCIPAL_TYPES,
                scope: EndpointScope.PLATFORM,
            },
            schema: {
                tags: ['flow-templates'],
                description: 'Get a flow template',
                security: [SERVICE_KEY_SECURITY_OPENAPI],
                params: Type.Object({
                    id: Type.String(),
                }),
            },
        },
        async (request) => {
            const template = await templateRepo().findOneBy({
                id: request.params.id,
            })
            if (isNil(template)) {
                throw new ActivepiecesError({
                    code: ErrorCode.ENTITY_NOT_FOUND,
                    params: {
                        message: `Flow template ${request.params.id} is not found`,
                    },
                })
            }
            return template
        },
    )

    // Create template endpoint
    fastify.post(
        '/',
        {
            config: {
                allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE],
                scope: EndpointScope.PLATFORM,
            },
            schema: {
                tags: ['flow-templates'],
                description: 'Create a flow template',
                security: [SERVICE_KEY_SECURITY_OPENAPI],
                body: CreateFlowTemplateRequest,
            },
        },
        async (request, reply) => {
            const {
                description,
                type,
                template,
                blogUrl,
                tags,
                id,
                metadata,
            } = request.body

            const flowTemplate = sanitizeObjectForPostgresql(template)
            const newTags = tags ?? []
            const newId = id ?? apId()

            await templateRepo().upsert(
                {
                    id: newId,
                    template: flowTemplate as any,
                    name: flowTemplate.displayName,
                    description: description ?? '',
                    pieces: flowPieceUtil.getUsedPieces(flowTemplate.trigger),
                    blogUrl,
                    type,
                    tags: newTags,
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                    platformId: request.principal.platform.id,
                    projectId: type === TemplateType.PLATFORM ? undefined : request.principal.projectId,
                    metadata: (metadata as unknown) ?? null,
                },
                ['id'],
            )

            const result = await templateRepo().findOneByOrFail({
                id: newId,
            })
            return reply.status(StatusCodes.CREATED).send(result)
        },
    )

    // Delete template endpoint
    fastify.delete(
        '/:id',
        {
            config: {
                allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE],
                scope: EndpointScope.PLATFORM,
            },
            schema: {
                tags: ['flow-templates'],
                description: 'Delete a flow template',
                security: [SERVICE_KEY_SECURITY_OPENAPI],
                params: Type.Object({
                    id: Type.String(),
                }),
            },
        },
        async (request, reply) => {
            const template = await templateRepo().findOneBy({
                id: request.params.id,
            })
            if (isNil(template)) {
                throw new ActivepiecesError({
                    code: ErrorCode.ENTITY_NOT_FOUND,
                    params: {
                        message: `Flow template ${request.params.id} is not found`,
                    },
                })
            }

            if (template.projectId !== request.principal.projectId) {
                throw new ActivepiecesError({
                    code: ErrorCode.AUTHORIZATION,
                    params: {},
                })
            }

            await templateRepo().delete({
                id: request.params.id,
            })
            return reply.status(StatusCodes.NO_CONTENT).send()
        },
    )
}

function convertToQueryString(params: ListFlowTemplatesRequest): string {
    const searchParams = new URLSearchParams()

    Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((val) => {
                if (!isNil(val)) {
                    searchParams.append(key, val)
                }
            })
        }
        else if (!isNil(value)) {
            searchParams.set(key, value.toString())
        }
    })

    return searchParams.toString()
}
