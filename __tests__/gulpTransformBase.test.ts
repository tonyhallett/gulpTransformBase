
import {TransformCallback} from 'th-gulpHelpers'
import {createStreamFile,createBufferFile,pluginTest,ignoresFile,filtersFile,File,PluginError} from 'gulpPluginTestHelpers'
import {GulpTransformBase,GulpTransformBaseOptions} from '../gulpTransformBase'
import intoStream =require('into-stream');
enum BadFileType{None,Cb,Push}
enum IgnoreFilter{None,Ignore,Filter}
enum ErrorWhen{IgnoreFile,FilterFile,TransformBufferFile,TransformStreamFile}
interface TestTransformBaseOptions extends GulpTransformBaseOptions{
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
    constructor(options:TestTransformBaseOptions){
        super(options);
    }
    private throwError(errorWhen:ErrorWhen){
        if(this.options.error&&this.options.errorWhen===errorWhen){
            throw this.options.error;
        }
    }
    protected ignoreFile(file: File): boolean {
        this.throwError(ErrorWhen.IgnoreFile);
        return this.options.ignoreFilter===IgnoreFilter.Ignore;
    }
    protected filterFile(file: File): boolean {
        this.throwError(ErrorWhen.FilterFile);
        return this.options.ignoreFilter===IgnoreFilter.Filter;
    }
    protected transformBufferFile(file: File, contents: Buffer, encoding: string, cb: TransformCallback): void {
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
    protected transformStreamFile(file: File, contents: NodeJS.ReadableStream, encoding: string, cb: TransformCallback): void {
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

describe('TransformBase',()=>{
    it('should ignore',(done)=>{
        ignoresFile(done,new TestTransformBase({badFileType:BadFileType.None,ignoreFilter:IgnoreFilter.Ignore}),createBufferFile(""));
    })
        
    it('should filter',(done)=>{
        filtersFile(done,new TestTransformBase({badFileType:BadFileType.None,ignoreFilter:IgnoreFilter.Filter}),createStreamFile(""));
    })
    //know it works for Buffer->Buffer , Stream -> Stream due to above tests 
    describe('replacement of this.push and callback - IncorrectTransformedFileTypeError when Type1 -> Type2',()=>{
        describe('when using the callback',()=>{
            it('throw when stream -> buffer',(done)=>{
                pluginTest(done,new TestTransformBase({badFileType:BadFileType.Cb}),createStreamFile(""),(files,e)=>{
                    expect(e).toBeInstanceOf(PluginError);
                    expect((e as any).incorrectTransformedFileTypeError).toBe(true);
                });
            })
            it('throws when buffer -> stream',(done)=>{
                pluginTest(done,new TestTransformBase({badFileType:BadFileType.Cb}),createBufferFile(""),(files,e)=>{
                    expect(e).toBeInstanceOf(PluginError);
                    expect((e as any).incorrectTransformedFileTypeError).toBe(true);
                });
            })
            
        });
        describe('when pushing',()=>{
            it('throws when stream -> buffer',(done)=>{
                pluginTest(done,new TestTransformBase({badFileType:BadFileType.Push}),createStreamFile(""),(files,e)=>{
                    expect(e).toBeInstanceOf(PluginError);
                    expect((e as any).incorrectTransformedFileTypeError).toBe(true);
                });
            })
            it('throws when buffer -> stream',(done)=>{
                pluginTest(done,new TestTransformBase({badFileType:BadFileType.Push}),createBufferFile(""),(files,e)=>{
                    expect(e).toBeInstanceOf(PluginError);
                    expect((e as any).incorrectTransformedFileTypeError).toBe(true);
                });
            })
            
        });
    })
    describe('catching of errors, wrapping in PluginError and cb(err)',()=>{
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
                        errorWhen:errorWhen
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
        it('should create an error message when the thrown error does not have one',(done)=>{
            errorTest(ErrorWhen.FilterFile,done,new Error());
        })
    })
})
