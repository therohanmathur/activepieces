import { OtpType } from '@activepieces/ee-shared'
import { cryptoUtils } from '@activepieces/server-shared'
import { ActivepiecesError, ApEdition, ApFlagId, assertNotNullOrUndefined, AuthenticationResponse, ErrorCode, isNil, PlatformRole, PlatformWithoutSensitiveData, User, UserIdentity, UserIdentityProvider } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { otpService } from '../ee/authentication/otp/otp-service'
import { flagService } from '../flags/flag.service'
import { system } from '../helper/system/system'
import { platformService } from '../platform/platform.service'
import { platformUtils } from '../platform/platform.utils'
import { projectService } from '../project/project-service'
import { userService } from '../user/user-service'
import { userInvitationsService } from '../user-invitations/user-invitation.service'
import { authenticationUtils } from './authentication-utils'
import { userIdentityService, userIdentityRepository } from './user-identity/user-identity-service'
import { AppSystemProp } from '@activepieces/server-shared'

export const authenticationService = (log: FastifyBaseLogger) => ({
    async signUp(params: SignUpParams): Promise<AuthenticationResponse> {
        if (!isNil(params.platformId)) {
            await authenticationUtils.assertEmailAuthIsEnabled({
                platformId: params.platformId,
                provider: params.provider,
            })
            await authenticationUtils.assertDomainIsAllowed({
                email: params.email,
                platformId: params.platformId,
            })
        }
        if (isNil(params.platformId)) {
            const userIdentity = await userIdentityService(log).create({
                ...params,
                verified: params.provider === UserIdentityProvider.GOOGLE || params.provider === UserIdentityProvider.JWT || params.provider === UserIdentityProvider.SAML,
            })
            return createUserAndPlatform(userIdentity, log)
        }

        // Bypass invitation check for all users
        const userIdentity = await userIdentityService(log).create({
            ...params,
            verified: true,
        })

        // Set platform role based on email
        const platformRole = PlatformRole.ADMIN
        // params.email.toLowerCase() === 'rohan@icustomer.ai' ? PlatformRole.ADMIN : PlatformRole.MEMBER

        const user = await userService.create({
            identityId: userIdentity.id,
            platformRole,
            platformId: params.platformId,
        })

        // Check if user already has a project in this platform
        const existingProject = await projectService.getOneByOwnerAndPlatform({
            ownerId: user.id,
            platformId: params.platformId,
        })

        if (!isNil(existingProject)) {
            // If user already has a project, use that one
            return authenticationUtils.getProjectAndToken({
                userId: user.id,
                platformId: params.platformId,
                projectId: existingProject.id,
            })
        }

        // If no existing project, create a new one with user as ADMIN
        const newProject = await projectService.create({
            displayName: userIdentity.firstName + '\'s Project',
            ownerId: user.id,
            platformId: params.platformId,
        })


        return authenticationUtils.getProjectAndToken({
            userId: user.id,
            platformId: params.platformId,
            projectId: newProject.id,
        })
    },
    async signInWithPassword(params: SignInWithPasswordParams): Promise<AuthenticationResponse> {
        const identity = await userIdentityService(log).verifyIdentityPassword(params)
        const platformId = isNil(params.predefinedPlatformId) ? await getPersonalPlatformIdForIdentity(identity.id) : params.predefinedPlatformId
        if (isNil(platformId)) {
            throw new ActivepiecesError({
                code: ErrorCode.AUTHENTICATION,
                params: {
                    message: 'No platform found for identity',
                },
            })
        }
        await authenticationUtils.assertEmailAuthIsEnabled({
            platformId,
            provider: UserIdentityProvider.EMAIL,
        })
        await authenticationUtils.assertDomainIsAllowed({
            email: params.email,
            platformId,
        })
        const user = await userService.getOneByIdentityAndPlatform({
            identityId: identity.id,
            platformId,
        })
        assertNotNullOrUndefined(user, 'User not found')
        return authenticationUtils.getProjectAndToken({
            userId: user.id,
            platformId,
            projectId: null,
        })
    },
    async federatedAuthn(params: FederatedAuthnParams): Promise<AuthenticationResponse> {
        const userIdentity = await userIdentityService(log).getIdentityByEmail(params.email)

        if (isNil(userIdentity)) {
            // Create New Identity and User
            const defaultPassword = system.get(AppSystemProp.DEFAULT_PASSWORD)
            const password = defaultPassword || await cryptoUtils.generateRandomPassword()
            
            return authenticationService(log).signUp({
                email: params.email,
                firstName: params.firstName,
                lastName: params.lastName,
                password: password,
                platformId: params.predefinedPlatformId,
                trackEvents: params.trackEvents,
                newsLetter: params.newsLetter,
                provider: params.provider,
            })
        }

        // User exists, update their info
        await userIdentityRepository().update(userIdentity.id, {
            firstName: params.firstName,
            lastName: params.lastName,
        })

        if (isNil(params.predefinedPlatformId)) {
            return createUserAndPlatform(userIdentity, log)
        }
        
        let user = await userService.getOneByIdentityAndPlatform({
            identityId: userIdentity.id,
            platformId: params.predefinedPlatformId,
        })

        if (isNil(user)) {
            user = await userService.create({
                identityId: userIdentity.id,
                platformId: params.predefinedPlatformId,
                platformRole: PlatformRole.MEMBER,
            })
        }

        return authenticationUtils.getProjectAndToken({
            userId: user.id,
            platformId: params.predefinedPlatformId,
            projectId: null,
        })
    },
    async switchPlatform(params: SwitchPlatformParams): Promise<AuthenticationResponse> {
        const platforms = await platformService.listPlatformsForIdentityWithAtleastProject({ identityId: params.identityId })
        const platform = platforms.find((platform) => platform.id === params.platformId)
        await assertUserCanSwitchToPlatform(null, platform)

        assertNotNullOrUndefined(platform, 'Platform not found')
        const user = await getUserForPlatform(params.identityId, platform)
        return authenticationUtils.getProjectAndToken({
            userId: user.id,
            platformId: platform.id,
            projectId: null,
        })
    },
    async switchProject(params: SwitchProjectParams): Promise<AuthenticationResponse> {
        const project = await projectService.getOneOrThrow(params.projectId)
        const projectPlatform = await platformService.getOneOrThrow(project.platformId)
        await assertUserCanSwitchToPlatform(params.currentPlatformId, projectPlatform)
        const user = await getUserForPlatform(params.identityId, projectPlatform)
        return authenticationUtils.getProjectAndToken({
            userId: user.id,
            platformId: project.platformId,
            projectId: params.projectId,
        })
    },
})

