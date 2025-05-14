import {
  Property,
  Store,
  StoreScope,
  createAction,
} from '@activepieces/pieces-framework';
import { constructQueueName, formatStorageError } from '../common';

const notes = `**Note:**
- This action will push each record individually to the queue
- The queue name should be unique across all flows
- The testing step works in isolation and doesn't affect the actual queue after publishing
`

export const pushRecordsToQueue = createAction({
  name: 'push-records-to-queue',
  description: 'Push individual records to queue',
  displayName: 'Push Records to Queue',
  props: {
    info: Property.MarkDown({
      value: notes,
    }),
    queueName: Property.ShortText({
      displayName: 'Queue Name',
      required: true,
    }),
    records: Property.Json({
      displayName: 'Records',
      description: 'Array of records to push to queue',
      required: true,
    }),
  },
  async run(context) {
    return pushRecords({ 
      store: context.store, 
      queueName: context.propsValue.queueName, 
      records: context.propsValue.records, 
      testing: false 
    });
  },
  async test(context) {
    return pushRecords({ 
      store: context.store, 
      queueName: context.propsValue.queueName, 
      records: context.propsValue.records, 
      testing: true 
    });
  }
});

async function pushRecords({ 
  store, 
  queueName, 
  records, 
  testing 
}: { 
  store: Store, 
  queueName: string, 
  records: unknown, 
  testing: boolean 
}) {
  const key = constructQueueName(queueName, testing);
  const existingQueueItems = await store.get<unknown[]>(key, StoreScope.PROJECT) || [];
  
  // Flatten the array if it's nested
  let flattenedRecords: unknown[] = [];
  if (Array.isArray(records)) {
    if (records.length === 1 && Array.isArray(records[0])) {
      flattenedRecords = records[0];
    } else {
      flattenedRecords = records;
    }
  } else {
    throw new Error('Records must be an array');
  }

  // Add each record individually to the queue
  const updatedQueueItems = [...existingQueueItems, ...flattenedRecords];
  
  try {
    return await store.put(key, updatedQueueItems, StoreScope.PROJECT);
  } catch (e: unknown) {
    const name = (e as Error)?.name;
    if (name === 'StorageLimitError') {
      throw formatStorageError(e);
    } else {
      throw e;
    }
  }
} 