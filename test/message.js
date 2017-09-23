/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import * as crypto from '../src/crypto'
import { resolver } from '../src/std'
import message from '../src/message'
import types from '../src/blockchain'

import blockData from './data/block.json'

const { PublicKey, Precommit } = types

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

const _resolver = resolver.addFactory('message', message)
const createType = _resolver.resolve.bind(_resolver)

describe('Message', () => {
  const TxTransfer = createType({
    message: {
      serviceId: 1,
      messageId: 128,
      body: [
        { name: 'from', type: 'PublicKey', author: true },
        { name: 'to', type: 'PublicKey' },
        { name: 'amount', type: 'Uint64' }
      ]
    }
  })

  // XXX: remove when meta for struct fields is implemented
  TxTransfer.prototype.author = function () {
    return this.body().from
  }

  const ComplexMessage = createType({
    message: {
      serviceId: 1,
      messageId: 129,
      body: [
        { name: 'from', type: 'PublicKey', author: true },
        { name: 'foo', type: 'Str' },
        {
          name: 'bar',
          type: {
            struct: [
              { name: 'x', type: 'Int32' },
              { name: 'y', type: 'Int32' }
            ]
          }
        }
      ]
    }
  })

  const aliceKey = crypto.randomKey()
  const bobKey = crypto.randomKey()

  describe('constructor', () => {
    it('should construct a message', () => {
      const msg = new TxTransfer({
        body: {
          from: aliceKey.pub(),
          to: bobKey.pub(),
          amount: 10000
        }
      })
      const body = msg.body()

      expect(body).to.have.property('from')
      expect(body.from).to.equalBytes(aliceKey.rawPub())
      expect(body).to.have.property('to')
      expect(body.to).to.equalBytes(bobKey.rawPub())
      expect(body).to.have.property('amount')
      expect(body.amount).to.equal(10000)
    })

    it('should construct a complex message', () => {
      const msg = new ComplexMessage({
        body: {
          from: aliceKey.pub(),
          foo: 'Hello',
          bar: [ 100, -200 ]
        }
      })
      const body = msg.body()

      expect(body.from).to.equalBytes(aliceKey.rawPub())
      expect(body.foo).to.equal('Hello')
      expect(body.bar.x).to.equal(100)
      expect(body.bar.y).to.equal(-200)
    })
  })

  describe('typeLength', () => {
    it('should be computed correctly', () => {
      expect(TxTransfer.typeLength()).to.equal(10 + 72 + 64)
    })
  })

  describe('bodyLength', () => {
    const msg = new TxTransfer({
      body: {
        from: aliceKey.pub(),
        to: bobKey.pub(),
        amount: 10000
      }
    })

    it('should be computed correctly', () => {
      expect(msg.bodyLength()).to.equal(72)
    })
  })

  describe('serialize', () => {
    it('should not serialize unsigned message', () => {
      const msg = new TxTransfer({
        body: {
          from: aliceKey.pub(),
          to: bobKey.pub(),
          amount: 10000
        }
      })

      expect(() => msg.serialize()).to.throw(/unsigned/i)
    })

    it('should serialize message', () => {
      const msg = new TxTransfer({
        body: {
          from: aliceKey.pub(),
          to: bobKey.pub(),
          amount: 10000
        }
      }).sign(aliceKey)

      const serialized = msg.serialize()

      // verify message header
      expect(serialized.subarray(0, 10)).to.equalBytes(
        '0000' + // networkId + protocolVersion
        '8000' + // messageId
        '0100' + // serviceId
        '92000000' // messagee length
      )

      expect(serialized.subarray(10, 10 + 32)).to.equalBytes(aliceKey.rawPub())
      expect(serialized.subarray(10 + 32, 10 + 64)).to.equalBytes(bobKey.rawPub())
      // hex represenation of `amount`
      expect(serialized.subarray(10 + 64, 10 + 72)).to.equalBytes('1027000000000000')

      expect(serialized.subarray(10 + 72)).to.equalBytes(msg.signature().serialize())
    })
  })

  describe('toJSON', () => {
    it('should convert message to standard form', () => {
      const msg = new TxTransfer({
        body: {
          from: aliceKey.pub(),
          to: bobKey.pub(),
          amount: 10000
        }
      })

      expect(msg.toJSON()).to.deep.equal({
        networkId: 0,
        protocolVersion: 0,
        serviceId: 1,
        messageId: 128,
        body: {
          from: aliceKey.pub().toJSON(), // string
          to: bobKey.pub().toJSON(),
          amount: 10000
        }
      })
    })

    it('should serialize signature', () => {
      const msg = new TxTransfer({
        body: {
          from: aliceKey.pub(),
          to: bobKey.pub(),
          amount: 10000
        }
      }).sign(aliceKey)

      expect(msg.toJSON()).to.deep.equal({
        networkId: 0,
        protocolVersion: 0,
        serviceId: 1,
        messageId: 128,
        body: {
          from: aliceKey.pub().toJSON(), // string
          to: bobKey.pub().toJSON(),
          amount: 10000
        },
        signature: msg.signature().toJSON()
      })
    })

    it('should convert complex message to standard form', () => {
      const msg = new ComplexMessage({
        body: {
          from: aliceKey.pub(),
          foo: 'Hello',
          bar: [ 100, -200 ]
        }
      })

      expect(msg.toJSON()).to.deep.equal({
        networkId: 0,
        protocolVersion: 0,
        serviceId: 1,
        messageId: 129,
        body: {
          from: aliceKey.pub().toJSON(), // string
          foo: 'Hello',
          bar: {
            x: 100, y: -200
          }
        }
      })
    })
  })

  describe('verify', () => {
    const validators = blockData.validators.map(raw => PublicKey.from(raw))

    it('should verify Precommit messages', () => {
      blockData.precommits.forEach(data => {
        const precommit = Precommit.from(data)

        precommit.author = function () {
          return validators[this.body().validator]
        }

        expect(precommit.verify()).to.be.true()
      })
    })

    it('should not verify an unsigned message', () => {
      const msg = new TxTransfer({
        body: {
          from: aliceKey.pub(),
          to: bobKey.pub(),
          amount: 10000
        }
      })

      expect(msg.verify()).to.be.false()
    })

    it('should not verify an incorrectly signed message', () => {
      let msg = new TxTransfer({
        body: {
          from: aliceKey.pub(),
          to: bobKey.pub(),
          amount: 10000
        }
      }).sign(aliceKey)

      // Mutate the body of the message to invalidate the signature
      msg = new TxTransfer({
        body: msg.body().set('amount', 9999),
        signature: msg.signature()
      })
      expect(msg.verify()).to.be.false()
    })

    it('should verify previously signed message', () => {
      const msg = new TxTransfer({
        body: {
          from: aliceKey.pub(),
          to: bobKey.pub(),
          amount: 10000
        }
      }).sign(aliceKey)

      expect(msg.verify()).to.be.true()
    })
  })

  describe('toString', () => {
    it('should return descriptive content for the message', () => {
      const Msg = createType({
        message: {
          serviceId: 1,
          messageId: 0,
          body: {
            struct: [
              { name: 'foo', type: { fixedBuffer: 4 } },
              { name: 'bar', type: 'Uint8' }
            ]
          }
        }
      })

      const msg = Msg.from({ body: { foo: '01020304', bar: 254 } })
      expect(msg.toString()).to.equal('Message:{ foo: Buffer(01020304), bar: 254 }')
    })
  })
})
