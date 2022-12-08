import {isTransaction, isScript, get} from "../interaction/interaction.js"
import {invariant} from "@onflow/util-invariant"
import {config} from "@onflow/config"
import * as logger from "@onflow/util-logger"

const isFn = v => typeof v === "function"
const isString = v => typeof v === "string"

const accountIdentifierPattern = /\b(0x\w+)\b/g
function isAccountIdentifierSyntax(cadence) {
  return accountIdentifierPattern.test(cadence)
}

const contractIdentifierPatternFn = () => /import\s+"(\w+)"/g
export function isContractIdentifierSyntax(cadence) {
  return contractIdentifierPatternFn().test(cadence)
}

function getContractIdentifierSyntaxMatches(cadence) {
  return cadence.matchAll(contractIdentifierPatternFn())
}

export async function resolveCadence(ix) {
  if (!isTransaction(ix) && !isScript(ix)) return ix

  var cadence = get(ix, "ix.cadence")

  invariant(
    isFn(cadence) || isString(cadence),
    "Cadence needs to be a function or a string."
  )
  if (isFn(cadence)) cadence = await cadence({})
  invariant(isString(cadence), "Cadence needs to be a string at this point.")
  invariant(
    !isAccountIdentifierSyntax(cadence) || !isContractIdentifierSyntax(cadence),
    "Both account identifier and contract identifier syntax not simultaneously supported."
  )
  if (isAccountIdentifierSyntax(cadence)) {
    cadence = await config()
      .where(/^0x/)
      .then(d =>
        Object.entries(d).reduce((cadence, [key, value]) => {
          const regex = new RegExp("(\\b" + key + "\\b)", "g")
          return cadence.replace(regex, value)
        }, cadence)
      )
  }

  if (isContractIdentifierSyntax(cadence)) {
    for (const [fullMatch, contractName] of getContractIdentifierSyntaxMatches(
      cadence
    )) {
      const address = await config().get(`contracts.${contractName}`)
      if (address) {
        cadence = cadence.replace(
          fullMatch,
          `import ${contractName} from ${address}`
        )
      } else {
        logger.log({
          title: "Contract Placeholder not found",
          message: `Cannot find a value for contract placeholder ${contractName}. Please add to your flow.json or explicitly add it to the config 'contracts.*' namespace.`,
          level: logger.LEVELS.warn,
        })
      }
    }
  }

  // We need to move this over in any case.
  ix.message.cadence = cadence

  return ix
}
