// @ts-nocheck
import { reactive, effect, shallowReactive, shallowReadonly, ref } from './effect';

type HTMLNode = HTMLElement & { __vnode: VNode; };
type VNode = object & {
    type: string,
    props: { [key: string]: any; };
    children: string | VNode[] | null;
    el: HTMLNode;
} | null;

type Instance = {} | null;

function getLongestIncreasingSubsequence(nums: number[]): number[] {
    const p = arr.slice();
    const result = [0];
    let i: number, j: number, u: number, v: number, c: number;
    const len = arr.length;

    for (i = 0; i < len; i++) {
        const arrI = arr[i];
        // 从第一个非零元素开始
        if (arrI !== 0) {
            j = result[result.length - 1];
            // 如果当前元素满足递增序列
            if (arr[j] < arrI) {
                p[i] = j;
                result.push(i);
                continue;
            }
            // 二分查找，找到 result 中大于等于当前 arrI 的元素
            u = 0;
            v = result.length - 1;
            while (u < v) {
                c = ((u + v) / 2) | 0;
                if (arr[result[c]] < arrI) {
                    u = c + 1;
                } else {
                    v = c;
                }
            }
            if (arrI < arr[result[u]]) {
                if (u > 0) {
                    p[i] = result[u - 1];
                }
                result[u] = i;
            }
        }
    }
    u = result.length;
    v = result[u - 1];
    while (u-- > 0) {
        result[u] = v;
        v = p[v];
    }
    return result;
}

type CreateRendererOptions = {
    createElement: (tag: string) => any,
    setElementText: (el: HTMLNode, text: string) => any,
    insert: (el: HTMLNode, parent: HTMLNode, anchor?: HTMLNode | null) => any;
    patchProps: (el: HTMLNode, key: string, prevValue: any, nextValue: any) => void;
    createText: (text: string) => Text,
    setText: (el: HTMLNode, text: string) => void;
};

const TextNode = Symbol();
const Fragment = Symbol();

const queueJob = (
    function () {
        const queue = new Set();
        let isFlushing = false;

        const p = Promise.resolve();

        return (job: any) => {
            queue.add(job);
            if (!isFlushing) {
                isFlushing = true;
                // 异步执行副作用函数，避免响应式数据频繁更新时副作用函数的多次执行
                p.then(() => {
                    try {
                        queue.forEach(job => job());
                    } finally {
                        isFlushing = false;
                        queue.clear = 0;
                    }
                });
            }
        };
    }
)();

let currentInstance: Instance = null;
function setCurrentInstance(instance: Instance) {
    currentInstance = instance;
}

