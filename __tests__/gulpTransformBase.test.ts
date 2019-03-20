
import {TransformCallback} from 'th-gulpHelpers'
import {createStreamFile,createBufferFile,pluginTest,ignoresFile,filtersFile,File,PluginError, throwsPluginErrorOnUnsupportedContentType} from 'gulpPluginTestHelpers'
import {GulpTransformBase,GulpTransformBaseOptions} from '../gulpTransformBase'
import intoStream =require('into-stream');
import { create } from 'domain';
enum BadFileType{None,Cb,Push}
enum IgnoreFilter{None,Ignore,Filter}
enum ErrorWhen{IgnoreFile,FilterFile,TransformBufferFile,TransformStreamFile}
interface TestTransformBaseOptions{
    badFileType:BadFileType,
    ignoreFilter?:IgnoreFilter;
    error?:Error,
    errorWhen?:ErrorWhen
}
class TestError extends Error{
    constructor(msg:string){
        super(msg);
    }
    TestErrorProp="TestError";
}
class TestTransformBase extends GulpTransformBase<TestTransformBaseOptions> {
    constructor(options:TestTransformBaseOptions,baseOptions?:GulpTransformBaseOptions){
        super(options,baseOptions);
    }
    private throwError(errorWhen:ErrorWhen){
        if(this.options.error&&this.options.errorWhen===errorWhen){
            throw this.options.error;
        }
    }
    ignoreFile(file: File): boolean {
        this.throwError(ErrorWhen.IgnoreFile);
        return this.options.ignoreFilter===IgnoreFilter.Ignore;
    }
    filterFile(file: File): boolean {
        this.throwError(ErrorWhen.FilterFile);
        return this.options.ignoreFilter===IgnoreFilter.Filter;
    }
    transformBufferFile(file: File, contents: Buffer, encoding: string, cb: TransformCallback): void {
        this.throwError(ErrorWhen.TransformBufferFile);
        const badStreamFile=createStreamFile("");
        if(this.options.badFileType===BadFileType.Cb){
            return cb(null,badStreamFile);
        }else if(this.options.badFileType===BadFileType.Push){
            this.push(badStreamFile);
            this.push(createBufferFile(""));
        }else{
            this.push(createBufferFile(""));
            this.push(createBufferFile(""));
        }
    }
    transformStreamFile(file: File, contents: NodeJS.ReadableStream, encoding: string, cb: TransformCallback): void {
        this.throwError(ErrorWhen.TransformStreamFile);
        const badBufferFile=createBufferFile("");
        if(this.options.badFileType===BadFileType.Cb){
            return cb(null,badBufferFile);
        }else if(this.options.badFileType===BadFileType.Push){
            this.push(badBufferFile);
            this.push(createStreamFile(""));
        }else{
            this.push(createStreamFile(""));
            this.push(createStreamFile(""));
        }
    }
}
class TestVirtualMethodsTransform extends GulpTransformBase{
    constructor(){
        super({},{supportsBuffer:true,supportsStream:true})
    }
};
class ThrowStringTransform extends GulpTransformBase{
    static thrownString="Thown a string";
    constructor(pluginName?:string){
        if(pluginName){
            super({},{pluginName:pluginName});
        }else{
            super();
        }
        
    }
   
    transformBufferFile(file: File, contents: Buffer, encoding: string, cb: TransformCallback){
        throw ThrowStringTransform.thrownString;
    }
}
class ErrorOrNoTransformedFileTransform extends GulpTransformBase{
    constructor(private readonly returnError:boolean){
        super();
     }
     static error=new Error();
    transformBufferFile(file: File, contents: Buffer, encoding: string, cb: TransformCallback){
        if(this.returnError){
            cb(ErrorOrNoTransformedFileTransform.error,null);
        }else{
            cb(null,null);
        }
    }

}

