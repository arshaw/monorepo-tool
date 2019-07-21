import { join as joinPaths } from 'path'
import { execFileSync, execSync } from 'child_process'


export interface ExecRes {
  success: boolean
  output: string
}

const BIN_PATH = joinPaths(process.cwd(), 'dist/src/main.js')


export function bin(args: string | string[], cwd: string, displayOutput?: boolean, logging?: boolean, inspector?: boolean): ExecRes {
  let env = Object.assign({}, process.env, {
    DEBUG: logging ? 'verbose' : 'true'
  })

  if (typeof args === 'string') {
    return exec(`${BIN_PATH} ${args}`, cwd, env, displayOutput)
  } else {
    if (inspector) {
      return exec([ 'node', '--inspect-brk', BIN_PATH, ...args ], cwd, env, displayOutput)
    } else {
      return exec([ BIN_PATH, ...args ], cwd, env, displayOutput)
    }
  }
}


export function exec(args: string | string[], cwd: string, env: { [varName: string]: string } = {}, displayOutput?: boolean): ExecRes {
  try {
    let output: string

    if (typeof args === 'string') {
      output = execSync(args, { encoding: 'utf8', cwd, env, stdio: [ 'inherit', 'pipe', 'pipe' ] })
    } else {
      output = execFileSync(args[0], args.slice(1), { encoding: 'utf8', cwd, env, stdio: [ 'inherit', 'pipe', 'pipe' ] })
    }

    if (displayOutput) {
      console.log(output)
    }

    return { success: true, output }

  } catch (error) {

    let outputs = []
    if (error.stdout) { outputs.push(error.stdout) }
    if (error.stderr) { outputs.push(error.stderr) }
    let output = outputs.join('\n')

    if (displayOutput) {
      console.log(output)
    }

    return { success: false, output }
  }
}
