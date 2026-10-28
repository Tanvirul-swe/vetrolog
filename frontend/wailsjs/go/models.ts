export namespace adb {
	
	export class App {
	    packageName: string;
	    isDebuggable: boolean;
	    displayName: string;
	    isRunning: boolean;
	    pid: string;
	
	    static createFrom(source: any = {}) {
	        return new App(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.packageName = source["packageName"];
	        this.isDebuggable = source["isDebuggable"];
	        this.displayName = source["displayName"];
	        this.isRunning = source["isRunning"];
	        this.pid = source["pid"];
	    }
	}
	export class ColumnMeta {
	    name: string;
	    type: string;
	    isPrimaryKey: boolean;
	    isNullable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ColumnMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.isPrimaryKey = source["isPrimaryKey"];
	        this.isNullable = source["isNullable"];
	    }
	}
	export class Device {
	    id: string;
	    model: string;
	    product: string;
	    device: string;
	    transportId: string;
	    state: string;
	    isEmulator: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Device(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.model = source["model"];
	        this.product = source["product"];
	        this.device = source["device"];
	        this.transportId = source["transportId"];
	        this.state = source["state"];
	        this.isEmulator = source["isEmulator"];
	    }
	}
	export class TableMeta {
	    name: string;
	    type: string;
	    rowCount: number;
	    columns: ColumnMeta[];
	
	    static createFrom(source: any = {}) {
	        return new TableMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.rowCount = source["rowCount"];
	        this.columns = this.convertValues(source["columns"], ColumnMeta);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DiscoveredDB {
	    id: string;
	    name: string;
	    type: string;
	    path: string;
	    sizeBytes: number;
	    updatedAt: number;
	    tables: TableMeta[];
	
	    static createFrom(source: any = {}) {
	        return new DiscoveredDB(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.path = source["path"];
	        this.sizeBytes = source["sizeBytes"];
	        this.updatedAt = source["updatedAt"];
	        this.tables = this.convertValues(source["tables"], TableMeta);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class IndexMeta {
	    seq: number;
	    name: string;
	    unique: boolean;
	    origin: string;
	    partial: boolean;
	    columns: string[];
	
	    static createFrom(source: any = {}) {
	        return new IndexMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.seq = source["seq"];
	        this.name = source["name"];
	        this.unique = source["unique"];
	        this.origin = source["origin"];
	        this.partial = source["partial"];
	        this.columns = source["columns"];
	    }
	}
	export class ForeignKeyMeta {
	    id: number;
	    seq: number;
	    toTable: string;
	    fromCol: string;
	    toCol: string;
	    onUpdate: string;
	    onDelete: string;
	
	    static createFrom(source: any = {}) {
	        return new ForeignKeyMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.seq = source["seq"];
	        this.toTable = source["toTable"];
	        this.fromCol = source["fromCol"];
	        this.toCol = source["toCol"];
	        this.onUpdate = source["onUpdate"];
	        this.onDelete = source["onDelete"];
	    }
	}
	export class ExtendedTableSchema {
	    name: string;
	    type: string;
	    rowCount: number;
	    columns: ColumnMeta[];
	    foreignKeys: ForeignKeyMeta[];
	    indexes: IndexMeta[];
	
	    static createFrom(source: any = {}) {
	        return new ExtendedTableSchema(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.rowCount = source["rowCount"];
	        this.columns = this.convertValues(source["columns"], ColumnMeta);
	        this.foreignKeys = this.convertValues(source["foreignKeys"], ForeignKeyMeta);
	        this.indexes = this.convertValues(source["indexes"], IndexMeta);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ExtendedSchemaResult {
	    databaseId: string;
	    tables: ExtendedTableSchema[];
	
	    static createFrom(source: any = {}) {
	        return new ExtendedSchemaResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.databaseId = source["databaseId"];
	        this.tables = this.convertValues(source["tables"], ExtendedTableSchema);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	export class PlanNode {
	    id: number;
	    parentId: number;
	    detail: string;
	    operation: string;
	    table?: string;
	    indexName?: string;
	    costAlert: string;
	    children?: PlanNode[];
	
	    static createFrom(source: any = {}) {
	        return new PlanNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.parentId = source["parentId"];
	        this.detail = source["detail"];
	        this.operation = source["operation"];
	        this.table = source["table"];
	        this.indexName = source["indexName"];
	        this.costAlert = source["costAlert"];
	        this.children = this.convertValues(source["children"], PlanNode);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class QueryExecResult {
	    query: string;
	    columns: string[];
	    rows: any[];
	    affected: number;
	    durationMs: number;
	    success: boolean;
	    error?: string;
	    defaultLimitApplied?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new QueryExecResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.query = source["query"];
	        this.columns = source["columns"];
	        this.rows = source["rows"];
	        this.affected = source["affected"];
	        this.durationMs = source["durationMs"];
	        this.success = source["success"];
	        this.error = source["error"];
	        this.defaultLimitApplied = source["defaultLimitApplied"];
	    }
	}
	export class QueryPlanResult {
	    rawNodes: PlanNode[];
	    rootNodes: PlanNode[];
	    hasFullScan: boolean;
	    hasTempBTree: boolean;
	    summary: string;
	    durationMs: number;
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new QueryPlanResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rawNodes = this.convertValues(source["rawNodes"], PlanNode);
	        this.rootNodes = this.convertValues(source["rootNodes"], PlanNode);
	        this.hasFullScan = source["hasFullScan"];
	        this.hasTempBTree = source["hasTempBTree"];
	        this.summary = source["summary"];
	        this.durationMs = source["durationMs"];
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SimulationResult {
	    query: string;
	    isMutation: boolean;
	    affectedRows: number;
	    previewRows?: any[];
	    durationMs: number;
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new SimulationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.query = source["query"];
	        this.isMutation = source["isMutation"];
	        this.affectedRows = source["affectedRows"];
	        this.previewRows = source["previewRows"];
	        this.durationMs = source["durationMs"];
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class TableDataResult {
	    databaseId: string;
	    tableName: string;
	    totalRows: number;
	    page: number;
	    pageSize: number;
	    columns: ColumnMeta[];
	    rows: any[];
	    tableCounts?: Record<string, number>;
	
	    static createFrom(source: any = {}) {
	        return new TableDataResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.databaseId = source["databaseId"];
	        this.tableName = source["tableName"];
	        this.totalRows = source["totalRows"];
	        this.page = source["page"];
	        this.pageSize = source["pageSize"];
	        this.columns = this.convertValues(source["columns"], ColumnMeta);
	        this.rows = source["rows"];
	        this.tableCounts = source["tableCounts"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace models {
	
	export class DeviceInfo {
	    id: string;
	    name: string;
	    platform: string;
	    osVersion: string;
	    appId: string;
	    connectedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new DeviceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.platform = source["platform"];
	        this.osVersion = source["osVersion"];
	        this.appId = source["appId"];
	        this.connectedAt = source["connectedAt"];
	    }
	}
	export class ConnectionState {
	    isConnected: boolean;
	    port: number;
	    host: string;
	    currentDevice?: DeviceInfo;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.isConnected = source["isConnected"];
	        this.port = source["port"];
	        this.host = source["host"];
	        this.currentDevice = this.convertValues(source["currentDevice"], DeviceInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace types {
	
	export class ChangeResult {
	    success: boolean;
	    affectedRows: number;
	    generatedSql?: string;
	    durationMs: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ChangeResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.affectedRows = source["affectedRows"];
	        this.generatedSql = source["generatedSql"];
	        this.durationMs = source["durationMs"];
	        this.error = source["error"];
	    }
	}
	export class ColumnInfo {
	    name: string;
	    type: string;
	    isPrimaryKey: boolean;
	    isNullable: boolean;
	    defaultValue?: string;
	    extra?: string;
	    comment?: string;
	
	    static createFrom(source: any = {}) {
	        return new ColumnInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.isPrimaryKey = source["isPrimaryKey"];
	        this.isNullable = source["isNullable"];
	        this.defaultValue = source["defaultValue"];
	        this.extra = source["extra"];
	        this.comment = source["comment"];
	    }
	}
	export class ConnectionSummary {
	    id: string;
	    name: string;
	    engine: string;
	    host: string;
	    port: number;
	    database: string;
	    colorTag: string;
	    environment: string;
	    safeMode: boolean;
	    filePath?: string;
	    hasSSH: boolean;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.engine = source["engine"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.database = source["database"];
	        this.colorTag = source["colorTag"];
	        this.environment = source["environment"];
	        this.safeMode = source["safeMode"];
	        this.filePath = source["filePath"];
	        this.hasSSH = source["hasSSH"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class ConnectionSession {
	    sessionId: string;
	    config: ConnectionSummary;
	    connectedAt: number;
	    currentDatabase: string;
	    currentSchema: string;
	    pingDurationMs: number;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionSession(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.config = this.convertValues(source["config"], ConnectionSummary);
	        this.connectedAt = source["connectedAt"];
	        this.currentDatabase = source["currentDatabase"];
	        this.currentSchema = source["currentSchema"];
	        this.pingDurationMs = source["pingDurationMs"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ConnectionTestResult {
	    success: boolean;
	    latencyMs: number;
	    serverVersion?: string;
	    message?: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionTestResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.latencyMs = source["latencyMs"];
	        this.serverVersion = source["serverVersion"];
	        this.message = source["message"];
	        this.error = source["error"];
	    }
	}
	export class ForeignKeyInfo {
	    constraintName: string;
	    column: string;
	    refTable: string;
	    refColumn: string;
	    onUpdate: string;
	    onDelete: string;
	
	    static createFrom(source: any = {}) {
	        return new ForeignKeyInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.constraintName = source["constraintName"];
	        this.column = source["column"];
	        this.refTable = source["refTable"];
	        this.refColumn = source["refColumn"];
	        this.onUpdate = source["onUpdate"];
	        this.onDelete = source["onDelete"];
	    }
	}
	export class IndexInfo {
	    name: string;
	    columns: string[];
	    isUnique: boolean;
	    isPrimary: boolean;
	    type: string;
	
	    static createFrom(source: any = {}) {
	        return new IndexInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.columns = source["columns"];
	        this.isUnique = source["isUnique"];
	        this.isPrimary = source["isPrimary"];
	        this.type = source["type"];
	    }
	}
	export class ExtendedTableSchema {
	    tableName: string;
	    name?: string;
	    schema: string;
	    type: string;
	    columns: ColumnInfo[];
	    primaryKeys: string[];
	    indexes: IndexInfo[];
	    foreignKeys: ForeignKeyInfo[];
	    rowCount: number;
	
	    static createFrom(source: any = {}) {
	        return new ExtendedTableSchema(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tableName = source["tableName"];
	        this.name = source["name"];
	        this.schema = source["schema"];
	        this.type = source["type"];
	        this.columns = this.convertValues(source["columns"], ColumnInfo);
	        this.primaryKeys = source["primaryKeys"];
	        this.indexes = this.convertValues(source["indexes"], IndexInfo);
	        this.foreignKeys = this.convertValues(source["foreignKeys"], ForeignKeyInfo);
	        this.rowCount = source["rowCount"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class QueryPlanResult {
	    rawPlan: string;
	    nodes?: any;
	    durationMs: number;
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new QueryPlanResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rawPlan = source["rawPlan"];
	        this.nodes = source["nodes"];
	        this.durationMs = source["durationMs"];
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class QueryResult {
	    requestId: string;
	    query: string;
	    columns: ColumnInfo[];
	    rows: any[];
	    affected: number;
	    durationMs: number;
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new QueryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.requestId = source["requestId"];
	        this.query = source["query"];
	        this.columns = this.convertValues(source["columns"], ColumnInfo);
	        this.rows = source["rows"];
	        this.affected = source["affected"];
	        this.durationMs = source["durationMs"];
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RedisKeyInfo {
	    key: string;
	    type: string;
	    ttl: number;
	    ttlSec: number;
	    sizeBytes: number;
	
	    static createFrom(source: any = {}) {
	        return new RedisKeyInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.type = source["type"];
	        this.ttl = source["ttl"];
	        this.ttlSec = source["ttlSec"];
	        this.sizeBytes = source["sizeBytes"];
	    }
	}
	export class RedisScanResult {
	    keys: RedisKeyInfo[];
	    cursor: number;
	    totalEstimate: number;
	    durationMs: number;
	
	    static createFrom(source: any = {}) {
	        return new RedisScanResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.keys = this.convertValues(source["keys"], RedisKeyInfo);
	        this.cursor = source["cursor"];
	        this.totalEstimate = source["totalEstimate"];
	        this.durationMs = source["durationMs"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RedisValueResult {
	    key: string;
	    type: string;
	    ttlSec: number;
	    value: any;
	    success: boolean;
	    durationMs: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new RedisValueResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.type = source["type"];
	        this.ttlSec = source["ttlSec"];
	        this.value = source["value"];
	        this.success = source["success"];
	        this.durationMs = source["durationMs"];
	        this.error = source["error"];
	    }
	}
	export class TableDataResult {
	    tableName: string;
	    schema: string;
	    columns: ColumnInfo[];
	    rows: any[];
	    totalRows: number;
	    page: number;
	    pageSize: number;
	    durationMs: number;
	
	    static createFrom(source: any = {}) {
	        return new TableDataResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tableName = source["tableName"];
	        this.schema = source["schema"];
	        this.columns = this.convertValues(source["columns"], ColumnInfo);
	        this.rows = source["rows"];
	        this.totalRows = source["totalRows"];
	        this.page = source["page"];
	        this.pageSize = source["pageSize"];
	        this.durationMs = source["durationMs"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TableSummary {
	    name: string;
	    schema: string;
	    type: string;
	    rowCount: number;
	    sizeBytes?: number;
	
	    static createFrom(source: any = {}) {
	        return new TableSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.schema = source["schema"];
	        this.type = source["type"];
	        this.rowCount = source["rowCount"];
	        this.sizeBytes = source["sizeBytes"];
	    }
	}

}

export namespace updater {
	
	export class UpdateInfo {
	    currentVersion: string;
	    latestVersion: string;
	    releaseName: string;
	    releaseNotes: string;
	    releaseUrl: string;
	    assetUrl: string;
	    assetName: string;
	    assetSize: number;
	    publishedAt: string;
	    hasUpdate: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.releaseName = source["releaseName"];
	        this.releaseNotes = source["releaseNotes"];
	        this.releaseUrl = source["releaseUrl"];
	        this.assetUrl = source["assetUrl"];
	        this.assetName = source["assetName"];
	        this.assetSize = source["assetSize"];
	        this.publishedAt = source["publishedAt"];
	        this.hasUpdate = source["hasUpdate"];
	    }
	}

}

