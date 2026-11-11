import { INJECT_DECORATOR_METADATA_KEY } from './inject.decorator.js';
import { INJECTABLE_DECORATOR_METADATA_KEY, type InjectableMeta } from './injectable.decorator.js';
import { MODULE_DECORATOR_METADATA_KEY } from './module.decorator.js';
import type { ModuleClass, ModuleMeta, ProviderDef, Token } from './types.js';

export class IocContainer {
    private providers = new Map<Token, ProviderDef>();
    private globalModules = new Set<ModuleClass>();
    private moduleExports = new Map<ModuleClass, Set<Token>>();
    private moduleImports = new Map<ModuleClass, Set<ModuleClass>>();
    private processedModules = new Set<ModuleClass>();

    public register(provider: any, module?: ModuleClass) {
        if (typeof provider === 'function') {
            // if provider is module or class without "useClass"
            const meta = Reflect.getMetadata(INJECTABLE_DECORATOR_METADATA_KEY, provider) as InjectableMeta;
            const scope = meta?.scope ?? 'singleton';
            const isModuleClass = !!Reflect.getMetadata(MODULE_DECORATOR_METADATA_KEY, provider);
            const providerModule = module ?? (isModuleClass ? provider : undefined);
            this.providers.set(provider, {
                type: 'class',
                useClass: provider,
                scope,
                module: providerModule,
            });
            return;
        }

        if ('useClass' in provider) {
            this.providers.set(provider.provide, {
                type: 'class',
                useClass: provider.useClass,
                scope: provider.scope || 'singleton',
                module,
            });
            return;
        }

        if ('useValue' in provider) {
            this.providers.set(provider.provide, {
                type: 'value',
                useValue: provider.useValue,
                scope: 'singleton',
                module,
            });
            return;
        }

        if ('useFactory' in provider) {
            this.providers.set(provider.provide, {
                type: 'factory',
                useFactory: provider.useFactory,
                inject: provider.inject || [],
                scope: provider.scope || 'singleton',
                module,
            });
            return;
        }

        if ('useExisting' in provider) {
            this.providers.set(provider.provide, {
                type: 'existing',
                useExisting: provider.useExisting,
                scope: 'singleton',
                module,
            });
            return;
        }

        throw new Error('Invalid provider');
    }

    public resolve<T>(token: Token, requestingModule?: ModuleClass): T {
        const provider = this.providers.get(token);
        if (!provider) throw new Error(`No provider for ${String(token)}`);

        if (requestingModule && provider.module && provider.module !== requestingModule) {
            const exported = this.moduleExports.get(provider.module) || new Set();
            if (!exported.has(token)) {
                throw new Error(`Provider ${String(token)} is private to module ${provider.module.name}`);
            }

            if (
                !this.globalModules.has(provider.module) &&
                !this.canAccessProviderModule(requestingModule, provider.module)
            ) {
                throw new Error(
                    `Module ${requestingModule.name} cannot access ${String(token)} from module ${provider.module.name}. Add ${provider.module.name} to ${requestingModule.name}'s imports.`,
                );
            }
        }

        if (provider.scope === 'singleton' && provider.instance) {
            return provider.instance as T;
        }

        let instance: any;
        switch (provider.type) {
            case 'value':
                instance = provider.useValue;
                break;
            case 'existing':
                instance = this.resolve(provider.useExisting, requestingModule);
                break;
            case 'factory': {
                const deps = (provider.inject || []).map(t => this.resolve(t, requestingModule));
                instance = provider.useFactory!(...deps);
                break;
            }
            case 'class':
            default:
                instance = this.instantiate(provider.useClass, provider.module);
        }

        if (provider.scope === 'singleton') provider.instance = instance;
        return instance as T;
    }

    public loadModule(entryModule: ModuleClass): void {
        this.loadModulesRecursively(entryModule);

        // processedModules is prepared; actual route mounting happens in initRoutes
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const moduleClass of this.processedModules) {
            // no-op: keep processedModules populated for later initRoutes
        }
    }

    private instantiate(cls: any, module?: ModuleClass): any {
        const paramTypes = Reflect.getMetadata('design:paramtypes', cls) || [];

        const injectTokens = Reflect.getMetadata(INJECT_DECORATOR_METADATA_KEY, cls) || {};
        const deps = paramTypes.map((type: any, index: number) => {
            const token = injectTokens[index] || type;
            if (!this.providers.has(token)) {
                throw new Error(
                    `No provider for ${String(token)} required by ${cls.name} constructor parameter ${index}`,
                );
            }
            return this.resolve(token, module);
        });
        return new cls(...deps);
    }

    private canAccessProviderModule(requestingModule: ModuleClass, providerModule: ModuleClass): boolean {
        if (requestingModule === providerModule) return true;

        const visited = new Set<ModuleClass>();
        const stack: ModuleClass[] = [requestingModule];

        while (stack.length) {
            const current = stack.pop()!;
            if (visited.has(current)) continue;
            visited.add(current);
            const imports = this.moduleImports.get(current);
            if (!imports) continue;
            if (imports.has(providerModule)) return true;
            imports.forEach(m => stack.push(m));
        }

        return false;
    }

    private addImports(module: ModuleClass, imports: ModuleClass[]) {
        if (!this.moduleImports.has(module)) {
            this.moduleImports.set(module, new Set());
        }
        const set = this.moduleImports.get(module)!;
        imports.forEach(m => set.add(m));
    }

    private addExports(module: ModuleClass | undefined, token: Token) {
        if (!module) return;
        if (!this.moduleExports.has(module)) {
            this.moduleExports.set(module, new Set());
        }
        this.moduleExports.get(module)!.add(token);
    }

    private loadModulesRecursively(moduleClass: ModuleClass) {
        if (this.processedModules.has(moduleClass)) return;
        this.processedModules.add(moduleClass);

        const meta = Reflect.getMetadata(MODULE_DECORATOR_METADATA_KEY, moduleClass) as ModuleMeta;
        if (!meta) {
            throw new Error(`${moduleClass.name} is not a module`);
        }

        if (meta.global) {
            this.globalModules.add(moduleClass);
        }

        // 👉 Register the module class itself
        this.register(moduleClass);

        if (meta.imports) {
            this.addImports(moduleClass, meta.imports);
            meta.imports.forEach((m: ModuleClass) => this.loadModulesRecursively(m));
        }

        if (meta.providers) {
            meta.providers.forEach((p: ModuleClass) => this.register(p, moduleClass));
        }

        if (meta.exports) {
            meta.exports.forEach((t: Token) => this.addExports(moduleClass, t));
        }
    }
}

export const iocContainer = new IocContainer();
