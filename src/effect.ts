type EffectFn = (...arg: any[]) => any;
type Deps = Set<ReactiveEffect>;

type KeyToDepMap = Map<string | Symbol, Deps>;

type ReactiveEffectOptions = {
    lazy?: boolean,
    scheduler?: (reactiveEffect: ReactiveEffect) => any;
};

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
    if (!activeEffect) return;

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
function trigger(target: object, key: any) {
    const depsMap = bucket.get(target);
    if (!depsMap) return;
    const effects = depsMap.get(key);
    if (!effects) return;

    const effectsToRun: Deps = new Set();
    effects.forEach(effect => {
        if (effect !== activeEffect) effectsToRun.add(effect);
    });

    effectsToRun.forEach(reactiveEffect => {
        if (reactiveEffect.options && reactiveEffect.options.scheduler) {
            reactiveEffect.options.scheduler(reactiveEffect);
        } else {
            reactiveEffect.run();
        }
    });
}


const proxyData = new Proxy(data, {
    get(target, key, receiver) {
        track(target, key);
        return Reflect.get(target, key, receiver);
    },
    set(target, key, newVal, receiver) {
        const res = Reflect.set(target, key, newVal, receiver);
        trigger(target, key);
        return res;
    }
});

effect(() => {
    console.log(proxyData.bar);
});

proxyData.bar++;

