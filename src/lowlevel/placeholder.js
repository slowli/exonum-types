import EventEmitter from 'events'

import { createType, getKind } from './common'

export function isPlaceholder (maybePlaceholder) {
  return getKind(maybePlaceholder) === 'placeholder'
}

export default function placeholder () {
  const emitter = new EventEmitter()

  class Placeholder extends createType({
    name: 'Placeholder',
    typeLength: undefined,
    kind: 'placeholder'
  }) {
    static replaceBy (type) {
      this.emit('replace', type)
    }

    constructor () {
      super()
      throw new Error('Placeholders should be replaced with real types')
    }
  }

  const proxiedMethods = [
    'on',
    'emit'
  ]
  proxiedMethods.forEach(method => {
    Placeholder[method] = emitter[method].bind(emitter)
  })

  return Placeholder
}
