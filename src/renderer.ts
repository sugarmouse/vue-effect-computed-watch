// @ts-nocheck
type HTMLNode = HTMLElement & { __vnode: VNode; };
type VNode = object & {
    type: string,
    props: { [key: string]: any; };
    children: string | VNode[] | null;
    el: HTMLNode;
} | null;

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
        } else if (typeof type === 'object') {

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

// example