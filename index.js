"use strict";
const {
    parse,
    defaultOptions
} = require("luaparse");

const {
    read,
    writer,
    writeBeautifiedText
} = require("luon");

const commentWriter = writer({
    string_format: "long_newline"
});
const writeLongText = content => commentWriter.write(content).text;

defaultOptions.ranges = true;

const _precedency = [
    ["^"],
    ["unary"],
    ["*", "/", "%"],
    ["+", "-"],
    [".."],
    ["<", ">", "<=", ">=", "~=", "=="],
    ["and"],
    ["or"]
]

const precedency = {};
for (let i = 0; i < _precedency.length; i++) {
    for (let operator of _precedency[i])
        precedency[operator] = _precedency.length - i;
}

const commentParents = {
    Chunk: true,
    DoStatement: true,
    FunctionDeclaration: true,
    IfStatement: false,
    IfClause: true,
    ElseIfClause: true,
    ElseClause: true,
    WhileStatement: true,
    RepeatStatement: true,
    ForNumericStatement: true,
    ForGenericStatement: true,
    TableConstructorExpression: true
};

// HACK to make luaparse ranges be from "if" to "end" and not from "if" to "then" for IfClauses
// TODO ensure luaparse behaves strangely only for IfClauses
const fixRanges = node => {
    if (node.range) {
        if (node.type === "IfStatement") {
            for (let i = 0; i < node.clauses.length - 1; i++) {
                node.clauses[i].range[1] = node.clauses[i + 1].range[0] - 1;
            }
            node.clauses[node.clauses.length - 1].range[1] = node.range[1];
        }
    }
    for (let key in node) {
        let children = node[key];
        if (Array.isArray(children))
            children.forEach(fixRanges);
        else if (children !== null && typeof (children) === "object" && children.type)
            fixRanges(children);
    }
};

const insertComment = (node, comment) => {
    for (let key in node) {
        let children = node[key];
        if (Array.isArray(children)) {
            // TODO binary search, ensure AST is properly sorted for this to work
            let comment_parent_index = children.findIndex(node => node.range && node.range[0] <= comment.range[0] && node.range[1] >= comment.range[1]);
            const comment_parent = comment_parent_index !== -1 && children[comment_parent_index];
            if (comment_parent && insertComment(comment_parent, comment))
                return true;
            if (commentParents[node.type]) {
                if (children.length) {
                    comment_parent_index = comment_parent ? comment_parent_index : children.findIndex(node => node.range[0] > comment.range[1]);
                    if (comment_parent_index === -1)
                        comment_parent_index = children.length + 1;
                    // insert comment as own child
                    node[key].splice(comment_parent_index, 0, comment);
                } else {
                    node[key] = [comment];
                }
                return true;
            }
        } else if (children !== null && typeof (children) === "object" && children.type) {
            if (insertComment(children, comment)) {
                return true;
            }
        }
    }
};

const insertComments = chunk => chunk.comments.forEach(comment => insertComment(chunk, comment));

const isBinaryExpression = node => node.type === "LogicalExpression" || node.type === "BinaryExpression";

const indentationText = number => "\t".repeat(number);

const block = (fnc, modify) => {
    return (node, indent) => {
        const prev_ind = "\n" + "\t".repeat(indent);
        const ind = "\n" + "\t".repeat(indent + 1);
        return !modify ? (fnc(node, indent) + ind + prettyPrint(node.body, indent + 1) + prev_ind + "end") :
            (fnc(node, indent, ind + prettyPrint(node.body, indent + 1) + prev_ind));
    }
}

const mapPrettyPrint = (array, indent) => array.map(node => prettyPrint(node, indent));
const mapPrettyPrintJoin = (array, indent) => mapPrettyPrint(array, indent).join(", ");

