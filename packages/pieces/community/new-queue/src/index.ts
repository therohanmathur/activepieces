import { createPiece, PieceAuth } from '@activepieces/pieces-framework';
import { pushRecordsToQueue } from './lib/actions/push-records-to-queue';

export const newQueue = createPiece({
  displayName: 'New-queue',
  description: "A piece that allows you to push items into a queue, providing a way to throttle requests or process data in a First-In-First-Out (FIFO) manner.",
  auth: PieceAuth.None(),
  minimumSupportedRelease: '0.36.1',
  logoUrl: 'https://cdn.activepieces.com/pieces/queue.svg',
  authors: ['RohanMathur'],
  actions: [pushRecordsToQueue],
  triggers: [],
});
