# What is it

An abstract Transform class to be used as a base class for a gulp transform.

## Typescript constructor signature

``` typescript
export interface GulpTransformBaseOptions{
    supportsBuffer?:boolean,
    supportsStream?:boolean,
    pluginName?:string
}

export abstract class GulpTransformBase<T extends GulpTransformBaseOptions=GulpTransformBaseOptions> extends Transform{

constructor(options:T,transformOptions?:TransformOptions){
        super({...transformOptions,...{objectMode:true}});
....
```

Note that objectMode does not need to be provided.
Provided options are available through this.options.

## Transforms the transform process

It provides the _transform method and changes the functionality for derived classes through template methods to make the transformation easier.  There are two pre process methods that can be overridden, ignoreFile and filterFile with the base class returning false for both.  Both methods are passed the file.  Returning true for ignoreFile will pass the file through the callback and there will be no further processing.  Returning true for filterFile will call the callback without the file thus removing the file from down streams.  If the file has not been ignored or filtered then the file content type is determined and the applicable transformBufferFile, transformStreamFile or transformNullFile is called.  These methods work like the normal _transform method.  The transformBufferFile and transformStreamFile methods have the file contents as an additional argument.  Override one or both as necessary.

``` typescript
e.g transformBufferFile(file:File,file.contents:Buffer,encoding:string,callback:(err?: any, data?: File)=>void)
```

## Error functionality

It provides the helper method getPluginError which creates a PluginError with the plugin name taken from ctor option or by using the name of the derived class.  It also adds a default error message when not present as PluginError will throw otherwise.  The default plugin name  is the class name to lowercase with the word transform removed, prefixed with 'gulp-'.  The pluginName protected property is available if required.

``` typescript
protected getPluginError(errorOrMessage:Error|string){
```

**It wraps all calls to template methods in try/catch handlers calling the _transform callback with a PluginError wrapping the thrown error.  If an exception is thrown no further code will be executed after the callback has been called.**

Through options or default values ( supportsBuffer:true,supportsStream:false ) it deals with unsupported file contents type, throwing a PluginError wrapping a FileContentsTypeNotSupportedError whose BufferNotSupported property will be true if received an unsupported buffer or false if received an unsupported stream.

The abstract base class also ensures that your plugin can only return file contents of the same type ( Buffer | Stream ) that it received.  It will throw a PluginError if you do not adhere to this.
