# Exonum Serialization for JavaScript

This is the alternative/experimental JavaScript implementation of the type system for
the [Exonum][exonum] framework. It provides a library of standard types
and the ability to define new types (including generic types).

Each Exonum type can be serialized to and deserialized from JSON, and also serialized
into the binary format (but not deserialized from it for the moment).
There are also special types, such as `ListView<E>` and `MapView<K, V>`,
which implement views of Merkelized lists and maps, respectively.

**WORK IN PROGRESS. PLEASE DO NOT USE IN PRODUCTION.**
See [`exonum-client`][exonum-client] for the current stable implementation.

## Example

```javascript
import * as exonum from 'exonum-types'
```

First, define some new types. This one defines a structure with 2 fields,
both of which are 32-bit unsigned integers.

```javascript
const Point = exonum.resolve({
  struct: [
    { name: 'x', type: 'Uint32' },
    { name: 'y', type: 'Uint32' }
  ]
})
```

Now, it's possible to create type instances:

```javascript
const a = new Point({ x: 3, y: 4 })
const b = Point.from([10, 20])
const c = a.set('x', 9)
```

All instances of Exonum types are [immutable and persistent][immutable].

It is possible to define types with a complex inner structure:

```javascript
const WeightedPoints = exonum.resolve({
  array: {
    struct: [
      { name: 'point', type: Point },
      { name: 'weight', type: 'Uint64' }
    ]
  }
})

const wPoints = WeightedPoints.from([
  { point: [1, 2], weight: 555 },
  { point: [7, 8], weight: 1000000000 },
])

console.log(wPoints.get(0).x)
```

Usually, the created datatypes are used in context of cryptographic operations.
For example, it is possible to calculate the hash of an Exonum-typed data
with `crypto.hash()` and sign it using `crypto.sign()`:

```javascript
const { hash, sign, randomKey } = exonum.crypto

console.log(hash(wPoints)) // outputs a SHA-256 hash of the binary serialization

// Ed25519 private key
const secretKey = randomKey()
// 64-byte Ed25519 signature over `wPoints`
const signature = sign(wPoints, secretKey)
// Check that the signature is verifiable
console.log(verify(wPoints, signature, secretKey.pub()))
```

Another use case is verifying *proofs* sent to an Exonum lightweight client
from the full node. This library provides `listView` and `mapView` factories to do that.

## Usage

All Exonum types have a common basic interface, which could be expressed
in the [Flow][flow] notation as

```javascript
interface ExonumType {
  static typeLength(): number | void,
  static from(json: any): this,
  constructor(json: any),
  byteLength(): number,
  serialize(buffer?: Uint8Array): Uint8Array,
  toJSON(): any
}
```

Here, `from()` and constructor are used to create type instances from JSON;
`toJSON()` performs the opposite transformation; and the remaining methods
are used for binary serialization.

### Primitive Types

#### Integers

Similar to Rust, there are eight built-in primitive types:
`Uint8`, `Int8`, `Uint16`, `Int16`, `Uint32`, `Int32`, `Uint64`, `Int64`.
More types can be created with `uinteger` and `integer` factories.

**Binary serialization:** little-endian.  
**JSON:** number or string iff the underlying number exceeds the bound on safe
JS integers.

#### Str

`Str` represents a string.

**Binary serialization:** UTF-8.  
**JSON:** string.

#### Bool

`Bool` is a boolean type.

**Binary serialization:** single byte; `0` for false, `1` for true.  
**JSON:** boolean.

### Factories

*Factories* fulfill the same role as generic types in other languages. For example,
`uinteger(6)` creates a new unsigned integer type occupying 6 bytes. In the type
specification, factories can be specified in the form `{ uinteger: 6 }`.

- `fixedBuffer`
- `integer`, `uinteger`
- `array`
- `struct`
- `union`
- `option`
- `message`

### Type Resolver

Use `resolve()` to create new types using existing types from the standard library,
like in the example above. For more complex operations, you may use `resolver`;
it allows to parse sequential type definitions (including recursive and cross-recursive)
fully specified in JSON.

spec.json
```json
[
  {
    "name": "Point",
    "type": {
      "struct": [
        { "name": "x", "type": "Uint32" },
        { "name": "y", "type": "Uint32" }
      ]
    }
  },
  {
    "name": "List",
    "option": {
      "struct": [
        { "name": "head", "type": "Point" },
        { "name": "tail", "type": "List" }
      ]
    }
  }
]
```

spec.js
```javascript
import defs from './spec.json'

const myResolver = exonum.resolver.addTypes(defs)
// `myResolver` now knows about `Point` and `List` types:
const List = myResolver.resolve('List')
const lst = List.from([[1, 2], [{ x: 3, y: 4 }, null]])
```

## License

Available under the [Apache-2.0 license](LICENSE).

[exonum]: https://exonum.com/
[exonum-client]: https://github.com/exonum/exonum-client
[flow]: http://flow.org/
[immutable]: http://facebook.github.io/immutable-js/docs/#/
