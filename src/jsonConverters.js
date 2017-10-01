/**
 * Tags the variants in JSON represenation of `ListView` based on its structure.
 * The JSON is transformed in place and then returned.
 */
export function convertListJSON (json) {
  function convertChild (json, child) {
    if (typeof json[child] === 'string') {
      json[child] = { hash: json[child] }
    } else {
      convertListJSON(json[child])
    }
  }

  if (('left' in json) && ('right' in json)) {
    json.branch = {
      left: json.left,
      right: json.right
    }
    delete json.left
    delete json.right
    convertChild(json.branch, 'left')
    convertChild(json.branch, 'right')
  } else if ('left' in json) {
    json.stub = json.left
    delete json.left
    convertChild(json, 'stub')
  } else if ('val' in json) {
    // value
  } else {
    throw new TypeError('Invalid list JSON')
  }

  return json
}

/**
 * Tags the variants in JSON represenation of `ListView` based on its structure.
 * The JSON is transformed in place and then returned.
 */
function convertTreeJSON (json) {
  function convertChild (json, child) {
    if (typeof json[child] === 'string') {
      json[child] = { hash: json[child] }
    } else {
      convertTreeJSON(json[child])
    }
  }

  if ('val' in json) {
    // Value
  } else if (Object.keys(json).length === 2) {
    // Branch
    const { 0: leftKey, 1: rightKey } = Object.keys(json).sort()
    json.branch = {
      leftKey,
      rightKey,
      left: json[leftKey],
      right: json[rightKey]
    }
    delete json[leftKey]
    delete json[rightKey]
    convertChild(json.branch, 'left')
    convertChild(json.branch, 'right')
  } else {
    throw new TypeError('Invalid proof node')
  }

  return json
}

export function convertMapJSON (json) {
  if (typeof json !== 'object') {
    throw new TypeError('Invalid JSON for MapView; object expected')
  }

  const props = Object.keys(json)
  switch (props.length) {
    case 0:
      return null
    case 1:
      return {
        key: props[0],
        value: typeof json[props[0]] === 'string' ? { hash: json[props[0]] } : json[props[0]]
      }
    case 2:
      return convertTreeJSON(json)
    default:
      throw new TypeError('Invalid JSON for MapView; object with <=2 properties expected')
  }
}
