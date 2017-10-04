import union from './union'
import None from './None'
import initFactory from './initFactory'

function option (Type, resolver) {
  const spec = [
    { name: 'none', type: None },
    { name: 'some', type: Type }
  ]

  return class extends union(spec, resolver) {
    constructor (obj) {
      if (obj === null || obj === undefined) {
        obj = { none: null }
      } else {
        obj = { some: obj }
      }
      super(obj)
    }

    toJSON () {
      return this.type === 'none' ? null : this.getOriginal('some').toJSON()
    }
  }
}

export default initFactory(option, {
  name: 'Option',

  prepare (Type, resolver) {
    return resolver.resolve(Type)
  }
})
