// types
type Template = string;
type AST = object;
type JSAST = object;
type RenderFuntion = (...arg: any[]) => any;

type TokenNode_Tag = { type: 'tag', value: string; };
type TokenNode_Text = { type: 'text', content: string; };
type TokenNode_TagEnd = { type: 'tagEnd', value: string; };
type TokenNode = TokenNode_Tag | TokenNode_Text | TokenNode_TagEnd;
type Tokens = TokenNode[];

type TransformReturnFn = () => void ;
type Transform = (node: ASTNode, context: TransformCtx) => void | TransformReturnFn;

interface TransformCtx {
    currentNode: ASTNode | null;
    childIndex: number;                   // 记录当前节点在父节点中的位置索引
    parent: ASTNode | null;
    replaceNode: (node: ASTNode) => void;
    removeNode: () => void;
    nodeTransforms: Array<Transform>;
}


type ASTNode_Root = {
    type: 'Root',
    children: ASTNode[];
};
type ASTNode_Element = {
    type: 'Element',
    tag: string,
    children: (ASTNode_Element | ASTNode_Text)[],
};
type ASTNode_Text = {
    type: 'Text',
    content: string;
};
type ASTNode = ASTNode_Element | ASTNode_Text | ASTNode_Root;

// code
enum State {
    Initial,
    TagOpen,
    TagName,
    Text,
    TagEnd,
    TagEndName,
}

function isAlpha(char: string) {
    return char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z';
}

function tokenize(str: Template): Tokens {
    let currentState: State = State.Initial;
    const chars: string[] = [];

    const tokens: any[] = [];

    while (str.length !== 0) {
        const char = str[0];

        switch (currentState as State) {
            case State.Initial:
                if (char === '<') {
                    currentState = State.TagOpen;
                    str = str.slice(1);
                } else if (isAlpha(char)) {
                    currentState = State.Text;
                    chars.push(char);
                    str = str.slice(1);
                }
                break;

            case State.TagOpen:
                if (isAlpha(char)) {
                    currentState = State.TagName;
                    chars.push(char);
                    str = str.slice(1);
                } else if (char === '/') {
                    currentState = State.TagEnd;
                    str = str.slice(1);
                }
                break;

            case State.TagName:
                if (isAlpha(char)) {
                    chars.push(char);
                    str = str.slice(1);
                } else if (char === '>') {
                    currentState = State.Initial;

                    tokens.push({
                        type: 'tag',
                        value: chars.join('')
                    });
                    chars.length = 0;
                    str = str.slice(1);
                }
                break;

            case State.Text:
                if (isAlpha(char)) {
                    chars.push(char);
                    str = str.slice(1);
                } else if (char === '<') {
                    currentState = State.TagOpen;

                    tokens.push({
                        type: 'text',
                        content: chars.join('')
                    });
                    chars.length = 0;
                    str = str.slice(1);
                }
                break;

            case State.TagEnd:
                if (isAlpha(char)) {
                    currentState = State.TagEndName;
                    chars.push(char);
                    str = str.slice(1);
                }
                break;

            case State.TagEndName:
                if (isAlpha(char)) {
                    chars.push(char);
                    str = str.slice(1);
                } else if (char === '>') {
                    currentState = State.Initial;
                    tokens.push({
                        type: 'tagEnd',
                        value: chars.join('')
                    });

                    chars.length = 0;
                    str = str.slice(1);

                }
                break;
        }
    }
    return tokens;
}

// template code -> template AST
function parse(template: Template): ASTNode_Root {
    const tokens = tokenize(template);

    const root: ASTNode_Root = {
        type: 'Root',
        children: []
    };

    // 维护元素间的父子关系
    const elementStack: (ASTNode_Element | ASTNode_Root)[] = [root];

    while (tokens.length !== 0) {
        const parent = elementStack[elementStack.length - 1];

        const t = tokens[0];

        // 处理token
        switch (t.type) {
            case 'tag':
                const elementNode: ASTNode_Element = {
                    type: 'Element',
                    tag: t.value,
                    children: []
                };
                parent.children.push(elementNode);
                elementStack.push(elementNode);
                break;
            case 'text':
                const textNode: ASTNode_Text = {
                    type: 'Text',
                    content: t.content
                };
                parent.children.push(textNode);
                break;
            case 'tagEnd':
                elementStack.pop();
                break;
        }
        tokens.shift();
    }

    return root;
}

function traverseNode(ast: ASTNode, context: TransformCtx) {

    context.currentNode = ast;
    
    // 用来存放回溯的时候处理节点的函数
    const exitFn:TransformReturnFn[] = [];
    const transforms = context.nodeTransforms;

    // execute transforms
    for (let i = 0; i < transforms.length; i++) {
        const onExit = transforms[i](context.currentNode, context);
        if (onExit) exitFn.push(onExit);
        // 因为context暴露给 transform[i],而context里有 removeNode 函数
        // 所以任何节点 transform[i] 都有可能会删除节点
        if (!context.currentNode) return;
    }

    if (context.currentNode.type === "Text") {
        return;
    }

    // traverse children
    let children = context.currentNode.children;
    for (let i = 0; i < children.length; i++) {
        context.parent = context.currentNode;
        context.childIndex = i;
        traverseNode(children[i], context);
    }

    // 反序执行
    // 反序执行的意义是为了先进入的转换函数等待前一个转换函数全部执行完
    let i = exitFn.length
    while(i--) {
        exitFn[i]();
    }

}

// template AST -> JS AST
function transform(ast: ASTNode): JSAST {

    const context: TransformCtx = {
        currentNode: null,
        childIndex: 0,
        parent: null,
        replaceNode(node) {
            if (context.parent && context.parent.type !== 'Text') {
                context.parent.children[context.childIndex] = node;
            }
            context.currentNode = node;
        },
        removeNode() {
            if (context.parent) {
                // 删除当前节点
                if (context.parent.type !== 'Text') context.parent.children.splice(context.childIndex, 1);
                // set current node to null
                context.currentNode = null;
            }
        },
        nodeTransforms: [
            trnasformText,
            transformElement
        ]
    };
    traverseNode(ast, context);

    dump(ast);
    return {};
}

function transformElement(node: ASTNode, context: TransformCtx) {
    if (context.currentNode && context.currentNode.type !== 'Element') return;
    if (context.currentNode?.tag === 'p') {
        context.currentNode.tag = 'h1';
    }
}

function trnasformText(node: ASTNode, context: TransformCtx) {
    if (node.type !== 'Text') return;
    // transform text ast node here
    context.replaceNode({ type: 'Element', tag: 'span', children: [] });
}

// JS AST -> render function
function generate(jsast: JSAST): RenderFuntion {
    function render() {

    }
    return render;
}

// debug helper code
/**
 * Recursively outputs the type and description of a given ASTNode,
 * along with its children if it has any.
 * 
 * @param {ASTNode} node - the node to be outputted
 * @param {number} indent - the current indentation level (default 0)
 */
function dump(node: ASTNode, indent = 0) {
    const type = node.type;

    const desc = node.type === 'Root'
        ? ''
        : node.type === 'Element'
            ? node.tag
            : node.content;

    // output the node type and description with the current indentation
    console.log(`${'-'.repeat(indent)}${type}: ${desc}`);

    // if the node is not a Text node and has children, output each child
    if (node.type !== "Text" && node.children) {
        node.children.forEach(child => {
            // recursively output the child, with increased indentation
            dump(child, indent + 2);
        });
    }
}

const ast = parse(`<div><p>Vue</p><p>Teamplate</p></div>`);
transform(ast);
