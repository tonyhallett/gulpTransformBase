# What is it

An abstract Transform class to be used as a base class for a gulp transform.

## Typescript constructor signature

``` typescript
export interface GulpTransformBaseOptions{
    supportsBuffer?:boolean,
    supportsStream?:boolean,
    pluginName?:string
}

export abstract class GulpTransformBase<T> extends Transform{

    constructor(options?:T,baseOptions?:GulpTransformBaseOptions,transformOptions?:TransformOptions){
        super({...transformOptions,...{objectMode:true}});
....
```

Note that objectMode does not need to be provided.
Provided options are available through this.options.

## Transforms the transform process

It provides the _transform method and changes the functionality for derived classes through template methods to make the transformation easier.  

There are two pre process methods that can be overridden, ignoreFile and filterFile with the base class returning false for both.  

``` typescript
protected ignoreFile(file:File):boolean
protected  filterFile(file:File):boolean
```

Returning true for ignoreFile will pass the file through the callback and there will be no further processing.  Returning true for filterFile will call the callback without the file thus removing the file from down streams.

If the file has not been ignored or filtered then the file content type is determined and the applicable transformBufferFile, transformStreamFile or transformNullFile is called.  These methods work like the normal _transform method.  The transformBufferFile and transformStreamFile methods have the file contents as an additional argument.  Override as necessary.

``` typescript
e.g transformBufferFile(file:File,file.contents:Buffer,encoding:string,callback:(err?: any, data?: File)=>void)
```




## Error management
### No need to call the callback
**It wraps all calls to template methods in try/catch handlers.  Any exceptions are wrapped in a PluginError and the  _transform callback called appropriately.**
You can throw a string or an error. If an error has no message a default error message will be added, as the PluginError itself will throw otherwise. 

### Ensures transformed file is same type as original
This class ensures that your plugin can only return file contents of the same type ( Buffer | Stream ) that it received.  It will throw a PluginError if you do not adhere to this.

### Supported file types
Through options or default values ( supportsBuffer:true,supportsStream:false ) it deals with unsupported file contents type, throwing a PluginError wrapping a FileContentsTypeNotSupportedError whose BufferNotSupported property will be true if received an unsupported buffer or false if received an unsupported stream.

### Plugin name
Created PluginError instances have the plugin name taken from ctor option or by using the name of the derived class.
The default plugin name is the class name to lowercase with the word transform removed, prefixed with 'gulp-'.

 







