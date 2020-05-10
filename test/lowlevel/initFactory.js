/* eslint-env mocha */

import { List } from 'immutable'
import chai from 'chai'
import dirtyChai from 'dirty-chai'

import initFactory from '../../src/lowlevel/initFactory'
import { isExonumFactory } from '../../src/lowlevel/common'
import { uinteger } from '../../src/lowlevel/integers'

const expect = chai
  .use(dirtyChai)
  .expect

describe('initFactory', () => {
  it('should return a function recognized as a factory', () => {
    function someFactory (arg, resolver) {
    }

    const factory = initFactory(someFactory)
    expect(factory).to.be.a('function')
    expect(factory).to.satisfy(isExonumFactory)
  })

  it('should fill in meta information for the factory', () => {
    function someFactory (arg, resolver) {
    }

    const factory = initFactory(someFactory)
    expect(factory.name).to.equal('someFactory')
    expect(factory.prepare).to.be.a('function')
    expect(factory.argumentMeta).to.be.a('function')
    expect(factory.typeName).to.be.a('function')
    expect(factory.typeTag).to.be.a('function')
  })

  it('should override factory name if supplied', () => {
    function someFactory (arg, resolver) {
    }

    const factory = initFactory(someFactory, { name: 'foo' })
    expect(factory.name).to.equal('foo')
  })

  it('should call to the supplied function and transform arguments', (done) => {
    function someFactory (arg, resolver) {
      expect(arg).to.equal('bar')
      done()
    }

    const factory = initFactory(someFactory, {
      prepare (arg) {
        expect(arg).to.equal('foo')
        return 'bar'
      }
    })

    factory('foo')
  })

  it('should inherit properties from other factory', (done) => {
    const factory = initFactory(function factory (arg) {
      expect(arg).to.equal(5)
      done()
    }, {
      prepare (arg) {
        return arg + 1
      }
    })

    const otherFactory = initFactory(function (arg) {
      expect(arg).to.equal(4)
      return factory(arg)
    }, factory)

    expect(otherFactory.name).to.equal('factory')
    otherFactory(3)
  })

  it('should define typeTag for the generated types', () => {
    const factory = initFactory(function factory (arg) {
      return uinteger(arg)
    })

    const Type = factory(3)
    expect(Type.typeTag().equals(List.of('factory', 3))).to.be.true()
  })

  it('should allow to override typeTag', () => {
    const factory = initFactory(function factory (arg) {
      return uinteger(arg)
    }, {
      typeTag (arg) { return arg * 2 }
    })

    const Type = factory(3)
    expect(Type.typeTag().equals(List.of('factory', 6))).to.be.true()
  })

  it('should define type names for the constructed types', () => {
    const factory = initFactory(function factory (arg) {
      return uinteger(arg)
    })

    expect(factory(3).toString()).to.equal('factory<3>')
    expect(factory(3).inspect()).to.equal('factory<3>')
  })
})