describe('TransformBase',()=>{
    describe("transform methods when not overidden",()=>{
        [{file:createStreamFile(""),desc:"Stream"},
        {file:createBufferFile(""),desc:"Buffer"},
        {file:new File({
            contents: null
        }),desc:"Null"}].forEach(fd=>{
            it(`${fd.desc} - should cb(null,file) `,(done)=>{
                var transform=new TestVirtualMethodsTransform();
                var cbFile=null;
                var cbErr=null;
                var transformCallback:TransformCallback=(err,f)=>{
                    cbErr=err;
                    cbFile=f;

                    expect(cbFile).toBe(fd.file);
                    expect(cbErr).toBeNull();
                    done();
                }
                
                transform._transform(fd.file,"",transformCallback);
            });
        })
        
    })
    
    describe("unsupported content type",()=>{
        describe("buffer not supported",()=>{
            it('should throw',(done)=>{
                throwsPluginErrorOnUnsupportedContentType(done,new TestTransformBase({badFileType:BadFileType.None},{supportsBuffer:false}),false);
            })
        })
        describe("stream not supported",()=>{
            it('should throw when explicit',(done)=>{
                throwsPluginErrorOnUnsupportedContentType(done,new TestTransformBase({badFileType:BadFileType.None},{supportsStream:false}),true);
            })
            it('should throw when default',(done)=>{
                throwsPluginErrorOnUnsupportedContentType(done,new TestTransformBase({badFileType:BadFileType.None}),true);
            })
        })
        
    })
    it('should ignore',(done)=>{
        ignoresFile(done,new TestTransformBase({badFileType:BadFileType.None,ignoreFilter:IgnoreFilter.Ignore}),createBufferFile(""));
    })
        
    it('should filter',(done)=>{
        filtersFile(done,new TestTransformBase({badFileType:BadFileType.None,ignoreFilter:IgnoreFilter.Filter},{supportsStream:true}),createStreamFile(""));
    })

    //know it works for Buffer->Buffer , Stream -> Stream due to above tests 
    describe('replacement of this.push and callback - IncorrectTransformedFileTypeError when Type1 -> Type2',()=>{
        describe('when using the callback',()=>{
            it('should throw when stream -> buffer',(done)=>{
                pluginTest(done,new TestTransformBase({badFileType:BadFileType.Cb},{supportsStream:true}),createStreamFile(""),(files,e)=>{
                    expect(e).toBeInstanceOf(PluginError);
                    expect((e as any).incorrectTransformedFileTypeError).toBe(true);
                });
            })
            it('should throw when buffer -> stream',(done)=>{
                pluginTest(done,new TestTransformBase({badFileType:BadFileType.Cb}),createBufferFile(""),(files,e)=>{
                    expect(e).toBeInstanceOf(PluginError);
                    expect((e as any).incorrectTransformedFileTypeError).toBe(true);
                });
            })
            it('should pass through if callback provides error',(done)=>{
                pluginTest(done,new ErrorOrNoTransformedFileTransform(true),createBufferFile(""),(files,err)=>{
                    expect(err).toBe(ErrorOrNoTransformedFileTransform.error);
                    expect(files.length).toBe(0);
                })
            })
            it('should pass through if callback provides no file',(done)=>{
                pluginTest(done,new ErrorOrNoTransformedFileTransform(false),createBufferFile(""),(files,err)=>{
                    expect(err).toBeUndefined();
                    expect(files.length).toBe(0);
                })
            })
        });
        //have to distinguish between calling push and calling the callback
        describe('when pushing',()=>{
            it('should throw when stream -> buffer',(done)=>{
                pluginTest(done,new TestTransformBase({badFileType:BadFileType.Push},{supportsStream:true}),createStreamFile(""),(files,e)=>{
                    expect(e).toBeInstanceOf(PluginError);
                    expect((e as any).incorrectTransformedFileTypeError).toBe(true);
                });
            })
            it('should throw when buffer -> stream',(done)=>{
                pluginTest(done,new TestTransformBase({badFileType:BadFileType.Push}),createBufferFile(""),(files,e)=>{
                    expect(e).toBeInstanceOf(PluginError);
                    expect((e as any).incorrectTransformedFileTypeError).toBe(true);
                });
            })
        });
        
    })
    describe('catching of errors, wrapping in PluginError and cb(err)',()=>{
        
        describe("plugin name",()=>{
            function expectPluginErrorName(error:Error,pluginName:string){
                expect((<PluginError>error).plugin).toBe(pluginName);
            }
            it('should be from options when provided',(done)=>{
                var pluginName="gulp-mypluginname";//perhaps should have done some processing on provided
                
                pluginTest(done,new ThrowStringTransform(pluginName),createBufferFile(""),(files,error)=>{
                    expectPluginErrorName(error,pluginName)
                });
            })
            it('should be generated from the type name when not in options',done=>{
                pluginTest(done,new ThrowStringTransform(),createBufferFile(""),(files,error)=>{
                    expectPluginErrorName(error,"gulp-throwstring")
                });
            })
            
        })
        it('should create pluginerror from thrown string',done=>{
            pluginTest(done,new ThrowStringTransform(),createBufferFile(""),(files,error)=>{
                expect(error).toBeInstanceOf(PluginError);
                expect(error.message).toBe(ThrowStringTransform.thrownString);
            });
        })

        const testError=new TestError("Some message");
        function errorTest(errorWhen:ErrorWhen,done:jest.DoneCallback,error?:Error){
            let testErrorTest=false;
            if(!error){
                error=testError;
                testErrorTest=true;
            }
            let file:File;
            if(errorWhen===ErrorWhen.TransformStreamFile){
                file=createStreamFile("");
            }else{
                file=createBufferFile("");
            }
            pluginTest(done,
                new TestTransformBase(
                    {
                        badFileType:BadFileType.None,
                        error:error,
                        errorWhen:errorWhen,
                        
                    },
                    {
                        supportsStream:errorWhen===ErrorWhen.TransformStreamFile
                    }
                ),file,
                ((f,e)=>{
                    expect(e).toBeDefined();
                    expect(e).toBeInstanceOf(PluginError);
                    if(testErrorTest){
                        expect((e as any).TestErrorProp).toBe("TestError");
                        expect(e.message).toBe("Some message");
                    }else{
                        expect(e.message).toBe("Plugin error");
                    }
                    
                }),);
        }
        it('should handle errors in processIgnoreFile',(done)=>{
            errorTest(ErrorWhen.IgnoreFile,done);
        })
        it('should handle errors in processFilterFile',(done)=>{
            errorTest(ErrorWhen.FilterFile,done);
        })
        it('should handle errors in transformBufferFile',(done)=>{
            errorTest(ErrorWhen.TransformBufferFile,done);
        })
        it('should handle errors in transformStreamFile',(done)=>{
            errorTest(ErrorWhen.TransformStreamFile,done);
        })
        //
        it('should create an error message when the thrown error does not have one',(done)=>{
            errorTest(ErrorWhen.FilterFile,done,new Error());
        })
    })
})
