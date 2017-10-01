/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'
import nacl from 'tweetnacl'

import fixedBuffer from '../src/lowlevel/fixedBuffer'
import std from '../src/std'
import { hash, sign, verify, secret } from '../src/crypto'
import { isExonumObject } from '../src/lowlevel/common'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

const { Signature, PublicKey } = std

const SequenceType = std.resolve({
  struct: [
    { name: 'foo', type: { buffer: 4 } },
    { name: 'bar', type: 'Uint32' }
  ]
})

const Wallet = std.resolve({
  struct: [
    { name: 'pubkey', type: 'PublicKey' },
    { name: 'name', type: 'Str' },
    { name: 'balance', type: 'Uint64' },
    { name: 'history_hash', type: 'Hash' }
  ]
})

describe('hash', () => {
  it('should calculate hash correctly for raw Uint8Array', () => {
    const buffer = Uint8Array.of(0xde, 0xad, 0xbe, 0xef, 0x2b, 0x02, 0x00, 0x00)
    expect(hash(buffer)).to.equalBytes(
      '739b3099b5fb4f2d51d02404e3e4383be880e16e2c2f1656a97ca27971777003')
  })

  it('should calculate hash correctly for buffer type', () => {
    const buffer = new (fixedBuffer(8))('deadbeef2b020000')
    expect(hash(buffer)).to.equalBytes(
      '739b3099b5fb4f2d51d02404e3e4383be880e16e2c2f1656a97ca27971777003')
  })

  it('should calculate hash correctly for complex type', () => {
    const x = new SequenceType(['deadbeef', 555])
    // SHA256(0xdeadbeef2b020000)
    expect(hash(x)).to.equalBytes(
      '739b3099b5fb4f2d51d02404e3e4383be880e16e2c2f1656a97ca27971777003')
  })

  it('should calculate hash correctly for multiple fragments', () => {
    const digest = hash(fixedBuffer(4).from('deadbeef'), Uint8Array.of(0x2b, 0x02, 0, 0))
    expect(digest).to.equalBytes(
      '739b3099b5fb4f2d51d02404e3e4383be880e16e2c2f1656a97ca27971777003')
  })

  it('should calculate hash correctly for wallet type', () => {
    const wallet = new Wallet({
      pubkey: 'f5864ab6a5a2190666b47c676bcf15a1f2f07703c5bcafb5749aa735ce8b7c36',
      name: 'Smart wallet',
      balance: 359120,
      history_hash: '6752BE882314F5BBBC9A6AF2AE634FC07038584A4A77510EA5ECED45F54DC030'
    })
    expect(hash(wallet)).to.equalBytes(
      '86b47510fbcbc83f9926d8898a57c53662518c97502625a6d131842f2003f974')
  })

  it('should fail on invalid argument', () => {
    expect(() => hash({ foo: 'bar' })).to.throw(/invalid argument/i)
  })

  it('should fail on a combination of valid and invalid arguments', () => {
    expect(() => hash(new Uint8Array(8), { foo: 'bar' })).to.throw(/invalid argument/i)
  })
})

describe('sign', () => {
  it('should sign a raw byte buffer', () => {
    const message = new Uint8Array(8)
    const { secretKey: sk, publicKey: pk } = nacl.sign.keyPair()
    const signature = sign(message, sk)

    expect(signature).to.be.a('Uint8Array').with.lengthOf(64)
    expect(nacl.sign.detached.verify(message, signature, pk)).to.be.true()
  })

  it('should sign an Exonum-typed object', () => {
    const message = SequenceType.from(['00000000', 1])
    const { secretKey: sk, publicKey: pk } = nacl.sign.keyPair()
    const signature = sign(message, sk)

    expect(signature).to.be.a('uint8array').with.lengthOf(64)
    expect(nacl.sign.detached.verify(new Uint8Array([0, 0, 0, 0, 1, 0, 0, 0]),
      signature, pk)).to.be.true()
  })
})

describe('verify', () => {
  const message = new Uint8Array(8)
  const exMessage = SequenceType.from(['00000000', 0])
  const { secretKey: sk, publicKey: pk } = nacl.sign.keyPair()
  const signature = sign(message, sk)

  it('should verify a raw byte buffer against a raw signature and pubkey', () => {
    expect(verify(message, signature, pk)).to.be.true()
  })

  it('should verify an Exonum object against a raw signature and pubkey', () => {
    expect(verify(exMessage, signature, pk)).to.be.true()
  })

  it('should verify an Exonum object against Exonum signature and pubkey', () => {
    expect(verify(exMessage, Signature.from(signature), PublicKey.from(pk))).to.be.true()
  })
})

describe('secret', () => {
  it('should generate a keypair', () => {
    const key = secret()
    expect(key).to.be.a('uint8array')
    expect(key.pub()).to.satisfy(isExonumObject)
    expect(key.rawPub()).to.be.a('uint8array')
  })

  it('should generate a new key each time', () => {
    const [keyA, keyB] = [secret(), secret()]
    expect(keyA).to.not.equalBytes(keyB)
    expect(keyA.pub().equals(keyB.pub())).to.be.false()
  })
})

describe('secret.fromSeed', () => {
  it('should work for 32-byte seeds', () => {
    const h = hash(std.Str.from('correct horse battery staple'))
    const key = secret.fromSeed(h)
    expect(key).to.be.a('uint8array')
    expect(key.pub()).to.satisfy(isExonumObject)
    expect(key.rawPub()).to.be.a('uint8array')
    expect(key.subarray(0, 32)).to.equalBytes(h)
  })
})
