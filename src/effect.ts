// @ts-nocheck
type EffectFn = (...arg: any[]) => any;
type Deps = Set<ReactiveEffect>;

type KeyToDepMap = Map<string | Symbol, Deps>;

type ReactiveEffectOptions = {
    lazy?: boolean,
    scheduler?: (reactiveEffect: ReactiveEffect) => any;
};

enum TriggerType { ADD, SET, DELETE }

const data = {
    bar: 1,
    foo: 1
};

/**
 * sotre all the effect, and
 * structure like obj -> key -> Set<EffectFnWithDeps>
 */
const bucket = new WeakMap<object, KeyToDepMap>();


const effectStack: ReactiveEffect[] = [];

/**
 * Refer to the currently executing effect function
 */
let activeEffect: ReactiveEffect;

/* The ReactiveEffect class represents a reactive effect that can be run and has dependencies and
options. */
class ReactiveEffect {
    private _fn: EffectFn;
    public deps: Deps[] = [];
    public options: ReactiveEffectOptions = {};

    constructor(fn: () => void) {
        this._fn = fn;
    }

    public run() {
        cleanupEffect(this);
        activeEffect = this;
        effectStack.push(this);
        try {
            return this._fn();
        } catch (e) {
            console.error('effect funtion execute failed');
        } finally {
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1];
        }
    }
}

/**
 * self-defined array prototype method
 * @todo here is some typescript bugs, but ok for javascript
 */
const arrayInstrumentations = {};
['includes', 'indexOf', 'lastIndexOf'].forEach(method => {
    const originMethod = Array.prototype[method];
    arrayInstrumentations[method] = function (...args: any[]) {
        let res = originMethod.apply(this, args);
        if (res === false || res === -1) {
            res = originMethod.apply(this.__raw, args);
        }
        return res;
    };
});

let shouldTrack = true;
['push', 'pop', 'shift', 'unshift', 'splice'].forEach(method => {
    const originMethod = Array.prototype[method];
    arrayInstrumentations[method] = function (...args: any[]) {
        shouldTrack = false;
        let res = originMethod.apply(this, args);
        shouldTrack = true;
    };
});

/**
 * The "effect" function creates a new reactive effect and runs it immediately or returns it if lazy
 * option is set.
 * @param {EffectFn} fn - A function that will be executed when the reactive effect is run.
 * @param {ReactiveEffectOptions} options - The `options` parameter is an optional object that can be
 * passed to the `effect` function. It allows you to customize the behavior of the reactive effect. The
 * available options are:
 * @returns The `effect` function returns either the result of calling `reactiveEffect.run()` if
 * `options.lazy` is falsy, or it returns the `reactiveEffect` object itself if `options.lazy` is
 * truthy.
 */
function effect(fn: EffectFn, options: ReactiveEffectOptions = {}) {
    const reactiveEffect = new ReactiveEffect(fn);
    reactiveEffect.options = options;

    if (!options.lazy) {
        return reactiveEffect.run();
    }
    return reactiveEffect;
}

/**
 * The function cleans up the dependencies of an effect function by removing it from each dependency's
 * list of dependent functions and resetting the effect function's list of dependencies.
 * @param {EffectFnWithDeps} effectFn - A function that represents an effect to be cleaned up.
 */
function cleanupEffect(reactiveEffect: ReactiveEffect) {
    reactiveEffect.deps.forEach(dep => dep.delete(reactiveEffect));
    reactiveEffect.deps.length = 0;
}

/**
 * The function adds a dependency between a target object and a reactive property key.
 * @param {object} target - The target parameter is an object that we want to track for changes.
 * @param {any} key - The `key` parameter is the property key that is being accessed or modified on the
 * `target` object. It is used to track dependencies between reactive properties and their effects.
 * @returns If `activeEffect` is falsy (e.g. `null`, `undefined`, `false`, etc.), then nothing is being
 * returned. The function simply exits early and does not execute any further code.
 */
function track(target: object, key: any) {
    if (!shouldTrack || !activeEffect) return;

    let depsMap = bucket.get(target);

    if (!depsMap) {
        depsMap = new Map();
        bucket.set(target, depsMap);
    }

    let deps = depsMap.get(key);
    if (!deps) {
        deps = new Set();
        depsMap.set(key, deps);
    }
    deps.add(activeEffect);
    activeEffect.deps.push(deps);
}

/**
 * This function triggers reactive effects when a target object's key is changed.
 * @param {object} target - The target object that has a property being accessed or modified.
 * @param {any} key - The `key` parameter is a value that represents a property key on an object. It is
 * used to identify which property has been updated and trigger any associated reactive effects.
 * @returns If `depsMap` or `effects` are not found, `undefined` is being returned.
 */