const AssignmentStatement = (node, indent) => mapPrettyPrintJoin(node.variables, indent) + " = " + mapPrettyPrintJoin(node.init, indent);
let formatters = {
    // comments
    Comment: (node, indent) => {
        let content = node.value.trim();
        if (!node.raw.startsWith("--[") || content.indexOf("\n") === -1)
            return "-- " + content.trim();
        const indentation = indentationText(indent + 1);
        return "--" + writeLongText(indentation + content.replace(/\s*\n\s*/g, "\n" + indentation) + "\n" + indentationText(indent));
    },

    // various trivial stuff; identifiers, simple statements
    Identifier: node => node.name,
    Chunk: (node, indent) => prettyPrint(node.body, indent),
    LabelStatement: node => "::" + node.label + "::",
    GotoStatement: node => "goto " + node.label,
    BreakStatement: _ => "break",
    ReturnStatement: (node, indent) => node.arguments.length === 0 ? "return" : ("return " + mapPrettyPrintJoin(node.arguments, indent)),
    DoStatement: block(() => "do"),

    // assignments
    AssignmentStatement,
    LocalStatement: (node, indent) => "local " + AssignmentStatement(node, indent),
    FunctionDeclaration: block(node => (node.isLocal ? "local " : "") + "function" + (node.identifier ? (" " + prettyPrint(node.identifier)) : "") + "(" + mapPrettyPrintJoin(node.parameters) + ")"),

    // if-[elseif]-[else] chains
    IfStatement: (node, indent) => {
        const clauses = node.clauses;
        let clause = clauses[0];
        const prev_ind = "\n" + indentationText(indent);
        indent++;
        const ind = "\n" + "\t".repeat(indent);
        let out = "if " + prettyPrint(clause.condition, indent - 1) + " then" + ind + prettyPrint(clause.body, indent);
        for (let i = 1; i < clauses.length; i++) {
            let clause = clauses[i];
            out += prev_ind + "else" + (clause.type === "ElseIfClause" ? ("if " + prettyPrint(clause.condition, indent - 1) + " then") : "") + ind + prettyPrint(clause.body, indent);
        }
        return out + prev_ind + "end";
    },

    // loops
    WhileStatement: block((node, indent) => "while " + prettyPrint(node.condition, indent) + " do"),
    RepeatStatement: block((node, indent, thing) => "repeat" + thing + "until " + prettyPrint(node.condition, indent), true),
    ForNumericStatement: block(node => "for " + prettyPrint(node.variable) + " = " + mapPrettyPrintJoin([node.start, node.end, node.step].filter(x => x)) + " do"),
    ForGenericStatement: block((node, indent) => "for " + mapPrettyPrintJoin(node.variables) + " in " + mapPrettyPrintJoin(node.iterators, indent) + " do"),

    // operators / expressions / calls
    UnaryExpression: (node, indent) => {
        const {
            operator,
            argument
        } = node;
        let argument_pp = prettyPrint(argument, indent);
        if (isBinaryExpression(argument) && precedency[argument.operator] >= precedency.unary)
            argument_pp = "(" + argument_pp + ")";
        else
            argument_pp = " " + argument_pp;
        return operator + argument_pp;
    },
    BinaryExpression: (node, indent) => {
        const {
            left,
            right,
            operator
        } = node;
        let left_pp = prettyPrint(left, indent);
        let right_pp = prettyPrint(right, indent);
        if (isBinaryExpression(left) && precedency[left.operator] < precedency[operator])
            left_pp = "(" + left_pp + ")";
        if (isBinaryExpression(right) && precedency[right.operator] < precedency[operator])
            right_pp = "(" + right_pp + ")";
        return left_pp + " " + operator + " " + right_pp;
    },
    CallStatement: (node, indent) => prettyPrint(node.expression, indent),
    CallExpression: (node, indent) => {
        if (node.arguments.length === 1) {
            const argument = node.arguments[0];
            if (argument.type === "StringLiteral")
                return formatters.StringCallExpression({
                    base: node.base,
                    argument: argument
                }, indent);
            if (argument.type === "TableConstructorExpression")
                return formatters.TableCallExpression({
                    base: node.base,
                    argument: argument
                }, indent);
        }
        return prettyPrint(node.base, indent) + "(" + mapPrettyPrintJoin(node.arguments, indent) + ")";
    },
    StringCallExpression: (node, indent) => prettyPrint(node.base, indent) + prettyPrint(node.argument),
    TableCallExpression: (node, indent) => prettyPrint(node.base, indent) + prettyPrint(node.argument, indent),

    TableKey: (node, indent) => "[" + prettyPrint(node.key, indent) + "] = " + prettyPrint(node.value, indent),
    TableKeyString: (node, indent) => prettyPrint(node.key, indent) + " = " + prettyPrint(node.value, indent),
    TableValue: (node, indent) => prettyPrint(node.value, indent),
    TableConstructorExpression: (node, indent) => {
        indent++;
        const length = node.fields.length
        const newline_ind = "\n" + indentationText(indent);
        let table = "{";
        for (let i = 0; i < length - 1; i++) {
            const field = node.fields[i];
            table += newline_ind + prettyPrint(field, indent);
            if (field.type !== "Comment" && node.fields[i + 1].type !== "Comment")
                table += ",";
        }
        if (length >= 1)
            table += newline_ind + prettyPrint(node.fields[length - 1], indent);
        return table + "\n" + indentationText(indent - 1) + "}";
    },
    MemberExpression: (node, indent) => prettyPrint(node.base) + node.indexer + prettyPrint(node.identifier, indent),
    IndexExpression: (node, indent) => prettyPrint(node.base) + "[" + prettyPrint(node.index, indent) + "]",

    // TODO include sanity check if values are implemented for string literals (upstream feature needed)
    StringLiteral: node => writeBeautifiedText(read(node.raw)),
    NumericLiteral: node => {
        if (!node.value)
            throw new Error("Node has no value");
        const rawUpper = node.raw.toUpperCase();
        if (rawUpper.startsWith("0X"))
            return "0x" + rawUpper.substring(2);
        const result = writeBeautifiedText(node.value);
        if (parse("x=" + result).body[0].init[0].value !== node.value)
            throw new Error("Luon beautified number literal has invalid value");
        return result;
    }
};

for (const literal of ["BooleanLiteral", "NilLiteral", "VarargLiteral"])
    formatters[literal] = node => node.raw;

formatters.LogicalExpression = formatters.BinaryExpression;

const prettyPrint = (node, indent) => {
    const indent_str = "\t".repeat(indent);
    if (Array.isArray(node))
        return mapPrettyPrint(node, indent).join("\n" + indent_str);
    let formatter = formatters[node.type];
    if (!formatter)
        throw new Error("Formatter for " + node.type + " not implemented yet");
    return formatter(node, indent);
};

const prettyPrintText = (text) => {
    const ast = parse(text);
    fixRanges(ast);
    insertComments(ast);
    return prettyPrint(ast, 0);
}

module.exports = {
    formatChunk: prettyPrintText
};