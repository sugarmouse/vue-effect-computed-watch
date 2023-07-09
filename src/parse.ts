enum TextModes {
    DATA = 'data',
    RCDATA = 'rcdata',
    RAWTEXT = 'rawtext',
    CDATA = 'cdata',
}

type ParseContext = {
    source: string,
    mode: TextModes;
    advanceBy(num: number): void;
    advanceSpaces(): void;
};

enum NodeType {
    Element = 'Element',
    Attribute = 'Attribute',
    Text = 'Text',
    Root = 'Root',
}

type ASTNode_Root = {
    type: NodeType.Root,
    children: ASTNode[];
};
type ASTNode_Element = {
    type: NodeType.Element,
    tag: string,
    children: ASTNode[],
    props: any[],
    isSelfClosing: boolean;
};
type ASTNode_Attribute = {
    type: NodeType.Attribute,
    name: string,
    value: string;
};
type ASTNode_Text = {
    type: NodeType.Text,
    content:string,
}

type ASTNode = ASTNode_Element | ASTNode_Attribute | ASTNode_Text;

function parse(str: string): ASTNode_Root {
    const context = {
        source: str,
        mode: TextModes.DATA,
        // 消费指定数量的字符
        advanceBy(num: number) {
            context.source = context.source.slice(num);
        },
        // 消费无用的空白字符
        advanceSpaces() {
            const match = /^[\t\r\n\f ]+/.exec(context.source);
            if (match) {
                context.advanceBy(match[0].length);
            }
        }
    };

    // 第二个参数代表由父节点构成的节点栈，初始为空
    const nodes = parseChildren(context, []);

    return {
        type: NodeType.Root,
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
// parseChildren 函数本质上是一个状态机，遇到一个 tag 就会开启一个状态机，遇到相匹配的结束标签就会结束此状态机
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
                    console.error('invalid end tag');
                    continue;
                } else if (/[a-z]/i.test(source[1])) {
                    node = parseElement(context, ancestors);
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
    if (!context.source) return true;

    const parent = ancestors[ancestors.length - 1];

    // 与整个父级节点栈中的所有节点作比较
    for (let i = ancestors.length - 1; i >= 0; i--) {
        // 如果遇到结束标签，并且该标签与父级标签同名，则停止当前状态机
        if (parent && context.source.startsWith(`</${ancestors[i].tag}>`)) {
            return true;
        }
    }
    return false;
}
function parseComment(context: ParseContext): ASTNode {
    throw new Error("Function not implemented.");
}

function parseCData(context: ParseContext): ASTNode {
    throw new Error("Function not implemented.");
}

function parseElement(context: ParseContext, ancestors: ASTNode[]): ASTNode {
    // 解析开始标签
    const element = parseTag(context);
    if (element.isSelfClosing) return element;

    if (element.tag === 'textarea' || element.tag === 'title') {
        context.mode = TextModes.RCDATA;
    } else if (/style | xmp | iframe | noembed | noframes | noscript/.test(element.tag)) {
        context.mode = TextModes.RAWTEXT;
    } else {
        context.mode = TextModes.DATA;
    }

    ancestors.push(element);

    // 递归调用 parseChildren 函数对当前标签的子节点解析
    element.children = parseChildren(context, ancestors);
    ancestors.pop();

    // 解析结束标签
    if (context.source.startsWith(`</${element.tag}`)) {
        parseTag(context, 'end');
    } else {
        console.error(`${element.tag} is not closed`);
    }

    return element;
}

function parseInterpolation(context: ParseContext): ASTNode {
    throw new Error("Function not implemented.");
}

function parseText(context: ParseContext): ASTNode_Text {
    let endIndex = context.source.length;
    const ltIndex = context.source.indexOf('<');

    const delimiterIndex = context.source.indexOf('{{');

    if (ltIndex > -1 && ltIndex < endIndex) {
        // 解析到下一个特殊字符 <
        endIndex = ltIndex
    }

    if(delimiterIndex > -1 && delimiterIndex < endIndex) {
        endIndex = delimiterIndex
    }

    const content = context.source.slice(0, endIndex);

    context.advanceBy(content.length)

    return {
        type:NodeType.Text,
        content
    }
}

function parseTag(context: ParseContext, type: 'start' | 'end' = 'start'): ASTNode_Element {
    const { advanceBy, advanceSpaces } = context;

    const match = type === 'start'
        ? /^<([a-z][^\t\r\n\f />]*)/i.exec(context.source)
        : /^<\/([a-z][^\t\r\n\f />]*)/i.exec(context.source);

    if (!match) {
        throw new Error('invalid tag');
    }

    const tag = match[1];
    advanceBy(match[0].length);
    advanceSpaces();

    const props = parseAttributes(context);

    // 如果是自闭和得消费两个字符，不是的话消费一个
    const isSelfClosing = context.source.startsWith(`/>`);
    advanceBy(isSelfClosing ? 2 : 1);

    return {
        type: NodeType.Element,
        tag,
        props,
        children: [],
        isSelfClosing
    };
}

function parseAttributes(context: ParseContext): ASTNode_Attribute[] {
    const { advanceBy, advanceSpaces } = context;
    const props: ASTNode_Attribute[] = [];

    while (
        !context.source.startsWith('>')
        && !context.source.startsWith('/>')
    ) {
        // 匹配属性名
        const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source);
        if (!match) throw new Error("parse attributes error");
        const name = match[0];
        // 消费属性名
        advanceBy(name.length);
        advanceSpaces();
        // 消费 "=" 
        advanceBy(1);
        advanceSpaces();

        let value = "";
        const quote = context.source[0];
        // 检查属性值是否有引号包裹
        const isQuoted = quote === '"' || quote === "'";
        if (isQuoted) {
            // 消费引号
            advanceBy(1);
            const endQuoteIndex = context.source.indexOf(quote);
            if (endQuoteIndex > -1) {
                value = context.source.slice(0, endQuoteIndex);
                advanceBy(value.length);
                advanceBy(1);
            } else {
                console.error("lack of quotation mark");
            }
        } else {
            // 匹配到下一个空格或者 ">" 字符
            const match = /^[^\t\r\n\f >]+/.exec(context.source);
            if (!match) throw new Error("parse Attributes error: can't find unquoted value of attribute");
            value = match[0];
            advanceBy(value.length);
        }
        advanceSpaces();
        props.push({
            type: NodeType.Attribute,
            name,
            value
        });
    }
    return props;
}

export { };
