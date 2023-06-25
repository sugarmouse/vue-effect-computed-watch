type Template = string;
type AST = object;
type JSAST = object;
type RenderFuntion = (...arg: any[]) => any;
type Tokens = any[]

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
function parse(template: Template): AST {

    const tokens = tokenize(template);

    const root = {
        type: 'Root',
        children: []
    }

    const elementStack: AST[] = [root];

    while (tokens.length !== 0) {
        const parent = elementStack[elementStack.length -1]

        const t = tokens[0];

        switch (t.type) {
            case 'tag':
                const elementNode = {
                    type: 'Element',
                    tag: t.value,
                    children: []
                }
                parent.children.push(elementNode);
                elementStack.push(elementNode);
                break
            case 'text':
                const textNode = {
                    type: 'Text',
                    content: t.content
                }
                parent.children.push(textNode);
                break
            case 'tagEnd':
                elementStack.pop();
                break
        }
        tokens.shift();
    }

    return root;
}

// template AST -> JS AST
function transform(ast: AST): JSAST {
    return {};
}

// JS AST -> render function
function generate(jsast: JSAST): RenderFuntion {
    function render() {

    }
    return render;
}