function createRenderer(options: CreateRendererOptions) {

    const {
        createElement,
        setElementText,
        patchProps,
        insert,
        setText,
        createText
    } = options;

    function render(vnode: VNode, container: HTMLNode) {
        if (!container) return;
        if (vnode) {
            patch(container.__vnode, vnode, container);
        } else {
            // vnode === null or undefined
            if (container.__vnode) {
                // unmount
                unmount(container.__vnode);
            }
        }
        container.__vnode = vnode;
    }

    function unmount(vnode: VNode) {
        if (vnode?.type === Fragment) {
            vnode.children.forEach(child => unmount(child));
            return;
        } else if (typeof vnode?.type === 'object') {
            if (vnode.shouldKeepAlive) {
                // 对于 keepAlive 组件的卸载，调用其父组件的 __deActive 方法隐藏，而不是真正的卸载
                vnode.keepAliveInstance.__deActive(vnode);
            } else {
                // 对于组件的卸载，本质上是要卸载组件锁渲染的内容，即subTree
                unmount(vnode.component.subTree);
            }
            return;
        }
        const parent = vnode?.el.parentNode;
        if (parent) {
            parent.removeChild(vnode.el);
        }
    }

    function mountElement(vnode: VNode, container: HTMLNode, anchor: HTMLNode) {
        if (!vnode) return;
        const el = vnode.el = createElement(vnode.type);

        if (typeof vnode.children === 'string') {
            setElementText(el, vnode.children);
        } else if (Array.isArray(vnode.children)) {
            vnode.children.forEach(child => {
                patch(null, child, el);
            });
        }

        if (vnode.props) {
            for (const key in vnode.props) {
                patchProps(el, key, null, vnode.props[key]);
            }
        }

        insert(el, container, anchor);
    }

    function patch(oldVnode: VNode, newVnode: VNode, container: HTMLNode, anchor: HTMLNode) {
        if (oldVnode && oldVnode.type !== newVnode?.type) {
            unmount(oldVnode);
            oldVnode = null;
        }

        const { type } = newVnode;

        if (typeof type === 'string') {
            // legal HTML tag name
            if (!oldVnode) {
                // oldNode = null ,just mount the newNode directly
                mountElement(newVnode, container, anchor);
            } else {
                patchElement(oldVnode, newVnode);
            }
        } else if (type === TextNode) {
            // vnode 是文本节点
            if (!oldVnode) {
                const el = newVnode.el = createText(newVnode?.children);
                insert(el, container);
            } else {
                const el = newVnode.el = oldVnode.el;
                if (newVnode?.children !== oldVnode.children) {
                    setText(el, newVnode?.children);
                }
            }
        } else if (type === Fragment) {
            if (!oldVnode) {
                newVnode?.children.forEach(child => patch(null, child, container));
            } else {
                patchChildren(oldVnode, newVnode, container);
            }
        } else if (
            typeof type === 'object' // 有状态的选项式组件
            || typeof type === 'function' // 无状态的函数式组件
        ) {
            // vnode.type 的值是选项值，作为组件处理
            if (!oldVnode) {
                if (newVnode.keptAlive) {
                    // 如果该组件已经被 KeepAlive，则不会重新挂载它，而是调用 __active 来激活
                    newVnode.keepAliveInstance.__active(newVnode, container, anchor);
                } else {
                    mountComponent(n2, container, anchor);
                }
            } else {
                patchComponent(n1, n2, anchor);
            }
        } else {

        }
    }

    function patchElement(n1: VNode, n2: VNode) {
        const el = n2?.el = n1?.el;
        const oldProps = n1?.props;
        const newProps = n2?.props;

        // update props
        for (const key in newProps) {
            if (newProps[key] !== oldProps[key]) {
                patchProps(el, key, oldProps[key], newProps[key]);
            }
        }
        for (const key in oldProps) {
            if (!(key in newProps)) {
                patchProps(el, key, oldProps[key], null);
            }
        }

        // update children
        patchChildren(n1, n2, el);
    }

    function patchChildren(n1: VNode, n2: VNode, container: HTMLNode) {
        if (!n1 || !n2) return;
        // n2 is the new Node, and n1 is the older one
        if (typeof n2.children === 'string') {

            // 就子节点的类型只有三种肯能： 没有子节点，文本字节点，一组子节点
            // 没有字节点或者本身就是文本自己点的话不需要额外做什么
            if (Array.isArray(n1.children)) {
                n1.children.forEach(child => unmount(child));
            }
            // 将新的文本节点内容设置给容器元素
            setElementText(container, n2.children);
        } else if (Array.isArray(n2.children)) {
            // DOM diff
            patchKeyedChildren(n1, n2, container);
        } else {
            // 新的子节点不存在 n2.children === null
            if (Array.isArray(n1.children)) {
                n1.children.forEach(child => unmount(child));
            } else if (typeof n1.children === 'string') {
                setElementText(container, '');
            }
        }
    }

    function patchKeyedChildren(n1: VNode, n2: VNode, container: HTMLNode) {
        const oldChildren = n1?.children;
        const newChildren = n2?.children;

        // 预处理
        let j = 0;
        let oldVNode = oldChildren[j],
            newVNode = newChildren[j];
        // 找到前置点
        while (oldVNode.key === newVNode.key) {
            patch(oldVNode, newVNode, container);
            j++;
            oldVNode = oldChildren[j];
            newVNode = newChildren[j];
        }
        // 找到后置点
        let oldEnd = oldChildren?.length - 1,
            newEnd = newChildren?.length - 1;
        oldVNode = oldChildren[oldEnd];
        newVNode = newChildren[newEnd];
        while (oldVNode.key === newVNode.key) {
            oldEnd--;
            newEnd--;
            oldVNode = oldChildren[oldEnd];
            newVNode = newChildren[newEnd];
        }

        if (j > oldEnd && j <= newEnd) {
            // 挂载新的子节点中新增的节点
            const anchorIndex = newEnd + 1;
            const anchor = anchorIndex < newChildren?.length
                ? newChildren[anchorIndex].el
                : null;

            while (j <= newEnd) {
                patch(null, newChildren[j++], container, anchor);
            }
        } else if (j <= oldEnd && j > newEnd) {
            // 卸载多余的旧的子节点
            while (j <= oldEnd) {
                unmount(oldChildren[j++]);
            }
        } else {
            /**
             * count 是新的子节点中预处理之后剩下的待处理的子节点数量
             */
            const count = newEnd - j + 1;
            /**
             * source 用来记录新的一组子节点中的节点在旧的一组子节点中的位置索引
             */
            const source = new Array(count).fill(-1);

            let moved = false;
            let pos = 0;

            const oldStart = j;
            const newStart = j;
            /**
             * 记录 newVNode：newChildren.indexOf(newVNode) 的映射关系
             */
            const keyIndex = {};
            for (let i = newStart; i <= newEnd; i++) {
                keyIndex[newChildren[i].key] = i;
            }
            /**
             * 记录旧的子节点中已经被复用过的子节点数量
            */
            let patched = 0;

            // 填充 source 数组，并且 patch 可复用的节点
            for (let i = oldStart; i <= oldEnd; i++) {
                oldVNode = oldChildren[i];
                if (patched <= count) {
                    const k = keyIndex[oldVNode.key];
                    if (typeof k !== 'undefined') {
                        newVNode = newChildren[k];
                        patch(oldVNode, newVNode, container);
                        patched++;
                        source[k - newStart] = i;
                        // 判断节点桑否需要移动
                        if (k < pos) {
                            moved = true;
                        } else {
                            pos = k;
                        }
                    } else {
                        // 当前旧的子节点不可复用
                        unmount(oldVNode);
                    }
                } else {
                    // 所有的新的子节点都已经拿到了可复用的 DOM 节点，并且 patch 完成
                    // 所以这里直接卸载掉多余的旧的子节点
                    unmount(oldVNode);
                }
            }

            if (moved) {
                // 找到 source 数组的最长递增子序列 seq
                // seq 的含义是：在新的一组子节点中，newChildren[seq[i] + j] 和 oldChildren[source[i]] 是对应的节点
                // 所以 seq 指的节点是不需要移动的，因为他们在新旧节点序列中的相对位置关系不变
                const seq = getLongestIncreasingSubsequence(source);

                /**
                 * 指向最长递增子序列的最后一个元素
                 */
                let s = seq.length - 1;
                /**
                 * 指向新的一组子节点的最后一个元素
                 */
                let i = count - 1;

                for (i; i >= 0; i--) {
                    if (source[i] === -1) {
                        // 新的节点，之前只是记录了，但是没有处理过，所以这里需要挂载
                        const pos = i + newStart;
                        const newVNode = newChildren[pos];
                        const nextPos = pos + 1;

                        const anchor = nextPos < newChildren?.length
                            ? newChildren[nextPos].el
                            : null;
                        patch(null, newVNode, container, anchor);
                    } else if (i !== seq[s]) {
                        // 该节点不在 seq 内，之前已经 patch 过， 这里只需要移动
                        const pos = i + newStart;
                        const newVNode = newChildren[pos];
                        const nextPos = pos + 1;

                        const anchor = nextPos < newChildren?.length
                            ? newChildren[nextPos].el
                            : null;

                        insert(newVNode.el, container, anchor);
                    } else {
                        // newChildren[i + j] 在 seq 内，不需要移动
                        s--;
                    }
                }

            }
        }
    }

    function resolveProps(options: Object, propsData: Object) {
        /**
         * @todo 类型校验和默认值处理
         */
        const props = {};
        const attrs = {};
        // 如果是组件 options 显式接收的参数或者事件，放到 props 对象
        // 否则放到 attrs 对象
        for (const key in propsData) {
            if (key in options || key.startsWith('on')) {
                props[key] = propsData[key];
            } else {
                attrs[key] = propsData[key];
            }
        }
        return [props, attrs];
    }

    /**
     * 
     * @param vnode 
     * @param container 
     * @param anchor
     * 
     *  render component 
    */
    function mountComponent(vnode: VNode, container: HTMLNode, anchor: HTMLNode) {
        const isFuntional = typeof vnode.type === 'function';
        let componentOptions = vnode?.type;
        // 支持函数式组件
        if (isFuntional) {
            componentOptions = {
                render: vnode?.type,
                props: vnode?.type.props
            };
        }

        const {
            // option api
            render,
            data,
            setup,
            props: propsOption,
            beforeCreate,
            created,
            beforeMount,
            mounted,
            beforeUpdate,
            updated
        } = componentOptions;

        beforeCreate && beforeCreate();

        // got data from option api and reactive it
        const state = data ? reactive(data()) : null;
        // vnode.props 是调用组件的地方传递给组件的具体参数
        // propsOption 是组件代码内部 props 对象，用来显式的指定组件会接收哪些参数
        const [props, attrs] = resolveProps(propsOption, vnode.props);

        const slots = vnode?.children || {};

        const instance = {
            state,
            // 将解析出的 props 数据包装为 shallowReactive 并定义到组件实例上
            props: shallowReactive(props),
            isMounted: false,
            subTree: null,
            slots,
            mounted: [], // 用来存储通过 onMounted 函数注册的生命周期钩子函数
            keepAliveCtx: null // 只有 KeepAlive 组件实例下会有 keepAliveCtx 属性
        };

        // 检查是否是 KeepAlive 组件，并为实例添加 keepAliveCtx
        const isKeepAlive = vnode?.type.__isKeepAlive;
        if (isKeepAlive) {
            instance.keepAliveCtx = {
                move(vnode, container, anchor) {
                    insert(vnode.component.subTree.el, container, anchor);
                },
                createElement
            };
        }

        function onMounted(fn) {
            if (currentInstance) {
                currentInstance.mounted.push(fn);
            } else {
                console.error('onMounted function 只能在 setup 中调用');
            }
        }

        function emit(event, ...payload) {
            // example: change -> onChange
            const eventName = `on${event[0].toUpperCase() + event.slice(1)}`;

            const handler = instance.props[eventName];
            if (handler) {
                handler(...payload);
            } else {
                console.error(`event ${event} not exist`);
            }
        }

        const setupContext = { attrs, emit, slots };

        setCurrentInstance(instance);
        const setupResult = setup(shallowReadonly(instance.props), setupContext);
        // setup 函数执行完之后，重置当前组件实例
        setCurrentInstance(null);
        let setupState = null;

        if (typeof setupResult === "function") {
            if (render) console.error(`setup function returned a function, so render option was ignored`);
            render = setupResult;
        } else {
            setupState = setupResult;
        }

        vnode.component = instance;

        // 创建渲染上下文，本质上是组件实例的代理
        // props 数据和组件自身的状态都需要暴露到渲染函数中，使得渲染函数能够通过 this 访问
        const renderContext = new Proxy(instance, {
            // 渲染函数或者生命周期钩子函数通过 this 访问数据时
            // 优先从自身状态读
            // 再从 props 数据读
            get(target, key, receiver) {
                const { state, props, slots } = target;
                if (key === '$slots') {
                    return slots;
                }
                if (state && key in state) {
                    return state[key];
                } else if (key in props) {
                    return props[key];
                } else if (setupState && key in setupState) {
                    return setupState[key];
                } else {
                    console.error("non exist");
                }
            },
            set(target, key, val, receiver) {
                const { state, props } = target;
                if (state && key in state) {
                    state[key] = val;
                } else if (key in props) {
                    console.warn(`attempting to mutate prop "${key}". props are readonly `);
                } else if (setupState && key in setupState) {
                    setupState[key] = val;
                } else {
                    console.error(`attempting to access non-exist property`);
                }
            }
        });

        created && created.call(renderContext);

        // Implement automatic updating of components using the effect function. 
        effect(() => {
            // got vnode via render funtion from optional api
            // make the render function to access data through 'this' inside.
            const subTree: VNode = render.call(renderContext, renderContext);
            if (!instance.isMounted) {
                beforeMount && beforeMount.call(renderContext);
                // mount vnode from component
                patch(null, subTree, container, anchor);
                instance.isMounted = true;
                mounted && mounted.call(renderContext);

                instance.mounted && instance.mounted.forEach(hook => hook.call(renderContext));
            } else {
                // update
                beforeUpdate && beforeUpdate.call(renderContext);
                patch(instance.subTree, subTree, container, anchor);
                updated && updated.call(renderContext);
            }
            instance.subTree = subTree;
        }, {
            scheduler: queueJob
        });
    }

    function patchComponent(n1: Object, n2: Object, anchor: HTMLNode) {
        // 组件实例需要添加到新的组件上
        const instance = (n2.component = n1.component);

        const { props } = instance;

        if (hasPropsChanged(n1.props, n2.props)) {
            // 拿到新的 props
            const [nextProps] = resolveProps(n2.type.props, n2.props);
            // 更新 props
            for (const k in nextProps) {
                // 组件的被动渲染
                // props 是浅响应的，所以这里修改 props 的属性值时
                // 可以出发组件的重新渲染
                props[k] = nextProps[k];
            }
            // 删除多余的 props
            for (const k in props) {
                if (!(k in nextProps)) delete props[k];
            }
        }
    }

    function hasPropsChanged(prevProps: Object, nextProps: Object) {
        const nextKeys = Object.keys(nextProps);

        if (nextKeys.length !== Object.keys(prevProps).length) {
            return true;
        }

        for (let i = 0; i < nextKeys.length; i++) {
            const key = nextKeys[i];
            if (nextProps[key] !== prevProps[key]) return true;
        }
        return false;
    }

    type Loader = () => Promise<any>;
    type DefineAsyncComponentOptions = {
        loader: Loader,
        timeout?: number,
        errorComponent?: any;
        delay?: number;
        loadingComponent: any;
    };
    type DefineAsyncComponentParams = Loader | DefineAsyncComponentOptions;
    /**
     * defineAsyncComponent 函数定义一个异步组件，本质上是一个高阶组件
     * @param options - 异步组件的加载器或者选项参数
     * @returns 返回一个包装的异步组件
     */
    function defineAsyncComponent(options: DefineAsyncComponentParams) {
        // 如果直接传入一个 loader ，则规范为 options
        if (typeof options === 'function') {
            options = { loader: options };
        }

        const { loader } = options;
        let InnerComp = null;

        let retries = 0;

        // 对 loader 函数做一层包裹，错了重试
        function load() {
            return loader()
                .catch(err => {
                    // 如果用户指定了 onError 回调，则把控制权交给用户
                    if (options.onError) {
                        return new Promise((resolve, reject) => {
                            //  retry 函数，用来执行重试的函数，执行该函数会重新调用 load 函数并重新加载组件
                            const retry = () => {
                                resolve(load());
                                retries++;
                            };

                            const fail = () => reject(err);

                            options.onError(retry, fail, retries);
                        });
                    } else {
                        throw err;
                    }
                });
        }
        // 返回一个包装的组件
        return {
            name: "AsyncComponentWrapper",
            setup() {
                const loaded = ref(false);
                const timeout = ref(false);
                const error = shallowRef(null);
                const loading = ref(false);

                let loadingTimer = null;

                if (options.delay) {
                    loadingTimer = setTimeout(() => {
                        loading.value = true;
                    }, options.delay);
                } else {
                    loading.value = true;
                }

                load()
                    .then(comp => {
                        InnerComp = comp;
                        loaded.value = true;
                    })
                    // 捕获加载组件的错误，作为 props 传递给用户
                    .catch(e => {
                        error.value = e;
                    })
                    .finally(() => {
                        loading.value = false;
                        clearTimeout(loadingTimer);
                    });
                // 设置超时计时器
                let timer = null;
                if (options.timeout) {
                    timer = setTimeout(() => {
                        const err = new Error(`Async component timed out after ${options.timeout} ms`);
                        error.value = err;
                        timeout.value = true;
                    }, options.timeout);
                }

                onUnmounted(() => clearTimeout(timer));

                const palceholder = { type: Text, children: '' };

                return () => {
                    if (loaded.value) {
                        return { type: InnerComp };
                    } else if (error.value && options.errorComponent) {
                        return {
                            type: options.errorComponent,
                            props: { error: error.value }
                        };
                    } else if (loading.value && options.loadingComponent) {
                        return {
                            type: options.loadingComponent
                        };
                    } else {
                        return palceholder;
                    }
                };
            }
        };
    }

    return {
        render,
    };
}

