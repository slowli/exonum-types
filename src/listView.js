import { OrderedMap } from 'immutable'

import { memoize, rawValue, createType } from './lowlevel/common'
import initFactory from './lowlevel/initFactory'
import { hash } from './crypto'

function parseTreeStructure (tree) {
  const nodes = []

  function pushNode (node, level, pos) {
    node.level = level
    node.pos = pos
    nodes.push(node)
  }

  nodes.push(tree)
  tree.level = 0
  tree.pos = 0

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]

    node.match({
      branch: ({left, right}) => {
        pushNode(left, node.level + 1, 2 * node.pos)
        pushNode(right, node.level + 1, 2 * node.pos + 1)
      },
      stub: (stub) => {
        pushNode(stub, node.level + 1, 2 * node.pos)
      }
    })
  }

  const levels = nodes.map(node => node.level)
  const depth = Math.max.apply(null, levels)
  const values = nodes.filter(node => node.type === 'val')

  // All values must be on the same level
  // All hashes must not exceed this level
  if (!values.every(node => node.level === depth)) {
    throw new Error('Invalid value / hash height')
  }

  // All `stub`s must be right children of their parents
  if (
    nodes.filter(node => node.type === 'branch')
      .some(({ branch }) => branch.left.type === 'stub')
  ) {
    throw new TypeError('Stub node being the left child of parent')
  }

  return { depth, nodes, values }
}

/**
 * Recursively calculates the hash of the entire `ListView`.
 *
 * @param {ListViewNode<any>} node
 * @returns {Hash}
 */
function treeHash (node) {
  return node.match({
    hash: (h) => h,
    val: (val) => hash(val),
    branch: ({left, right}) => hash(treeHash(left), treeHash(right)),
    stub: (stub) => hash(treeHash(stub))
  })
}

// Methods proxied from `OrderedMap` to `ListView`
const PROXIED_METHODS = [
  'get',
  'count',
  'keys',
  'values',
  'entries',
  'keySeq',
  'valueSeq',
  'entrySeq'
]

function listView (ValType, resolver) {
  const ProofNode = resolver.resolve({ ListProofNode: ValType })

  class ListView extends createType({
    name: `ListView<${ValType.inspect()}>`
  }) {
    constructor (obj) {
      const root = ProofNode.from(obj)
      const { depth, values } = parseTreeStructure(root)

      // Guaranteed to be sorted by ascending `node.pos`
      // XXX: This loses original Exonum-typed values. Suppose this is OK?
      const map = OrderedMap(values.map(node => [node.pos, node.val]))

      super({ map, root, depth })
    }

    rootHash () {
      return treeHash(rawValue(this).root)
    }

    depth () {
      return rawValue(this).depth
    }
  }

  ListView.prototype.rootHash = memoize(ListView.prototype.rootHash)

  PROXIED_METHODS.forEach(methodName => {
    ListView.prototype[methodName] = function () {
      const map = rawValue(this).map
      return map[methodName].apply(map, arguments)
    }
  })

  return ListView
}

export default initFactory(listView, {
  name: 'listView',

  prepare (Type, resolver) {
    return resolver.resolve(Type)
  }
})
