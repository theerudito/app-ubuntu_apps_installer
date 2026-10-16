export namespace main {
	
	export class InstallResult {
	    success: boolean;
	    message: string;
	    output: string;
	
	    static createFrom(source: any = {}) {
	        return new InstallResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.output = source["output"];
	    }
	}
	export class InstalledApplication {
	    packageName: string;
	    version: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new InstalledApplication(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.packageName = source["packageName"];
	        this.version = source["version"];
	        this.description = source["description"];
	    }
	}

}

