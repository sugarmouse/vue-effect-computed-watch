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

function parseChildren(context: ParseContext, nodes: ASTNode[]): ASTNode[] {

}

export { };