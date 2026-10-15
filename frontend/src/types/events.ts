import { ConnectionState, DeviceInfo } from './connection';
import { DatabaseInfo, MutationEvent, QueryLog, TableDataPayload } from './database';

export interface VetroLogEventMap {
  'vetrolog:device_connected': DeviceInfo;
  'vetrolog:device_disconnected': DeviceInfo;
  'vetrolog:database_list': DatabaseInfo[];
  'vetrolog:table_data': TableDataPayload;
  'vetrolog:live_mutation': MutationEvent;
  'vetrolog:batch_mutations': MutationEvent[];
  'vetrolog:query_log': QueryLog;
  'vetrolog:connection_state': ConnectionState;
}
