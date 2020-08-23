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
    Chunk: "body",
    DoStatement: "body",
    FunctionDeclaration: "body",
    IfClause: "body",
    ElseifClause: "body",
    ElseClause: "body",
    WhileStatement: "body",
    RepeatStatement: "body",
    ForNumericStatement: "body",
    ForGenericStatement: "body",
    TableConstructorExpression: "fields"
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
            if (commentParents[node.type] === key) {
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

const block = (fnc, formatted_body_consumer, trailing_spaces) => {
    trailing_spaces = trailing_spaces || !formatted_body_consumer;
    return (node, indent) => {
        const {
            body
        } = node;
        const body_length = body.length;
        const body_pp = prettyPrint(body, indent + 1);
        let body_formatted;
        if (body_length === 0)
            body_formatted = " ";
        else if (body_length === 1 && body[0].type !== "Comment" && body_pp.length <= 60 && !body_pp.includes("\n"))
            body_formatted = " " + body_pp + (trailing_spaces ? " " : "");
        else
            body_formatted = "\n" + indentationText(indent + 1) + body_pp + (trailing_spaces ? "\n" + indentationText(indent) : "");
        return !formatted_body_consumer ? (fnc(node, indent) + body_formatted + "end") :
            (fnc(node, indent, body_formatted));
    }
}

const mapPrettyPrint = (array, indent) => array.map(node => prettyPrint(node, indent));
const mapPrettyPrintJoin = (array, indent) => mapPrettyPrint(array, indent).join(", ");
const indexNoParens = {
    Identifier: true,
    MemberExpression: true,
    IndexExpression: true,
    CallStatement: true,
    CallExpression: true,
    TableCallExpression: true,
    StringCallExpression: true
};
const indexPrettyPrint = (node, indent) => {
    const {
        base
    } = node;
    const base_formatted = prettyPrint(base, indent);
    return indexNoParens[base.type] ? base_formatted : "(" + base_formatted + ")";
};

const AssignmentStatement = (node, indent) => mapPrettyPrintJoin(node.variables, indent) + (node.init.length ? " = " + mapPrettyPrintJoin(node.init, indent) : "");

const generateClauseFormatters = (trailing_spaces) => {
    const IfClause = block((node, indent, body_formatted) => "if " + prettyPrint(node.condition, indent) + " then" + body_formatted, true, trailing_spaces);
    const ElseifClause = (node, indent) => "else" + IfClause(node, indent);
    const ElseClause = block((node, indent, body_formatted) => "else" + body_formatted, true, true);
    return {
        IfClause,
        ElseifClause,
        ElseClause
    };
};

const clauseFormatters = generateClauseFormatters();
const clauseFormattersTrailingSpaces = generateClauseFormatters(true);

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
        let out = "";
        const prev_ind = "\n" + indentationText(indent);
        for (let i = 0; i < clauses.length; i++) {
            const clause = clauses[i];
            if (i !== 0)
                out += prev_ind;
            out += ((i === clauses.length - 1) ? clauseFormattersTrailingSpaces : clauseFormatters)[clause.type](clause, indent);
        }
        return out + "end";
    },

    // loops
    WhileStatement: block((node, indent) => "while " + prettyPrint(node.condition, indent) + " do"),
    RepeatStatement: block((node, indent, body_formatted) => "repeat" + body_formatted + "until " + prettyPrint(node.condition, indent), true),
    ForNumericStatement: block(node => "for " + prettyPrint(node.variable) + " = " + mapPrettyPrintJoin([node.start, node.end, node.step].filter(x => x)) + " do"),
    ForGenericStatement: block((node, indent) => "for " + mapPrettyPrintJoin(node.variables) + " in " + mapPrettyPrintJoin(node.iterators, indent) + " do"),

    // operators / expressions / calls
    UnaryExpression: (node, indent) => {
        const {
            operator,
            argument
        } = node;
        let argument_pp = prettyPrint(argument, indent);
        if (isBinaryExpression(argument) && precedency[argument.operator] < precedency.unary)
            argument_pp = "(" + argument_pp + ")";
        else if (operator === "not" || argument.type === "UnaryExpression")
            argument_pp = " " + argument_pp;
        return operator + argument_pp;
    },
    BinaryExpression: (node, indent) => {
        const {
            left,
            right,
            operator
        } = node;
        const op_precedency = precedency[operator]
        let left_pp = prettyPrint(left, indent);
        let right_pp = prettyPrint(right, indent);
        if (isBinaryExpression(left) && precedency[left.operator] <= op_precedency)
            left_pp = "(" + left_pp + ")";
        if (isBinaryExpression(right) && precedency[right.operator] < op_precedency)
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
                    arguments: argument
                }, indent);
        }
        return prettyPrint(node.base, indent) + "(" + mapPrettyPrintJoin(node.arguments, indent) + ")";
    },
    StringCallExpression: (node, indent) => prettyPrint(node.base, indent) + prettyPrint(node.argument),
    TableCallExpression: (node, indent) => prettyPrint(node.base, indent) + prettyPrint(node.arguments, indent),

    TableKey: (node, indent) => "[" + prettyPrint(node.key, indent) + "] = " + prettyPrint(node.value, indent),
    TableKeyString: (node, indent) => prettyPrint(node.key, indent) + " = " + prettyPrint(node.value, indent),
    TableValue: (node, indent) => prettyPrint(node.value, indent),
    TableConstructorExpression: (node, indent) => {
        const length = node.fields.length;
        if (length === 0)
            return "{}";
        indent++;
        const fields_pp = mapPrettyPrint(node.fields, indent);
        const inline = length <= 3 && !node.fields.find(field => field.type === "Comment") && !fields_pp.find(formatted => formatted.length > 60 || formatted.includes("\n"));
        const spacing = inline ? " " : "\n" + indentationText(indent);
        const end_spacing = inline ? " " : "\n" + indentationText(indent - 1);
        let table = "{";
        for (let i = 0; i < length - 1; i++) {
            const field = node.fields[i];
            table += spacing + prettyPrint(field, indent);
            if (field.type !== "Comment" && node.fields[i + 1].type !== "Comment")
                table += ",";
        }
        if (length >= 1)
            table += spacing + prettyPrint(node.fields[length - 1], indent);
        return table + end_spacing + "}";
    },
    MemberExpression: (node, indent) => indexPrettyPrint(node, indent) + node.indexer + prettyPrint(node.identifier, indent),
    IndexExpression: (node, indent) => indexPrettyPrint(node, indent) + "[" + prettyPrint(node.index, indent) + "]",

    // TODO include sanity check if values are implemented for string literals (upstream feature needed)
    StringLiteral: node => writeBeautifiedText(read(node.value || node.raw)),
    NumericLiteral: node => {
        node.value = node.value || read(node.raw);
        const rawUpper = node.raw.toUpperCase();
        if (rawUpper.startsWith("0X"))
            return "0x" + rawUpper.substring(2);
        return writeBeautifiedText(node.value);
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