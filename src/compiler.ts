// types
type Template = string;
type JSAST = object;

type TokenNode_Tag = { type: 'tag', value: string; };
type TokenNode_Text = { type: 'text', content: string; };
type TokenNode_TagEnd = { type: 'tagEnd', value: string; };
type TokenNode = TokenNode_Tag | TokenNode_Text | TokenNode_TagEnd;
type Tokens = TokenNode[];

type TransformReturnFn = () => void;
type Transform = (node: ASTNode, context: TransformCtx) => void | TransformReturnFn;

interface TransformCtx {
    currentNode: ASTNode | null;
    childIndex: number;                   // 记录当前节点在父节点中的位置索引
    parent: ASTNode | null;
    replaceNode: (node: ASTNode) => void;
    removeNode: () => void;
    nodeTransforms: Array<Transform>;
}

namespace JSAST {

    export enum NodeType {
        ArrayExpression = 1,
        CallExpression,
        FunctionDecl,
        Identifier,
        ReturnStatement,
        StringLiteral,
    }

    export type ArrayExpressionNode = {
        type: JSAST.NodeType.ArrayExpression,
        elements: any[];
    };

    export type CallExpressionNode = {
        type: JSAST.NodeType.CallExpression,
        callee: IdentifierNode,
        arguments: any[];
    };

    export type FunctionDeclNode = {
        type: JSAST.NodeType.FunctionDecl,
        id: IdentifierNode,
        params: Node[],
        body: Node[];
    };

    export type IdentifierNode = {
        type: JSAST.NodeType.Identifier,
        name: string;
    };

    export type ReturnStatementNode = {
        type: JSAST.NodeType.ReturnStatement,
        return: any;
    };

    export type StringLiteralNode = {
        type: JSAST.NodeType.StringLiteral,
        value: string;
    };

    export type Node = ArrayExpressionNode | CallExpressionNode | FunctionDeclNode | IdentifierNode | ReturnStatementNode | StringLiteralNode;


    export function createStringLiteral(value: string): StringLiteralNode {
        return {
            type: NodeType.StringLiteral,
            value
        };
    }

    export function createIdentifier(name: string): IdentifierNode {
        return {
            type: NodeType.Identifier,
            name
        };
    }

    export function createArrayExpression(elements: any[]): ArrayExpressionNode {
        return {
            type: NodeType.ArrayExpression,
            elements
        };
    }

    export function createCallExpression(callee, arguments: any[]): CallExpressionNode {
        return {
            type: NodeType.CallExpression,
            callee: createIdentifier(callee),
            arguments
        };
    }

    export function genNode(node: Node, context: GenerateCtx) {
        switch (node.type) {
            case NodeType.FunctionDecl:
                genFunctionDecl(node, context);
                break;
            case NodeType.ReturnStatement:
                genReturnStatement(node, context);
                break;
            case NodeType.CallExpression:
                genCallExpression(node, context);
                break;
            case NodeType.StringLiteral:
                genStringLiteral(node, context);
                break;
            case NodeType.ArrayExpression:
                genArrayExpression(node, context);
                break;

            default:
                break;
        }
    }

    function genFunctionDecl(node: Node, context: GenerateCtx) {
        if (node.type !== NodeType.FunctionDecl) return;
        const { push, indent, deIndent } = context;

        // 函数签名
        push(`function ${node.id.name}`);
        push('(');
        genNodeList(node.params, context);
        push(')');

        // 函数体
        push(' {');
        indent();
        node.body.forEach(n => genNode(n, context));
        deIndent();
        push('}');
    }

    function genCallExpression(node: Node, context: GenerateCtx) { }
    function genArrayExpression(node: Node, context: GenerateCtx) { }
    function genStringLiteral(node: Node, context: GenerateCtx) { }
    function genReturnStatement(node: Node, context: GenerateCtx) { }

    function genNodeList(nodes: Node[], context: GenerateCtx) {
        const { push } = context;
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            genNode(node, context);
            if (i < nodes.length - 1) {
                push(', ');
            }
        }
    }


}




type ASTNode_Root = {
    type: 'Root',
    children: ASTNode[];
    jsNode?: JSAST.Node;
};
type ASTNode_Element = {
    type: 'Element',
    tag: string,
    children: (ASTNode_Element | ASTNode_Text)[],
    jsNode?: JSAST.Node;
};
type ASTNode_Text = {
    type: 'Text',
    content: string;
    jsNode?: JSAST.Node;
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
    const exitFn: TransformReturnFn[] = [];
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
    let i = exitFn.length;
    while (i--) {
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

function transformRoot(node: ASTNode) {
    if (node.type !== 'Root') return;
    return () => {
        if (node.type !== 'Root') return;

        const vnodeJSAST = node.children[0].jsNode;

        node.jsNode = {
            type: JSAST.NodeType.FunctionDecl,
            id: {
                type: JSAST.NodeType.Identifier,
                name: "render"
            },
            params: [],
            body: [
                {
                    type: JSAST.NodeType.ReturnStatement,
                    return: vnodeJSAST
                }
            ]
        };

    };
}

function transformElement(node: ASTNode, context: TransformCtx) {
    if (context.currentNode && context.currentNode.type !== 'Element') return;

    // 在回溯阶段处理 element node，这样可以确保该标签节点的子节点全部处理完毕
    return () => {
        if (node.type !== 'Element') return;

        // 创建 h 函数的调用语句
        // h 函数的第一个参数是标签名称，因此以 node.tag 创建一份字符串字面量作为第一个参数
        const callExp = JSAST.createCallExpression(
            'h',
            [
                JSAST.createStringLiteral(node.tag),
            ]
        );

        // 处理 h 函数调用的参数
        node.children.length === 1
            // 如果当前标签只有一个子节点，则直接使用子节点的 jsNode 作为参数
            ? callExp.arguments.push(node.children[0].jsNode)
            // 如果当前标签节点有多个子节点，则创建一个 AarryExpression 节点作为参数
            : callExp.arguments.push(JSAST.createArrayExpression(node.children.map(child => child.jsNode)));

        // 将当前标签节点对应的 JSAST 添加到 jsNode 属性下
        node.jsNode = callExp;
    };
}

function trnasformText(node: ASTNode, context: TransformCtx) {
    if (node.type !== 'Text') return;
    // transform text ast node here
    // 文本节点对应的 JS AST 节点其实就是一个字符串字面量
    // 因为只需要使用 node.content 创建一个 StringLiteral 类型的节点
    node.jsNode = JSAST.createStringLiteral(node.content);
}


type GenerateCtx = {
    code: string;
    push(code: string): void;
    currentIndent: number;
    newline(): void;
    indent(): void;
    deIndent(): void;
};

// JS AST -> render function
function generate(node: JSAST.Node): string {

    const context: GenerateCtx = {
        code: '',
        push(code: string) {
            context.code += code;
        },
        currentIndent: 0,
        newline() {
            context.code += '\n' + `  `.repeat(context.currentIndent);
        },
        indent() {
            context.currentIndent++;
            context.newline();
        },
        deIndent() {
            context.currentIndent--;
            context.newline();
        }

    };

    // 调用 genNode 函数完成代码生成工作
    JSAST.genNode(node, context);

    return context.code;
}

function isDefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}

function compile(template: Template) {
    // 得到 模版 AST
    const ast = parse(template);
    // 得到 JSAST, 并且挂载在 astNode.jsNode 属性上
    transformRoot(ast);
    // 根据 AST 生成 JS 代码
    let code: string = "";
    if (isDefined(ast.jsNode))
        code = generate(ast.jsNode);
    return code;
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
