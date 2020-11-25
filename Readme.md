# Luafmt

A small Lua formatter / pretty printer. Designed for 5.1, may support newer versions.

## About

Luafmt is licensed under the MIT license and written by Lars Mueller alias appgurueu.

## Features

* Fixes spacing & indentation
* Neat literal formatting
* Converts `({})` and `('')`/`("")`/`([[]])` calls to short forms
* Moves comments to reasonable scopes (blocks or table constructors)
* Table & function inlining
* Extra newlines around function declarations

## API

### Installation

Install the NPM package [luafmt](https://npmjs.com/package/@appguru/luafmt):

```
npm install @appguru/luafmt
```

And import it like this:

```javascript
const { ast, formatChunk, formatter } = require("@appguru/luafmt")
```

#### `ast`

Abstract syntax tree methods.

##### `fixRanges`

Makes luaparse ranges be from `if` to `end` and not from `if` to `then` for all IfClauses of the AST.

##### `insertComments(chunk)`

Inserts comments into the top-level abstract syntax tree provided by luaparse.

##### `formatter(conf)`

Provides a formatter which returns a function `format(ast, [indent])` taking a luaparse AST & optionally the base indentation as number.
Note that you have to call [`fixRanges`] and [`insertComments`] on the AST yourself before using it:

```javascript
const { ast } = require("@appguru/luafmt")
const { parse } = require("luaparse") 
const srcAST = parse(`-- hello world
if true then print'hello world!'
else _ = _ end`)
const formatter = ast.formatter()
ast.fixRanges(srcAST)
ast.insertComments(srcAST)
console.log(formatter(srcAST))
```

#### `formatChunk(text)`

Takes a Lua chunk (think file / function body) as string and returns a formatted version, also as string.

#### `formatter(conf)`

```javascript
const configuredFormatChunk = formatter({
  // string
  indent: "\t",
  // string
  newline: "\n",
  // boolean
  extra_newlines: true,
  // object
	inline: {
    // object or false
		block: {
			max_exp_length // number, in characters
    },
    // object or false
		table: {
			max_field_count // number
			max_field_length // number, in characters
		}
	}
})
```

### Versions

* `v1.0.0`
  * The initial release
* `v1.0.7`
  * Lots of fixes
* `v1.0.8`
  * Empty blocks are now just a single space, no space after `#`
  * Fixed dependency constraints
* `v1.0.9`
  * Fixed operator precedence
* `v1.0.10`
  * Fixed table index operators (adding parens around base)
* `v1.1.0`
  * Fixed double minus (`- -x`)
  * Added inline tables & blocks
* `v1.1.1`
  * Fixed if statement formatting
* `v1.1.2`
  * Fixed local declarations without initializers (`local name`)
  * Tweaked table inlining
* `v1.2.0`
  * Added extra newlines around function declarations feature
* `v1.2.1`
  * Fixed table constructors containing comments
* `v1.2.2`
  * Fixed repeat-until statement formatting
  * Bumped `luon` version to `v1.2.6`
* `v1.2.3`
  * Fixed extra newlines
  * Improved tests
* `v1.2.4`
  * Fixed extra newlines
* `v1.3.0`, `v1.4.0`
  * Added configuration
* `v1.4.1`
  * Fixed Readme
* `v1.4.2`
  * Fixed (removed) trailing commas after fields followed by comments
  * Fixed (removed) obsolete (possibly invalid) bracketing (precedencies)
* `v1.4.3`
  * Tweaked: Obsolete brackets are omitted in the case of concatenation, but not for exponentation
* `v1.5.0`
  * Exposed AST-functions `fixRanges` & `insertComments` as well as lower-level AST formatter