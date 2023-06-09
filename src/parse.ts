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
    Interpolation = "Interpolation",
    Comment = "Comment"
}

enum PatchFlags  {
    TEXT = 1,
    CLASS = 2,
    STYLE = 3,
}

type ASTNode_Comment = {
    type: NodeType.Comment,
    content: string,
};
type ASTNode_Interpolation = {
    type: NodeType.Interpolation,
    content: {
        type: string,
        content: string,
    };
};
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
    content: string,
};

type ASTNode = ASTNode_Element | ASTNode_Attribute | ASTNode_Text | ASTNode_Interpolation | ASTNode_Comment;

const namedCharacterReferneces = {
    "gt": ">",
    "gt;": ">",
    "lt": "<",
    "lt;": "<",
    "ltcc;": "⪦"
};

const CCR_REPLACEMENTS = {
    0x80: 0x20ac,
    0x82: 0x201a,
    0x83: 0x0192,
    0x84: 0x201e,
    0x85: 0x2026,
    0x86: 0x2020,
    0x87: 0x2021,
    0x88: 0x02c6,
    0x89: 0x2030,
    0x8a: 0x0160,
    0x8b: 0x2039,
    0x8c: 0x0152,
    0x8e: 0x017d,
    0x91: 0x2018,
    0x92: 0x2019,
    0x93: 0x201c,
    0x94: 0x201d,
    0x95: 0x2022,
    0x96: 0x2013,
    0x97: 0x2014,
    0x98: 0x02dc,
    0x99: 0x2122,
    0x9a: 0x0161,
    0x9b: 0x203a,
    0x9c: 0x0153,
    0x9e: 0x017e,
    0x9f: 0x0178
};

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
function parseChildren(context: ParseContext, ancestors: ASTNode_Element[]): ASTNode[] {
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

function isEnd(context: ParseContext, ancestors: ASTNode_Element[]): boolean {
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
function parseComment(context: ParseContext): ASTNode_Comment {
    context.advanceBy('<!--'.length);
    let closeIndex = context.source.indexOf('-->');

    const content = context.source.slice(0, closeIndex);
    context.advanceBy(content.length);
    context.advanceBy('-->'.length);
    return {
        type: NodeType.Comment,
        content,
    };
}

function parseCData(context: ParseContext): ASTNode {
    throw new Error("Function not implemented.");
}

function parseElement(context: ParseContext, ancestors: ASTNode_Element[]): ASTNode {
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

function parseInterpolation(context: ParseContext): ASTNode_Interpolation {
    context.advanceBy("{{".length);

    const closeIndex = context.source.indexOf("}}");
    if (closeIndex < 0) {
        console.error("差值缺少结束界定符");
    }

    const content = context.source.slice(0, closeIndex);

    context.advanceBy(content.length);
    context.advanceBy("}}".length);

    return {
        type: NodeType.Interpolation,
        content: {
            type: 'Expression',
            content: decodeHtml(content)
        }
    };

}

function parseText(context: ParseContext): ASTNode_Text {
    let endIndex = context.source.length;
    const ltIndex = context.source.indexOf('<');

    const delimiterIndex = context.source.indexOf('{{');

    if (ltIndex > -1 && ltIndex < endIndex) {
        // 解析到下一个特殊字符 <
        endIndex = ltIndex;
    }

    if (delimiterIndex > -1 && delimiterIndex < endIndex) {
        endIndex = delimiterIndex;
    }

    const content = context.source.slice(0, endIndex);

    context.advanceBy(content.length);

    return {
        type: NodeType.Text,
        content: decodeHtml(content)
    };
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

function decodeHtml(rawText: string, asAttr: boolean = false): string {
    let offset = 0;
    const end = rawText.length;

    // 解码后的文本
    let decodeText = '';
    let maxCRNameLength = 0;

    const advance = (length: number) => {
        offset += length;
        rawText = rawText.slice(length);
    };

    while (offset < end) {
        // 找到匹配字符引用的开始部分， head[0] 有可能是 "&","&#","&#x"
        const head = /&(?:#x?)?/i.exec(rawText);

        // 没找到匹配字符串的头，没有需要解码的内容了
        if (!head) {
            const remaining = end - offset;
            decodeText += rawText.slice(0, remaining);
            advance(remaining);
            break;
        }

        // 消费 html 实体之前的字符串
        decodeText += rawText.slice(0, head.index);
        advance(head.index);

        if (head[0] === '&') {
            // 
            let name = '';
            let value: string | null = null;


            if (/[0-9a-z]/i.test(rawText[1])) {
                // 计算出引用表中实体名称最大的长度
                if (!maxCRNameLength) {
                    maxCRNameLength = Object.keys(namedCharacterReferneces).reduce(
                        (max, name) => Math.max(max, name.length),
                        0
                    );
                }

                // 从最长的长度开始找，检查有没有可以与表中匹配的实体名称
                for (let length = maxCRNameLength; !value && length > 0; length--) {
                    name = rawText.substring(1, length);
                    value = namedCharacterReferneces[name];
                }


                if (value) {
                    const semi = name.endsWith(";");

                    if (
                        asAttr
                        && !semi
                        && /[=a-z0-9]/i.test(rawText[name.length + 1]) || ''
                    ) {
                        decodeText += '&' + name;
                        advance(1 + name.length);
                    } else {
                        decodeText += value;
                        advance(1 + name.length);
                    }
                } else {
                    // 没有找到对应的值，说明解码失败
                    decodeText += '&' + name;
                    advance(1 + name.length);
                }
            } else {
                // 如果 & 字符的下一个字符不是 ASCII 字母或者数字，则将字符 & 作为普通文本
                decodeText += '&';
                advance(1);
            }
        } else {
            const hex = head[0] === '&#x';
            const pattern = hex ? /^&#x([0-9a-f]+);?/i : /^&#([0-9]+);?/;

            const body = pattern.exec(rawText);

            if (body) {
                let cp = Number.parseInt(body[1], hex ? 16 : 10);

                if (cp === 0) {
                    cp = 0xfffd;
                } else if (cp > 0x10ffff) {
                    cp = 0xfffd;
                } else if (cp >= 0xd800 && cp <= 0xdfff) {
                    cp = 0xfffd;
                } else if ((cp >= 0xfdd0 && cp <= 0xfdef) || (cp & 0xfffe) === 0xfffe) {
                    // 码点值处于 noncharacter 范围内，则什么都不做
                } else if (
                    (cp >= 0x01 && cp <= 0x08) ||
                    cp === 0x0b ||
                    (cp >= 0x0d && cp <= 0x1f) ||
                    (cp >= 0x7f && cp <= 0x9f)
                ) {
                    // 在 CCR_REPLACEMENTS 表中查找替换码点，如果找不到，则使用原码点
                    cp = CCR_REPLACEMENTS[cp] || cp;
                }

                decodeText += String.fromCodePoint(cp);
                advance(body[0].length);
            } else {
                // 如果没有匹配，则不进行解码操作，只是把 head[0] 追加到 decodeText 上
                decodeText += head[0];
                advance(head[0].length);
            }
        }
    }

    return decodeText;
}

export { };
