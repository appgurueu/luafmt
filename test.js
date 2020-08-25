"use strict"
const litest = require("litests")
const luafmt = require("./index.js")

new litest.Tester(luafmt.formatChunk).testEqualsAll({
	"_=true,false,nil,...": "_ = true, false, nil, ...", // atomics
	"_=1,1000,1000000,0xff": "_ = 1, 1e3, 1e6, 0xFF", // simple number formatting
	'_=[[\'_]], [["_"]]': `_ = "'_", '"_"'`,
	"f('_')": `f"_"`,
	'f("_")': `f"_"`,
	"f[[_]]": `f"_"`,
	"f({_})": "f{ _ }",
	"f({_})._ = _": "f{ _ }._ = _",
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
	"a = (1+1)*(1+1)": "a = (1 + 1) * (1 + 1)",
	"a = 1 + (1 + 1) + 1": "a = (1 + 1 + 1) + 1",
	"_ = not (1 and 1)": "_ = not(1 and 1)",
	"_ = _ or not ((_ and _) or (_ and _))": "_ = _ or not(_ and _ or _ and _)",
	"function _()function _() if _ then --[[comment]] end end end": `function _()
\tfunction _()
\t\tif _ then
\t\t\t-- comment
\t\tend
\tend
end`,
	"do do do --[[comment]] end end end": `do
\tdo
\t\tdo
\t\t\t-- comment
\t\tend
\tend
end`,
	"_{_=_}": `_{ _ = _ }`,
	"_=('string')._": `_ = ("string")._`,
	"_=({})._": "_ = ({})._",
	"_=- -_": "_ = - -_",
	"if _ then _()end": "if _ then _() end",
	"if a then a() elseif b then b() else c() end": `if a then a()
elseif b then b()
else c() end`,
	"local _": "local _",
	"_=_\nfunction _()end": `_ = _

function _() end`,
	"function _()end;function _()end": `function _() end

function _() end`,
	"_ = function() end": "_ = function() end",
	"_()--comment\nfunction _()end": `_()

-- comment
function _() end`,
	[`_{
	_ = function() end,
	-- comment
	_ = function() end
}`]: `_{
	_ = function() end,
	-- comment
	_ = function() end
}`,
"repeat _() until _": "repeat _() until _",
"repeat _();_() until _": `repeat
	_()
	_()
until _`,
"if _ then _() end": "if _ then _() end"
})
