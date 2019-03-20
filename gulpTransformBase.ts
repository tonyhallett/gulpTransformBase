import { TransformCallback,cbErrorIfContentsTypeNotSupported,Transform,TransformOptions,File,PluginError } from "th-gulpHelpers";
export { TransformCallback,cbErrorIfContentsTypeNotSupported,Transform,TransformOptions,File,PluginError } from "th-gulpHelpers";
//#region options
interface BaseOptions{
    supportsBuffer:boolean,
    supportsStream:boolean,
    pluginName:string
}
export type GulpTransformBaseOptions = Partial<BaseOptions>

export class IncorrectTransformedFileTypeError extends Error{ 
    constructor(transformedToBuffer:boolean){
        super(transformedToBuffer?"File was transformed to buffer from stream":"File was transformed to strea, from buffer");
    }
    incorrectTransformedFileTypeError=true
    static create(pluginName:string,transformedToBuffer:boolean){
        return new PluginError(pluginName,new IncorrectTransformedFileTypeError(transformedToBuffer));
    }
}
export abstract class GulpTransformBase<T={}> extends Transform{
    protected options:T|undefined;
    private defaultBaseOptions:BaseOptions={
        supportsBuffer:true,
        supportsStream:false,
        pluginName:""
    }

    private baseOptions:BaseOptions;
    private processingBufferFile=false;
    private thrownBadFileType=false;
    private cb!:TransformCallback
    constructor(options?:T,baseOptions?:GulpTransformBaseOptions,transformOptions?:TransformOptions){
        super({...transformOptions,...{objectMode:true}});
        var pluginName="";
        if(baseOptions&&baseOptions.pluginName){
            pluginName=baseOptions.pluginName;
        }else{
            pluginName=this.getPluginName((<any>this).constructor.name);
        }
        this.baseOptions=Object.assign({},this.defaultBaseOptions,baseOptions,{pluginName:pluginName});
        
        this.options=options;
        const realPush=this.push;
        this.push=(file:File,encoding?:string|undefined)=>{
            if(!file){
                return realPush.bind(this)(file,encoding);
            }
           const isCorrectType=this.returnedFileIsOfCorrectType(file);
           if(isCorrectType){
               if(!this.thrownBadFileType){
                 return realPush.bind(this)(file,encoding);
               }
           }else{
              this.cb(this.getIncorrectTypeError(file.isBuffer()));
           }
           return false;
        }
    }
    //later date change to have same arguments as PluginError constructor
    protected getPluginError(errorOrMessage:Error|string){
        if(errorOrMessage instanceof Error){
            if(!errorOrMessage.message){
                errorOrMessage.message="Plugin error";
            }
        }
        return new PluginError(this.baseOptions.pluginName,errorOrMessage);
    }
    private getIncorrectTypeError(transformedToBuffer:boolean){
        this.thrownBadFileType=true;
        return IncorrectTransformedFileTypeError.create(this.baseOptions.pluginName,transformedToBuffer);
    }
    private returnedFileIsOfCorrectType(file:File){
        if(file.isBuffer()){
            return this.processingBufferFile
        }
        return !this.processingBufferFile;
    }
    protected ignoreFile(file:File){
        return false;
    }
    protected  filterFile(file:File){
        return false;
    }
    private getPluginName(ctorName:string){
        //note that there is a package out there that uses the call stack to get the file name of the calling code
        return "gulp-" + ctorName.replace("Transform","").toLowerCase();
    }
    private processUnsupported(file:File,cb:TransformCallback){
        return cbErrorIfContentsTypeNotSupported(this.baseOptions.pluginName,file,cb,!this.baseOptions.supportsBuffer,!this.baseOptions.supportsStream);
    }
    private processIgnoreFile(file:File,cb:TransformCallback):boolean{
        const ignored=this.ignoreFile(file);
        
        if(ignored){
            cb(null,file);
        }
        return ignored;
    }
    private processFilterFile(file:File,cb:TransformCallback){
        const filtered=this.filterFile(file);

        if(filtered) cb();
        return filtered;
    }
    private preProcessFile(file:File,cb:TransformCallback){
        this.processingBufferFile=file.isBuffer();
        let didProcess=false;
        let processed=false;
        try{
            processed=this.processUnsupported(file,cb);
            if(!processed){
                processed=this.processFilterFile(file,cb);
                if(!processed){
                    processed=this.processIgnoreFile(file,cb);
                }
            }
        }catch(e){
            cb(this.getPluginError(e));
            didProcess=true;
        }
        return didProcess?didProcess:processed;
    }
    _transform(file:File,encoding:string,cb:TransformCallback){
        const processed=this.preProcessFile(file,cb);
        if(!processed){
            this.cb=cb;
            const fakeCallback:TransformCallback=(err,transformedFile)=>{
                if(err||!transformedFile){
                    this.cb(err,transformedFile);
                }else{
                    const isCorrectType=this.returnedFileIsOfCorrectType(transformedFile);
                    if(isCorrectType){
                        this.cb(null,transformedFile)
                    }else{
                        this.cb(this.getIncorrectTypeError(transformedFile.isBuffer()));
                    }
                }
                
            }
            try{
                if(file.isBuffer()){
                    this.transformBufferFile(file,file.contents,encoding,fakeCallback);
                }else if(file.isStream()){
                    this.transformStreamFile(file,file.contents as NodeJS.ReadableStream,encoding,fakeCallback);
                }else{
                    this.transformNullFile(file,encoding,fakeCallback);
                }
            }catch(e){
                this.cb(this.getPluginError(e));
            }
        }
    }
    protected  transformBufferFile(file:File,contents:Buffer,encoding:string,cb:TransformCallback){
        cb(null,file);
    }
    protected transformStreamFile(file:File,contents:NodeJS.ReadableStream,encoding:string,cb:TransformCallback){
        cb(null,file);
    }
    protected transformNullFile(file:File,encoding:string,cb:TransformCallback){
        cb(null,file);
    }
}

