
export type ArgNameInput = string | [ string, string ]


export function extractNamedVal(args: string[], nameInput: ArgNameInput): string | null {
  let vals = extractNamedVals(args, nameInput, 1)

  return vals.length > 0 ? vals[0] : null
}


export function extractNamedVals(args: string[], nameInput: ArgNameInput, maxValues?: number): string[] {
  let argHash = parseArgNameInput(nameInput)
  let values: string[] = []
  let i = 0

  while (i < args.length) {
    let valueParts = args[i].split('=')
    let argName = valueParts.shift()! // will remove name

    if (argHash[argName]) {
      args.splice(i, 1) // remove the flag

      if (valueParts.length) { // a ="" value specified?
        values.push(valueParts.join('='))

        if (maxValues && values.length >= maxValues) {
          return values
        }

      } else {

        // get the next consecutive non-flag args
        while (i < args.length) {
          let nextArg = args[i]

          if (!isFlag(nextArg)) {
            values.push(nextArg)
            args.splice(i, 1) // remove nextArg

            if (maxValues && values.length >= maxValues) {
              return values
            }

          } else {
            break
          }
        }
      }

    } else {
      i++
    }
  }

  return values
}


export function extractNamedFlag(args: string[], nameInput: ArgNameInput, defaultBool: boolean): boolean
export function extractNamedFlag(args: string[], nameInput: ArgNameInput): boolean | null
export function extractNamedFlag(args: string[], nameInput: ArgNameInput, defaultBool: boolean | null = null): boolean | null {
  let argHash = parseArgNameInput(nameInput)
  let i = 0

  while (i < args.length) {
    let matchingVal = argHash[args[i]]

    if (matchingVal != null) { // true/false
      args.splice(i, 1) // remove the flag

      if (matchingVal && args[i] === 'false') {
        args.splice(i, 1) // remove the false
        matchingVal = !matchingVal
      }

      return matchingVal

    } else {
      i++
    }
  }

  return defaultBool
}


export function extractPositionalArgs(args: string[]): string[] {
  for (let i = 0; i < args.length; i++) {
    if (!isFlag(args[i])) {

      let j
      for (j = i + 1; j < args.length; j++) {
        if (isFlag(args[j])) {
          break
        }
      }

      return args.splice(i, j) // remove it and return it
    }
  }

  return []
}


export function extractPositionalArg(args: string[]): string | null {
  for (let i = 0; i < args.length; i++) {
    if (!isFlag(args[i])) {
      return args.splice(i, 1)[0] // remove it and return it
    }
  }

  return null
}


export function peakPositionalArg(args: string[]): string | null {
  for (let i = 0; i < args.length; i++) {
    if (!isFlag(args[i])) {
      return args[i]
    }
  }

  return null
}


export function isFlag(s: string) {
  return s.charAt(0) === '-'
}


export function argsAreHelp(args: string[]): boolean {
  return args[0] === '-h' || args[0] === '--help'
}


export function argsAreVersion(args: string[]): boolean {
  return args[0] === '-v' || args[0] === '--version'
}


function parseArgNameInput(input: ArgNameInput) {
  let res: { [flag: string]: boolean } = {}

  if (typeof input === 'string') {
    res['--' + input] = true
    res['--no-' + input] = false
  } else {
    res['--' + input[0]] = true
    res['--no-' + input[0]] = false

    if (input.length > 1) {
      res['-' + input[1]] = true
    }
  }

  return res
}
