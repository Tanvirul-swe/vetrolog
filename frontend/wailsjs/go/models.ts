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

