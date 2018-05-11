import { TransformCallback,cbErrorIfContentsTypeNotSupported,Transform,TransformOptions,File,PluginError } from "th-gulpHelpers";
export { TransformCallback,cbErrorIfContentsTypeNotSupported,Transform,TransformOptions,File,PluginError } from "th-gulpHelpers";
//#region options
export type StringOmit<L1 extends string, L2 extends string> = ({ [P in L1]: P } &
    { [P in L2]: never } & { [key: string]: never })[L1]
export type ObjectOverwrite<O1, O2> = Pick<O1, StringOmit<keyof O1, keyof O2>> & O2
export interface GulpTransformBaseOptions{
    supportsBuffer?:boolean,
    supportsStream?:boolean,
    pluginName?:string
}

export interface GulpTransformedBaseOptions extends GulpTransformBaseOptions{
    supportsBuffer:boolean,
    supportsStream:boolean
}
//#endregion

export class IncorrectTransformedFileTypeError extends Error{ 
    constructor(transformedToBuffer:boolean){
        super(transformedToBuffer?"File was transformed to buffer from stream":"File was transformed to strea, from buffer");
    }
    incorrectTransformedFileTypeError=true
    static create(pluginName:string,transformedToBuffer:boolean){
        return new PluginError(pluginName,new IncorrectTransformedFileTypeError(transformedToBuffer));
    }
}
export abstract class GulpTransformBase<T extends GulpTransformBaseOptions=GulpTransformBaseOptions> extends Transform{
    protected options:ObjectOverwrite<T,GulpTransformedBaseOptions>
    private processingBufferFile=false;
    private thrownBadFileType=false;
    private cb:TransformCallback=()=>{};
    constructor(options:T,transformOptions?:TransformOptions){
        super({...transformOptions,...{objectMode:true}})
        const defaultValues:GulpTransformBaseOptions={supportsBuffer:true,supportsStream:true};
        const thisOptions={}
        this.options=Object.assign({},defaultValues,options)  as any as ObjectOverwrite<T,GulpTransformedBaseOptions>;
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
    getIncorrectTypeError(transformedToBuffer:boolean){
        this.thrownBadFileType=true;
        return IncorrectTransformedFileTypeError.create(this.getPluginName(),transformedToBuffer);
    }
    returnedFileIsOfCorrectType(file:File){
        if(file.isBuffer()){
            return this.processingBufferFile
        }
        return !this.processingBufferFile;
    }
    protected abstract ignoreFile(file:File):boolean
    protected abstract filterFile(file:File):boolean
    private getPluginName(){
        return this.options.pluginName?this.options.pluginName:(<any>this).constructor.name;
    }
    private processUnsupported(file:File,cb:TransformCallback){
        
        return cbErrorIfContentsTypeNotSupported(this.getPluginName(),file,cb,!this.options.supportsBuffer,!this.options.supportsStream);
    }
    private processIgnoreFile(file:File,cb:TransformCallback):boolean{
        const ignored= this.ignoreFile(file);
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
        let processed=this.processUnsupported(file,cb);
        if(!processed){
            processed=this.processFilterFile(file,cb);
            if(!processed){
                processed=this.processIgnoreFile(file,cb);
            }
        }
        return processed;
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
            
            if(file.isBuffer()){
                this.transformBufferFile(file,file.contents,encoding,fakeCallback);
            }else{
                this.transformStreamFile(file,file.contents as NodeJS.ReadableStream,encoding,fakeCallback);
            }
        }
    }
    protected abstract transformBufferFile(file:File,contents:Buffer,encoding:string,cb:TransformCallback):void;
    protected abstract transformStreamFile(file:File,contents:NodeJS.ReadableStream,encoding:string,cb:TransformCallback):void;
}
