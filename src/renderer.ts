// @ts-nocheck
type HTMLNode = HTMLElement & { __vnode: VNode; };
type VNode = object & {
    type: string,
    children: string | VNode;
} | null;

type CreateRendererArgs = {
    createElement: (tag: string) => any,
    setElementText: (el: HTMLNode, text: string) => any,
    insert: (el: HTMLNode, parent: HTMLNode, anchor?: HTMLNode | null) => any;
};

function createRenderer(options: CreateRendererArgs) {

    const { createElement, insert, setElementText } = options;

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
const renderer = createRenderer({
    createElement(tag: string) {
        console.log(`创建元素 ${tag}`);

    },
    setElementText(el, text) {
        console.log(`设置 ${JSON.stringify(el)} 的文本内容 ${text}`);
        // el.textContent = text;
    },
    insert(el, parent, anchor = null) {
        console.log(`将 ${JSON.stringify(el)} 添加到 ${JSON.stringify(parent)} 下`);
        // parent.replaceChildren(el);
    }
});

const container = { type: 'root' };
const vnode = { type: 'h1', children: 'hello' };

renderer.render(vnode, container);


export { };