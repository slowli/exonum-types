import Str from './lowlevel/Str'
import Bool from './lowlevel/Bool'
import None from './lowlevel/None'
import array from './lowlevel/array'
import fixedBuffer from './lowlevel/fixedBuffer'
import { integer, uinteger } from './lowlevel/integers'
import option from './lowlevel/option'
import struct from './lowlevel/struct'
import union from './lowlevel/union'
import TypeResolver from './lowlevel/TypeResolver'

import rawDefinitions from './std.json'
// TODO: `Option` can be expressed in definitions.json

export const resolver = new TypeResolver()
  .addNativeTypes({ Str, Bool, None })
  .addFactories({
    array,
    integer,
    uinteger,
    fixedBuffer,
    buffer: fixedBuffer,
    option,
    struct,
    union,
    enum: union
  })
  .add(rawDefinitions)

const types = resolver.namedTypes().toObject()
types.resolver = resolver
types.resolve = resolver.resolve.bind(resolver)

resolver.namedFactories().forEach((factory, fName) => {
  types[fName] = factory
})

export default types