const KeepAlive = {
    __isKeepAlive: true,
    // 定义 include 和 exclude props
    props: {
        include: RegExp,
        exclude: RegExp
    },

    setup(props, { slots }) {
        // vnode.type -> vnode 的映射
        const cache = new Map();

        const instance = currentInstance;

        // 对于 keepAlive 组件来说，它的实例上存在特殊的 keepAliveCtx 对象，该对象由渲染器注入
        // 该对象会暴露渲染器的一些内部方法，其中 move 函数用来将一段 DOM 移动到另一个容器中
        const { move, createElement } = instance.keepAliveCtx;

        // 创建隐藏容器
        const storageContainer = createElement('div');

        // keepAlive 组件的挂载和卸载与一般的组件不同，不是真正的卸载与挂载
        // 卸载就是将其放入一个隐藏的容器
        instance.__deActive = (vnode) => {
            move(vnode, storageContainer);
        };
        instance.__active = (vnode, container, anchor) => {
            move(vnode, container, anchor);
        };

        return () => {
            // keepAlive 的默认插槽是需要被 keepAlive 的组件
            let rawVNode = slots.default();

            // 如果不是组件直接渲染
            if (typeof rawVNode.type !== 'object') {
                return rawVNode;
            }

            const name = rawVNode.type.name;
            
            // 检查是否有用户指定的 include 或者 exclude
            if (name
                && (
                    (props.include && !props.include.test(name))
                    || (props.exclude && props.exclude.test(name))
                )
            ) {
                return rawVNode
            }

            // 缓存节点
            const cachedVNode = cache.get(rawVNode.type);
            if (cachedVNode) {
                rawVNode.component = cachedVNode.component;
                rawVNode.keptAlive = true;
            } else {
                cache.set(rawVNode.type, rawVNode);
            }

            // 组件 vnode 上添加 shouldKeepAlive 属性
            rawVNode.shouldKeepAlive = true;

            // 在 vnode 上添加 keepAlive 组件的实例，以便在渲染器中访问
            rawVNode.keepAliveInstance = instance;

            return rawVNode;

        };
    }
};


