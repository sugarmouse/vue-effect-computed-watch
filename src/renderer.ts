// @ts-nocheck
type HTMLNode = HTMLElement & { __vnode: VNode; };
type VNode = object & {
    type: string,
    props: { [key: string]: any; };
    children: string | VNode[];
} | null;

type CreateRendererOptions = {
    createElement: (tag: string) => any,
    setElementText: (el: HTMLNode, text: string) => any,
    insert: (el: HTMLNode, parent: HTMLNode, anchor?: HTMLNode | null) => any;
    patchProps: (el: HTMLNode, key: string, prevValue: any, nextValue: any) => void;
};

function createRenderer(options: CreateRendererOptions) {

    const { createElement, insert, setElementText, patchProps } = options;

    function render(vnode: VNode, container: any) {
        if (!container) return;
        if (vnode) {
            patch(container.__vnode, vnode, container);
        } else {
            // vnode === null or undefined
            if (container.__vnode) {
                container.innerHTML = '';
            }
        }
        container.__vnode = vnode;
    }

    function mountElement(vnode: VNode, container: HTMLNode) {
        if (!vnode) return;
        const el = createElement(vnode.type);

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
        if (!oldVnode) {
            // oldNode = null ,just mount the newNode directly
            mountElement(newVnode, container);
        } else {
            /**
             * @todo should diff and mount 
             * unimplement for now
             */
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
    pathcProps(el: HTMLNode, key: string, prevValue: any, nextValue: any) {
        if(key === 'class') {
            el.className = nextValue || ''
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

const container = { type: 'root' };
const vnode = { type: 'h1', children: 'hello' };

renderer.render(vnode, container);


export { };