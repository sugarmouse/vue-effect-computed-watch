type Template = string;
type AST = object;
type JSAST = object;
type RenderFuntion = (...arg: any[]) => any;

// template code -> template AST
function parse(template: Template): AST {

    return {};
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