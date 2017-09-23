import std from './std'
import message from './message'

import blockchainDefs from './blockchain.json'

const resolver = std.resolver
  .addFactories({ message })
  .add(blockchainDefs)

const types = resolver.namedTypes().toObject()
types.resolver = resolver
types.resolve = resolver.resolve.bind(resolver)

resolver.namedFactories().forEach((factory, fName) => {
  types[fName] = factory
})

export default types
