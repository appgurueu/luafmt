# Luafmt

A small Lua formatter / pretty printer. Designed for 5.1, may support newer versions.

## About

Luafmt is licensed under the MIT license and written by Lars Mueller alias appgurueu.

## Features

* Fixes spacing & indentation
* Neat literal formatting (note: doesn't touch hex number literals)
* Converts `({})` and `('')`/`("")`/`([[]])` calls to short forms
* Moves comments to reasonable scopes (blocks or table constructors)

## API

### Installation

Install the NPM package [luafmt](https://npmjs.com/package/@appguru/luafmt):

```
npm install @appguru/luafmt
```

And import it like this:

```javascript
const { formatChunk } = require("@appguru/luafmt");
```

#### `formatChunk(text)`

Takes a Lua chunk (think file / function body) as string and returns a formatted version, also as string.

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