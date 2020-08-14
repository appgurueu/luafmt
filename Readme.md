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

Install the NPM package [luafmt](https://npmjs.com/packages/appguru/luafmt):

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