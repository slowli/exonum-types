import { OrderedMap } from 'immutable'

import { memoize, rawValue, setRawValue } from './lowlevel/common'
import { resolver as stdResolver } from './std'
import { hash } from './crypto'

const LIST_VIEW_NODE_DEF = {
  name: 'ListViewNode',
  union: [
    {
      name: 'branch',
      type: {
        struct: [
          { name: 'left', type: 'ListViewNode' },
          { name: 'right', type: 'ListViewNode' }
        ]
      }
    },
    { name: 'stub', type: 'ListViewNode' },
    { name: 'hash', type: 'Hash' },
    { name: 'val', type: 'T' }
  ]
}

/**
 * Creates a `ListViewNode<ValType>` for a specific type of values.
 */
function listViewNode (ValType, resolver) {
  // XXX: works only with "native" type definitions
  return stdResolver.addNativeType('T', ValType)
    .addTypes([
      LIST_VIEW_NODE_DEF
    ]).resolve('ListViewNode')
}

function parseTreeStructure (tree) {
  const nodes = []
  const leaves = []

  /**
   * Recursively walks the tree from root to leaves.
   *
   * @param {number} level 0-based tree level, counting from the root
   * @param {number} pos 0-based position of the current node on the current level
   */
  function walkTree (node, level = 0, pos = 0) {
    node.level = level
    node.pos = pos
    nodes.push(node)

    switch (node.type) {
      case 'val':
      case 'hash':
        leaves.push(node)
        break
      case 'branch':
        const { left, right } = node.branch

        walkTree(left, level + 1, 2 * pos)
        walkTree(right, level + 1, 2 * pos + 1)
        break
      case 'stub':
        walkTree(node.stub, level + 1, 2 * pos)
        break
    }
  }

  walkTree(tree)

  const levels = leaves.map(node => node.level)
  const depth = Math.max.apply(null, levels)
  const values = leaves.filter(node => node.type === 'val')

  // All values must be on the same level
  // All hashes must not exceed this level
  if (
    !values.every(node => node.level === depth)
  ) {
    throw new Error('Invalid value / hash height')
  }

  // All `stub`s must be right children of their parents
  if (
    nodes.filter(node => node.type === 'branch')
      .some(({ branch }) => branch.left.type === 'stub')
  ) {
    throw new TypeError('Stub node being the left child of parent')
  }

  return { depth, nodes, leaves, values }
}

/**
 * Recursively calculates the hash of the entire `ListView`.
 *
 * @param {ListViewNode<any>} node
 * @returns {Hash}
 */
function treeHash (node) {
  switch (node.type) {
    case 'hash':
      return node.hash
    case 'val':
      return hash(node.val)
    case 'branch':
      return hash(treeHash(node.branch.left), treeHash(node.branch.right))
    case 'stub':
      return hash(treeHash(node.stub))
  }
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

export default function listView (ValType, resolver) {
  const Node = listViewNode(ValType, resolver)

  const ListView = class {
    constructor (obj) {
      const root = Node.from(obj)
      const { depth, values } = parseTreeStructure(root)

      // Guaranteed to be sorted by ascending `node.pos`
      // XXX: This loses original Exonum-typed values. Suppose this is OK?
      const map = OrderedMap(values.map(node => [node.pos, node.val]))

      setRawValue(this, { map, root, depth })
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
