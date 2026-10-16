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
	export class QueryExecResult {
	    query: string;
	    rows: any[];
	    affected: number;
	    durationMs: number;
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new QueryExecResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.query = source["query"];
	        this.rows = source["rows"];
	        this.affected = source["affected"];
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

