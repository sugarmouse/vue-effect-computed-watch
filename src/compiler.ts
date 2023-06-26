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

type Transform = (node: ASTNode, context: TransformCtx) => void;
interface TransformCtx {
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

    let currentNode = ast;
    const transforms = context.nodeTransforms;

    // execute transforms
    for (let i = 0; i < transforms.length; i++) {
        transforms[i](currentNode, context);
    }

    if (currentNode.type === "Text") {
        return;
    }

    // traverse children
    let children = currentNode.children;
    for (let i = 0; i < children.length; i++) {
        traverseNode(children[i], context);
    }

}

// template AST -> JS AST
function transform(ast: ASTNode): JSAST {
    traverseNode(ast, {
        nodeTransforms: [
            trnasformText,
            transformElement
        ]
    });

    dump(ast);
    return {};
}

function transformElement(node: ASTNode, context: TransformCtx) {
    if (node.type !== 'Element') return;
    // transform element ast node here
}

function trnasformText(node: ASTNode, context: TransformCtx) {
    if (node.type !== 'Text') return;
    // transform text ast node here
}

// JS AST -> render function
function generate(jsast: JSAST): RenderFuntion {
    function render() {

    }
    return render;
}
