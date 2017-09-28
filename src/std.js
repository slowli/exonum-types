// Primitive types
import Str from './lowlevel/Str'
import Bool from './lowlevel/Bool'
import None from './lowlevel/None'

// Factories
import array from './lowlevel/array'
import fixedBuffer from './lowlevel/fixedBuffer'
import { integer, uinteger } from './lowlevel/integers'
import option from './lowlevel/option'
import struct from './lowlevel/struct'
import union from './lowlevel/union'
import message from './message'
import listView from './listView'
import mapView from './mapView'

// Resolver and type extensions
import TypeResolver from './lowlevel/TypeResolver'
import extendBits256 from './Bits256'

import rawDefinitions from './std.json'
// TODO: `Option` can be expressed as a factory

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
    enum: union,
    message,
    listView,
    mapView
  })
  .add(rawDefinitions)
  .extend('Bits256', extendBits256)

const types = resolver.namedTypes().toObject()
types.resolver = resolver
types.resolve = resolver.resolve.bind(resolver)

resolver.namedFactories().forEach((factory, fName) => {
  types[fName] = factory
})

export default types
