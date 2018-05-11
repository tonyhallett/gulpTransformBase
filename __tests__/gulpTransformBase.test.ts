
import {TransformCallback} from 'th-gulpHelpers'
import {createStreamFile,createBufferFile,pluginTest,ignoresFile,filtersFile,File,PluginError} from 'gulpPluginTestHelpers'
import {GulpTransformBase,GulpTransformBaseOptions} from '../gulpTransformBase'
import intoStream =require('into-stream');
enum BadFileType{None,Cb,Push}
enum IgnoreFilter{None,Ignore,Filter}
interface TestTransformBaseOptions extends GulpTransformBaseOptions{
    badFileType:BadFileType,
    ignoreFilter?:IgnoreFilter;
}
class TestTransformBase extends GulpTransformBase<TestTransformBaseOptions> {
    constructor(options:TestTransformBaseOptions){
        super(options);
    }
    protected ignoreFile(file: File): boolean {
        return this.options.ignoreFilter===IgnoreFilter.Ignore;
    }
    protected filterFile(file: File): boolean {
        return this.options.ignoreFilter===IgnoreFilter.Filter;
    }
    protected transformBufferFile(file: File, contents: Buffer, encoding: string, cb: TransformCallback): void {
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
})
