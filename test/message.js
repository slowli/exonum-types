/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import * as crypto from '../src/crypto'
import types from '../src/std'
import { isExonumType } from '../src/lowlevel/common'

import blockData from './data/block.json'

const { PublicKey, Precommit } = types

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

describe('Message', () => {
  const TxTransfer = types.resolve({
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

  const TxCreate = types.resolve({
    message: {
      serviceId: 1,
      messageId: 129,
      body: [
        { name: 'from', type: 'PublicKey', author: true },
        { name: 'name', type: 'Str' }
      ]
    }
  })

  const ComplexMessage = types.resolve({
    message: {
      serviceId: 1,
      messageId: 130,
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

  const NonStructMessage = types.resolve({
    message: {
      serviceId: 1,
      messageId: 1001,
      body: { fixedBuffer: 4 }
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

      expect(msg.body).to.have.property('from')
      expect(msg.body.from).to.equalBytes(aliceKey.rawPub())
      expect(msg.body).to.have.property('to')
      expect(msg.body.to).to.equalBytes(bobKey.rawPub())
      expect(msg.body).to.have.property('amount')
      expect(msg.body.amount).to.equal(10000)
    })

    it('should construct a message using fromBody() method', () => {
      const msg = TxTransfer.fromBody({
        from: aliceKey.pub(),
        to: bobKey.pub(),
        amount: 10000
      })

      expect(msg.body).to.have.property('from')
      expect(msg.body.from).to.equalBytes(aliceKey.rawPub())
      expect(msg.body).to.have.property('to')
      expect(msg.body.to).to.equalBytes(bobKey.rawPub())
      expect(msg.body).to.have.property('amount')
      expect(msg.body.amount).to.equal(10000)
    })

    it('should construct a complex message', () => {
      const msg = new ComplexMessage({
        body: {
          from: aliceKey.pub(),
          foo: 'Hello',
          bar: [ 100, -200 ]
        }
      })

      expect(msg.body.from).to.equalBytes(aliceKey.rawPub())
      expect(msg.body.foo).to.equal('Hello')
      expect(msg.body.bar.x).to.equal(100)
      expect(msg.body.bar.y).to.equal(-200)
    })

    it('should construct a message with non-struct body', () => {
      const msg = NonStructMessage.fromBody('01234567')
      expect(msg.body).to.equalBytes('01234567')
    })
  })

  describe('typeLength', () => {
    it('should be computed correctly for fixed-length messages', () => {
      expect(TxTransfer.typeLength()).to.equal(10 + 72 + 64)
    })

    it('should be computed correctly for var-length messages', () => {
      expect(TxCreate.typeLength()).to.be.undefined()
    })
  })

  describe('meta', () => {
    it('should return correct meta for the message type', () => {
      expect(TxTransfer.meta().factoryName).to.equal('message')
      expect(TxTransfer.meta().messageId).to.equal(128)
      expect(TxTransfer.meta().body).to.satisfy(isExonumType)
      expect(TxTransfer.meta().body.meta().fields).to.be.an('array')
    })
  })

  describe('set', () => {
    it('should not allow to set readonly fields', () => {
      const msg = TxTransfer.fromBody({
        from: aliceKey.pub(),
        to: bobKey.pub(),
        amount: 10000
      })

      expect(() => msg.set('protocolVersion', 1)).to.throw(/Cannot set field/)
      expect(() => msg.set('networkId', 1)).to.throw(/Cannot set field/)
      expect(() => msg.set('messageId', 255)).to.throw(/Cannot set field/)
      expect(() => msg.set('serviceId', 255)).to.throw(/Cannot set field/)
    })

    it('should allow to set body', () => {
      const msg = TxTransfer.fromBody({
        from: aliceKey.pub(),
        to: bobKey.pub(),
        amount: 10000
      })
      let otherMsg = msg.set('body', msg.body.set('amount', 9000))

      expect(otherMsg).to.be.instanceof(TxTransfer)
      expect(otherMsg.body.amount).to.equal(9000)
    })
  })

  describe('serialize', () => {
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
        '92000000' // message length
      )

      expect(serialized.subarray(10, 10 + 32)).to.equalBytes(aliceKey.rawPub())
      expect(serialized.subarray(10 + 32, 10 + 64)).to.equalBytes(bobKey.rawPub())
      // hex represenation of `amount`
      expect(serialized.subarray(10 + 64, 10 + 72)).to.equalBytes('1027000000000000')

      expect(serialized.subarray(10 + 72)).to.equalBytes(msg.signature)
    })

    it('should implement quirky serialization of segments in message', () => {
      const msg = TxCreate.from({
        body: {
          from: aliceKey.pub(),
          name: 'Alice'
        }
      }).sign(aliceKey)

      const serialized = msg.serialize()

      // verify message header
      expect(serialized.subarray(0, 10)).to.equalBytes(
        '0000' + // networkId + protocolVersion
        '8100' + // messageId
        '0100' + // serviceId
        '77000000' // message length (10 + 45 + 64 = 119 = 0x77)
      )

      expect(serialized.subarray(10, 10 + 32)).to.equalBytes(aliceKey.rawPub())

      // The segment should be counter from the start of the *entire* message
      expect(serialized.subarray(10 + 32, 10 + 40)).to.equalBytes(
        '32000000' + // offset (50)
        '05000000' // length (5)
      )
      // The 'Alice' string
      expect(serialized.subarray(10 + 40, 10 + 45)).to.equalBytes('416c696365')

      expect(serialized.subarray(10 + 45)).to.equalBytes(msg.signature)
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
          amount: '10000'
        },
        signature: '0000000000000000000000000000000000000000000000000000000000000000' +
          '0000000000000000000000000000000000000000000000000000000000000000'
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
          amount: '10000'
        },
        signature: msg.getOriginal('signature').toJSON()
      })
    })

    it('should serialize non-struct message body', () => {
      const msg = NonStructMessage.fromBody('00112233')

      expect(msg.toJSON()).to.deep.equal({
        networkId: 0,
        protocolVersion: 0,
        serviceId: 1,
        messageId: 1001,
        body: '00112233',
        signature: '0000000000000000000000000000000000000000000000000000000000000000' +
          '0000000000000000000000000000000000000000000000000000000000000000'
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

      const json = msg.toJSON()
      delete json.signature

      expect(json).to.deep.equal({
        networkId: 0,
        protocolVersion: 0,
        serviceId: 1,
        messageId: 130,
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
          return validators[this.body.validator]
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

    it('should not verify message if the author field is undefined', () => {
      const msg = NonStructMessage.fromBody('ffffffff')
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
        body: msg.body.set('amount', 9999),
        signature: msg.signature
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
      const Msg = types.resolve({
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
