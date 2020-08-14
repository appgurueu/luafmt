"use strict";
const litest = require("litests");
const luafmt = require("./index.js");

new litest.Tester(luafmt.formatChunk).testEqualsAll({
    "_=true,false,nil,...": "_ = true, false, nil, ...", // atomics
    "_=1,1000,1000000,0xff": "_ = 1, 1e3, 1e6, 0xFF", // simple number formatting
    "_=[['s]], [[\"quote\"]]": `_ = "'s", '"quote"'`,
    "f('text')": `f"text"`,
    "f(\"text\")": `f"text"`,
    "f[[text]]": `f"text"`,
    "f({table})": `f{\n\ttable\n}`,
    "if _ then --comment \n do _=_--another comment\n end end": `if _ then
\t-- comment
\tdo
\t\t_ = _
\t\t-- another comment
\tend
end`,
    "_=--[[comment]]_": "-- comment\n_ = _",
    "--[[multi\nline]]": `--[[
\tmulti
\tline
]]`,
    "a = 1*1 + 1": "a = 1 * 1 + 1",
    "a = 1 + 1 * 1": "a = 1 + 1 * 1",
    "a = (1+1)*(1+1)": "a = (1 + 1) * (1 + 1)"
});