function trigger(target: object, key: any, type: TriggerType, newVal?: any) {
    const depsMap = bucket.get(target);
    if (!depsMap) return;
    const effects = depsMap.get(key);

    const effectsToRun: Deps = new Set();

    // Modifying the length of an array will affect the element which index greater than the new length value,
    // so side effects for the element should be trggered.
    if (Array.isArray(target) && key === 'length') {
        depsMap.forEach((effects, key) => {
            if (key >= newVal) {
                effects.forEach(effect => {
                    if (effect !== activeEffect) effectsToRun.add(effect);
                });
            }
        });
    }

    effects && effects.forEach(effect => {
        if (effect !== activeEffect) effectsToRun.add(effect);
    });

    if (type === TriggerType.ADD || type === TriggerType.DELETE) {

        // Modifying array elements through index may affect the length property. 
        const arrLengthEffects = depsMap.get('length');
        arrLengthEffects && arrLengthEffects.forEach(effect => {
            if (effect !== activeEffect) effectsToRun.add(effect);
        });

        const iterateEffects = depsMap.get(ITERATE_KEY);
        iterateEffects && iterateEffects.forEach(effect => {
            if (effect !== activeEffect) effectsToRun.add(effect);
        });
    }

    effectsToRun.forEach(reactiveEffect => {
        if (reactiveEffect.options && reactiveEffect.options.scheduler) {
            reactiveEffect.options.scheduler(reactiveEffect);
        } else {
            reactiveEffect.run();
        }
    });
}

const ITERATE_KEY = Symbol();

/**
 * mapping original object to proxy object
 */
const reactiveMap = new Map();

function reactive<T extends object>(obj: T): T {
    // data = [{}], avoid creating a new proxy(data[0], {}) everytime
    // when call arr[0] after reactive(data)
    const existProxy = reactiveMap.get(obj);
    if (existProxy) return existProxy;
    const proxy = createReactive(obj);
    reactiveMap.set(obj, proxy);
    return proxy;
}

function shallowReactive<T extends object>(obj: T): T {
    return createReactive(obj, true);
}

function readonly<T extends object>(obj: T): T {
    return createReactive(obj, false, true);
}

function shallowReadonly<T extends object>(obj: T): T {
    return createReactive(obj, true, true);
}

function createReactive<T extends object>(data: T, isShallow: boolean = false, isReadonly = false) {
    return new Proxy(data, {
        get(target, key, receiver) {
            // When you want to access the __raw property of the receiver, 
            // return the object obj that is being proxied by the receiver. 
            if (key === '__raw') {
                return target;
            }
            // trap methods on the prototype of an array
            if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
                return Reflect.get(arrayInstrumentations, key, receiver);
            }
            // Avoid establishing a reactive relationship between [Symbol.iterator] and side effect functions. 
            // and do not establish a reactive relationship for objects that are marked as readonly
            if (!isReadonly && typeof key !== 'symbol') track(target, key);

            const res = Reflect.get(target, key, receiver);
            if (isShallow) return res;
            // for deep reactive
            if (typeof res === 'object' && res !== null) {
                return isReadonly ? readonly(res) : reactive(res);
            }
            return res;
        },
        // trap set and add
        set(target, key, newVal, receiver) {
            if (isReadonly) {
                console.warn(`propert ${key.toString()} is readonly`);
                return true;
            }
            // @ts-ignore
            const oldVal = target[key];
            // check the type of operation on the property
            // to determine which effect should be triggered
            const type: TriggerType = Array.isArray(target)
                ? Number(key) < target.length
                    ? TriggerType.SET
                    : TriggerType.ADD
                : Object.prototype.hasOwnProperty.call(target, key)
                    ? TriggerType.SET
                    : TriggerType.ADD;
            const res = Reflect.set(target, key, newVal, receiver);
            // trigger side effect only when receiver is the Proxy of target
            if (target === receiver.__raw) {
                // The side effect function should not be triggered 
                // when oldVal is equal to newVal or both oldVal and newVal are equal to NaN. 
                if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
                    trigger(target, key, type, newVal);
                }
            }
            return res;
        },
        // trap key in obj
        has(target: object, key: any) {
            track(target, key);
            return Reflect.has(target, key);
        },
        // trap for ... in
        ownKeys(target) {
            track(target, Array.isArray(target) ? 'length' : ITERATE_KEY);
            return Reflect.ownKeys(target);
        },
        // trap delete property
        // when delete a property, for...in should be triggered
        deleteProperty(target: object, key: string | symbol) {
            if (isReadonly) {
                console.warn(`propert ${key.toString()} is readonly`);
                return true;
            }
            const hasKey = Object.prototype.hasOwnProperty.call(target, key);
            const deleted = Reflect.deleteProperty(target, key);

            if (hasKey && deleted) {
                trigger(target, key, TriggerType.DELETE);
            }
            return deleted;
        }

    });
}

// example: 
const arr = reactive([]);

effect(() => {
    arr.push(1);
    console.log('push 1 done')
});

effect(() => {
    arr.push(2);
    console.log('push 2 done')
});
