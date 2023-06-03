// @ts-nocheck
type HTMLNode = HTMLElement & { __vnode: VNode; };
type VNode = object & {
    type: string,
    props: { [key: string]: any; };
    children: string | VNode[] | null;
    el: HTMLNode;
} | null;

type CreateRendererOptions = {
    createElement: (tag: string) => any,
    setElementText: (el: HTMLNode, text: string) => any,
    insert: (el: HTMLNode, parent: HTMLNode, anchor?: HTMLNode | null) => any;
    patchProps: (el: HTMLNode, key: string, prevValue: any, nextValue: any) => void;
};

function unmount(vnode: VNode) {
    const parent = vnode?.el.parentNode;
    if (parent) {
        parent.removeChild(vnode.el);
    }
}

function createRenderer(options: CreateRendererOptions) {

    const { createElement, insert, setElementText, patchProps } = options;

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

    function mountElement(vnode: VNode, container: HTMLNode) {
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

        insert(el, container);
    }

    function patch(oldVnode: VNode, newVnode: VNode, container: HTMLNode) {
        if (oldVnode && oldVnode.type !== newVnode?.type) {
            unmount(oldVnode);
            oldVnode = null;
        }

        const { type } = newVnode;

        if (typeof type === 'string') {
            // legal HTML tag name
            if (!oldVnode) {
                // oldNode = null ,just mount the newNode directly
                mountElement(newVnode, container);
            } else {
                patchElment(oldVnode, newVnode);
            }
        } else if (typeof type === 'object') {
            // newVnode is a vue component
        } else {
            /**
             * other types of VNode
             */
        }
    }

    function patchELement(n1: VNode, n2: VNode) {
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
            // 处理新的 n2.children 是一组节点的情况
            if (Array.isArray(n1.children)) {
                // 此时新的子节点和旧的子节点的 children 都是一个 VNode[]
                // 为了减少 DOM 操作，提高性能，这里不能直接全部卸载旧的子节点而逐个挂载新的
                // 需要对节点 Diff
                n1.children.forEach(child => unmount(child));
                n2.children.forEach(child => patch(null, child, container));
            } else {
                // 旧的子节点是是 null 或者 string
                // 直接逐个挂载各个新的字节点
                setElementText(container, '');
                n2.children.forEach(child => patch(null, c, container));
            }
        } else {
            // 新的子节点不存在 n2.children === null
            if (Array.isArray(n1.children)) {
                n1.children.forEach(child => unmount(child));
            } else if (typeof n1.children === 'string') {
                setElementText(container, '');
            }
        }
    }

    return {
        render,
    };
}


// example
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
        console.log(`创建元素 ${tag}`);
        return { tag };
    },
    setElementText(el, text) {
        console.log(`设置 ${JSON.stringify(el)} 的文本内容 ${text}`);
        el.textContent = text;
    },
    insert(el, parent, anchor = null) {
        console.log(`将 ${JSON.stringify(el)} 添加到 ${JSON.stringify(parent)} 下`);
        parent.children = el;
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
    }
});

// example
// ref and effect from @vue/reactivity
const bol = ref(false);

effect(() => {
    const vnode = {
        type: 'div',
        props: bol.value ? {
            onClick: () => {
                alert('parent element clicked');
            }
        } : {},
        children: [
            {
                type: 'p',
                props: {
                    onClick: () => {
                        bol.value = true;
                    }
                },
                children: 'text'
            }
        ]
    };

    renderer.render(vnode, document.querySelector('#app'));
});