import std from './std'
import message from './message'
import extendBits256 from './Bits256'
import blockchainDefs from './blockchain.json'

const resolver = std.resolver
  .addFactories({ message })
  .add(blockchainDefs)
  .extend('Bits256', extendBits256)

const types = resolver.namedTypes().toObject()
types.resolver = resolver
types.resolve = resolver.resolve.bind(resolver)

resolver.namedFactories().forEach((factory, fName) => {
  types[fName] = factory
})

export default types
