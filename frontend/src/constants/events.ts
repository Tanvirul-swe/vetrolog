export const EVENTS = {
  DEVICE_CONNECTED: 'vetrolog:device_connected',
  DEVICE_DISCONNECTED: 'vetrolog:device_disconnected',
  DATABASE_LIST: 'vetrolog:database_list',
  TABLE_DATA: 'vetrolog:table_data',
  LIVE_MUTATION: 'vetrolog:live_mutation',
  BATCH_MUTATIONS: 'vetrolog:batch_mutations',
  QUERY_LOG: 'vetrolog:query_log',
  CONNECTION_STATE: 'vetrolog:connection_state',
} as const;
