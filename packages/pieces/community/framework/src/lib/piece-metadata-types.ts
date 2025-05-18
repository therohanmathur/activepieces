import { Type } from '@sinclair/typebox';

export enum LocalesEnum {
  EN = 'en',
  ES = 'es',
  FR = 'fr',
  DE = 'de',
  // Add more as needed
}

export enum PackageType {
  ARCHIVE = 'ARCHIVE',
  REGISTRY = 'REGISTRY',
}

export enum PieceType {
  CUSTOM = 'CUSTOM',
  OFFICIAL = 'OFFICIAL',
}

export type ProjectId = string;

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

export const WebhookHandshakeConfigurationType = Type.Object({
  strategy: Type.Enum(WebhookHandshakeStrategy),
  paramName: Type.Optional(Type.String()),
  paramValue: Type.Optional(Type.String()),
}); 