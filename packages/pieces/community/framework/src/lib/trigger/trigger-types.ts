export const isNil = (value: unknown): value is null | undefined => {
    return value === null || value === undefined;
};

export enum TriggerTestStrategy {
    SIMULATION = 'SIMULATION',
    TEST_FUNCTION = 'TEST_FUNCTION',
}

export enum WebhookHandshakeStrategy {
    NONE = 'NONE',
    HEADER_PRESENT = 'HEADER_PRESENT',
    QUERY_PRESENT = 'QUERY_PRESENT',
    BODY_PARAM_PRESENT = 'BODY_PARAM_PRESENT',
}

export interface WebhookHandshakeConfiguration {
    strategy: WebhookHandshakeStrategy;
    paramName?: string;
    paramValue?: string;
} 