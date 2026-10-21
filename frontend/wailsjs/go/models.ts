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

