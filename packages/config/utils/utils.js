/**
 * @typedef {import('../../config').FlowJSONv1} FlowJSONv1
 */

/**
 * @typedef {import('../../config').FlowJSONv2} FlowJSONv2
 */

const pipe =
  (...funcs) =>
  v => {
    return funcs.reduce((res, func) => {
      return func(res)
    }, v)
  }

/**
 * Object check.
 * @param value
 * @returns {boolean}
 */
const isObject = value =>
  value && typeof value === "object" && !Array.isArray(value)

/**
 * Deep merge multiple objects.
 * @param {Object} target
 * @param {...Object[]} sources
 * @returns {Object}
 */
const mergeDeep = (target, ...sources) => {
  if (!sources.length) return target
  const source = sources.shift()

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, {[key]: {}})
        mergeDeep(target[key], source[key])
      } else {
        Object.assign(target, {[key]: source[key]})
      }
    }
  }

  return mergeDeep(target, ...sources)
}

/**
 * Support if/then/else behavior in a function way.
 * @param{function(Object): boolean} testFn
 * @param{function(Object): *} posCond - Function to run if testFn is true
 * @param{function(Object): *} negCond - Function to run it testFn is false
 * @returns {function(*): *}
 */
export const ifElse = (testFn, posCond, negCond) => obj =>
  testFn(obj) ? posCond(obj) : negCond(obj)

/**
 * Deep merge multiple Flow JSON.
 * @param {Object|Object[]} value
 * @returns {Object}
 */
const mergeFlowJSONs = value =>
  Array.isArray(value) ? mergeDeep({}, ...value) : value

/**
 * Filter out contracts section of flow.json.
 * @param {Object|Object[]} obj
 * @returns {Object}
 */
const filterContracts = obj => (obj.contracts ? obj.contracts : {})

/**
 * Gathers contract addresses by network
 * @param {string} network emulator, testnet, mainnet
 * @returns {Object} { "HelloWorld": "0x123" }
 */
const mapContractToNetworkAddress = network => contracts => {
  return Object.entries(contracts).reduce((c, [key, value]) => {
    const networkContractAlias = value?.aliases?.[network]
    if (networkContractAlias) {
      c[key] = networkContractAlias
    }

    return c
  }, {})
}

/**
 *
 * @param{string} network
 * @param{FlowJSONv2.accounts|FlowJSONv2.contracts} objectPossiblyKeyedByNetwork
 * @returns {Object} { "HelloWorld": "0x123" }
 */
const collapseByNetwork = (network, objectPossiblyKeyedByNetwork) => {
  const result = {}
  for (const [name, value] of Object.entries(objectPossiblyKeyedByNetwork)) {
    if (typeof value === "string") {
      result[name] = value
      continue
    }

    if (value[network]) {
      result[name] = value[network]
    }
  }

  return result
}

/**
 * @param{string} network
 * @returns {Object} { "HelloWorld": "0x123" }
 */
const resolveV2ContractAliases = network => flowJSON => {
  const collapsedAccounts = collapseByNetwork(network, flowJSON.accounts)
  const collapsedContracts = collapseByNetwork(network, flowJSON.contracts)

  const result = {}
  for (const [contractName, contractValue] of Object.entries(
    collapsedContracts
  )) {
    if (collapsedAccounts[contractValue]) {
      result[`contracts.${contractName}`] = collapsedAccounts[contractValue]
      continue
    }

    /**
     * For simplicity, will assume we have an emulator address if the alias
     * does not exist, and we are on the emulator network.
     */
    if (network === "emulator") {
      result[`contracts.${contractName}`] = contractValue
    }
  }

  return result
}

/**
 * Take in a flow.json and return true if the schema is v1
 * @param{FlowJSONv1|FlowJSONv2} obj
 * @returns{boolean}
 * @see https://github.com/onflow/flow-cli/issues/711
 */
const isFlowSchemaV1 = obj => {
  // Deployments only exists in v1
  if (obj.deployments) return true

  // Contracts only have aliases in v1
  for (const value of Object.values(obj.contracts)) {
    if (value.aliases) return true
  }

  return false
}

const prefixAddresses = (addresses = {}) => {
  const result = {}
  for (const [key, value] of Object.entries(addresses)) {
    result[`0x${key}`] = value
  }

  return result
}

/**
 * @param{string} network
 * @return {(function(FlowJSONv1))}
 */
const getContractsV1 = network =>
  pipe(filterContracts, mapContractToNetworkAddress(network), prefixAddresses)

/**
 * @param{string} network
 * @return {(function(FlowJSONv2))}
 */
const getContractsV2 = network => pipe(resolveV2ContractAliases(network))

/**
 * Take in flow.json files and return contract to address mapping by network
 * @param {Object|Object[]} jsons
 * @param {string} network emulator, testnet, mainnet
 * @returns {Object} { "HelloWorld": "0x123" }
 */
export const getContracts = (jsons, network) => {
  return pipe(
    mergeFlowJSONs,
    ifElse(isFlowSchemaV1, getContractsV1(network), getContractsV2(network))
  )(jsons)
}

/**
 * Checks flow.json file for private keys
 * @param {Object} flowJSON
 * @returns {boolean}
 */
const hasPrivateKeys = flowJSON => {
  return Object.entries(flowJSON?.accounts).reduce(
    (hasPrivateKey, [key, value]) => {
      if (hasPrivateKey) return true
      return value?.hasOwnProperty("key")
    },
    false
  )
}

/**
 * Take in flow.json or array of flow.json files and checks for private keys
 * @param {Object|Object[]} value
 * @returns {boolean}
 */
export const anyHasPrivateKeys = value => {
  if (isObject(value)) return hasPrivateKeys(value)
  return value.some(hasPrivateKeys)
}

/**
 * Format network to always be 'emulator', 'testnet', or 'mainnet'
 * @param {string} network 'local', 'emulator', 'testnet', 'mainnet'
 * @returns {string} 'emulator', 'testnet', 'mainnet'
 */
export const cleanNetwork = network =>
  network?.toLowerCase() === "local" ? "emulator" : network?.toLowerCase()
