export type Token<T = any> = T;
export type Scope = 'singleton' | 'transient';

export interface ProviderDef {
    type: 'class' | 'value' | 'factory' | 'existing';
    useClass?: any;
    useValue?: any;
    useFactory?: Function;
    inject?: Token[];
    useExisting?: Token;
    instance?: any;
    scope: Scope;
    module?: ModuleClass;
}

export type ModuleClass = any;

export interface ModuleMeta {
    providers?: any[];
    imports?: ModuleClass[];
    exports?: any[];
    global?: boolean;
}