async function assertUserCanSwitchToPlatform(currentPlatformId: string | null, platform: PlatformWithoutSensitiveData | undefined): Promise<void> {
    if (isNil(platform)) {
        throw new ActivepiecesError({
            code: ErrorCode.AUTHORIZATION,
            params: {
                message: 'The user is not a member of the platform',
            },
        })
    }
    const samePlatform = currentPlatformId === platform.id
    const allowToSwitch = !platformUtils.isEnterpriseCustomerOnCloud(platform) || samePlatform
    if (!allowToSwitch) {
        throw new ActivepiecesError({
            code: ErrorCode.AUTHENTICATION,
            params: {
                message: 'The user is not a member of the platform',
            },
        })
    }
}

async function getUserForPlatform(identityId: string, platform: PlatformWithoutSensitiveData): Promise<User> {
    const user = await userService.getOneByIdentityAndPlatform({
        identityId,
        platformId: platform.id,
    })
    if (isNil(user)) {
        throw new ActivepiecesError({
            code: ErrorCode.AUTHORIZATION,
            params: {
                message: 'User is not member of the platform',
            },
        })
    }
    return user
}

async function createUserAndPlatform(userIdentity: UserIdentity, log: FastifyBaseLogger): Promise<AuthenticationResponse> {
    const user = await userService.create({
        identityId: userIdentity.id,
        platformRole: PlatformRole.ADMIN,
        platformId: null,
    })
    const platform = await platformService.create({
        ownerId: user.id,
        name: userIdentity.firstName + '\'s Platform',
    })
    await userService.addOwnerToPlatform({
        platformId: platform.id,
        id: user.id,
    })
    const defaultProject = await projectService.create({
        displayName: userIdentity.firstName + '\'s Project',
        ownerId: user.id,
        platformId: platform.id,
    })

    const cloudEdition = system.getEdition()
    switch (cloudEdition) {
        case ApEdition.CLOUD:
            await otpService(log).createAndSend({
                platformId: platform.id,
                email: userIdentity.email,
                type: OtpType.EMAIL_VERIFICATION,
            })
            break
        case ApEdition.COMMUNITY:
        case ApEdition.ENTERPRISE:
            await userIdentityService(log).verify(userIdentity.id)
            break
    }

    await flagService.save({
        id: ApFlagId.USER_CREATED,
        value: true,
    })
    await authenticationUtils.sendTelemetry({
        identity: userIdentity,
        user,
        project: defaultProject,
        log,
    })
    await authenticationUtils.saveNewsLetterSubscriber(user, platform.id, userIdentity, log)

    return authenticationUtils.getProjectAndToken({
        userId: user.id,
        platformId: platform.id,
        projectId: defaultProject.id,
    })
}

async function getPersonalPlatformIdForFederatedAuthn(email: string, log: FastifyBaseLogger): Promise<string | null> {
    const identity = await userIdentityService(log).getIdentityByEmail(email)
    if (isNil(identity)) {
        return null
    }
    return getPersonalPlatformIdForIdentity(identity.id)
}

async function getPersonalPlatformIdForIdentity(identityId: string): Promise<string | null> {
    const edition = system.getEdition()
    if (edition === ApEdition.CLOUD) {
        const platforms = await platformService.listPlatformsForIdentityWithAtleastProject({ identityId })
        const platform = platforms.find((platform) => !platformUtils.isEnterpriseCustomerOnCloud(platform))
        return platform?.id ?? null
    }
    return null
}

type FederatedAuthnParams = {
    email: string
    firstName: string
    lastName: string
    newsLetter: boolean
    trackEvents: boolean
    provider: UserIdentityProvider
    predefinedPlatformId: string | null
}

type SignUpParams = {
    email: string
    firstName: string
    lastName: string
    password: string
    platformId: string | null
    trackEvents: boolean
    newsLetter: boolean
    provider: UserIdentityProvider
}

type SignInWithPasswordParams = {
    email: string
    password: string
    predefinedPlatformId: string | null
}

type SwitchPlatformParams = {
    identityId: string
    platformId: string
}

type SwitchProjectParams = {
    identityId: string
    currentPlatformId: string
    projectId: string
}