function shouldSetAsProps(el: HTMLNode, key: any, value: any) {
    // input.form is a readonly property, so we can't set it with el[key]
    /**
     * @todo
     * there are lots of properties like 'form' should be handled
     * put related logic here
     */
    if (key === 'form' && el.tagName === 'INPUT') return false;
    return key in el;
}

const renderer = createRenderer({
    createElement(tag: string) {
        return { tag };
        console.log(`创建元素 ${tag}`);
    },
    setElementText(el, text) {
        console.log(`设置 ${JSON.stringify(el)} 的文本内容 ${text}`);
        el.textContent = text;
    },
    insert(el, parent, anchor = null) {
        parent.insertBefore(el, anchor);
    },
    patchProps(el: HTMLNode, key: string, prevValue: any, nextValue: any) {
        // on 开头的是事件
        if (/^on/.test(key)) {
            // invokers 维护的是ODM元素的事件函数
            const invokers = el.__vei || (el.__vei = {});
            // invoker 是对事件函数的一层包裹，事件函数挂在 value 属性上
            // 每次更新事件函数只要更新 value 的值就行
            let invoker = invokers[key];
            const name = key.slice(2).toLocaleLowerCase();
            if (nextValue) {
                if (!invoker) {
                    invoker = el.__vei[key] = (e) => {
                        if (e.timaStamp < invoker.attached) return;
                        if (Array.isArray(invoker.value)) {
                            invoker.value.forEach(fn => fn(e));
                        } else {
                            invoker.value(e);
                        }
                    };
                    invoker.value = nextValue;

                    // 给事件添加时间戳，控制冒泡过程中可能产生的不必要的时间触发
                    invoker.attached = performance.now();
                    el.addEventListener(name, invoker);
                } else {
                    // 事件更新的逻辑就少了 removeEventListener
                    // 提高事件更新的性能
                    invoker.value = nextValue;
                }
            } else if (invoker) {
                el.removeEventListener(name, invoker);
            }
        }
        else if (key === 'class') {
            el.className = nextValue || '';
        } else if (shouldSetAsProps(el, key, nextValue)) {
            const type = typeof el[key];
            if (type === 'boolean' && nextValue === '') {
                el[key] = true;
            } else {
                el[key] = nextValue;
            }
        } else {
            el.setAttribute(key, nextValue);
        }
    },
    createText(text: string) {
        return document.createTextNode(text);
    },
    setText(el: HTMLNode, text: string) {
        el.nodeValue = text;
    }
});

