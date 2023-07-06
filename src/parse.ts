enum TextModes {
    DATA = 'data',
    RCDATA = 'rcdata',
    RAWTEXT = 'rawtext',
    CDATA = 'cdata',
}

type ParseContext = {
    source: string,
    mode: TextModes;
};

enum NodeType {
    Element = 'Element',
    Text = 'Text',
    Root = 'Root',
}

type ASTNode_Root = {
    type: NodeType.Root,
    children: ASTNode[];
    jsNode?: JSAST.Node;
};
type ASTNode_Element = {
    type: NodeType.Element,
    tag: string,
    children: (ASTNode_Element | ASTNode_Text)[],
    jsNode?: JSAST.Node;
};
type ASTNode_Text = {
    type: NodeType.Text,
    content: string;
    jsNode?: JSAST.Node;
};

type ASTNode = ASTNode_Element | ASTNode_Text | ASTNode_Root;

function parse(str: string) {
    const context = {
        source: str,
        mode: TextModes.DATA,
    };

    // 第二个参数代表由父节点构成的节点栈，初始为空
    const nodes = parseChildren(context, []);

    return {
        type: 'Root',
        children: nodes
    };
}

/**
 * <p>1</p>
 * <p>2</p>
 * 
 * to
 * 
 * [
 *  {type: 'Element', tag: 'p', children: [...]}
 *  {type: 'Element', tag: 'p', children: [...]}
 * ]
 */

// 标签节点 div
// 文本插值节点 {{ value }}
// 普通文本节点 text
// html 注释节点
// CDATA 节点 <![CDATA[ xxx ]]>
function parseChildren(context: ParseContext, ancestors: ASTNode[]): ASTNode[] {
    let nodes: ASTNode[] = [];

    const { source, mode } = context;

    while (!isEnd(context, ancestors)) {
        let node: ASTNode | null = null;

        // 只有 DATA 和 CDATA 模式才支持插值节点的解析
        if (mode === TextModes.DATA || mode === TextModes.RCDATA) {

            if (mode === TextModes.DATA && source[0] === "<") {
                if (source[1] === '!') {
                    if (source.startsWith('<!--')) {
                        node = parseComment(context);
                    } else if (source.startsWith('<![CDATA[')) {
                        node = parseCData(context);
                    } else {
                        // error
                    }
                } else if (source[1] === '/') {
                    // end tag
                    // error
                } else if (/[a-z]/i.test(source[1])) {
                    node = parseElement(context);
                }

            } else if (source.startsWith('{{')) {

                node = parseInterpolation(context);
            }
        }

        // node 不存在说明处于其他模式，不是 DATA 也不是 RCDATA
        // 作为文本处理
        if (!node) {
            node = parseText(context);
        }
        nodes.push(node);
    }
    return nodes;
}

function isEnd(context: ParseContext, ancestors: ASTNode[]): boolean {
    throw new Error("Function not implemented.");
}
function parseComment(context: ParseContext): ASTNode {
    throw new Error("Function not implemented.");
}

function parseCData(context: ParseContext): ASTNode {
    throw new Error("Function not implemented.");
}

function parseElement(context: ParseContext): ASTNode {
    // 解析开始标签
    const element = parseTag();
    // 递归调用 parseChildren 函数对当前标签的子节点解析
    element.children = parseChildren();
    // 解析结束标签
    parseEndTag();

    return element;
}

function parseInterpolation(context: ParseContext): ASTNode {
    throw new Error("Function not implemented.");
}

function parseText(context: ParseContext): ASTNode {
    throw new Error("Function not implemented.");
}

export { };