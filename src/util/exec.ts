import { spawn, execFile } from 'child_process'


export class ExecError extends Error {

  constructor(
    public exitCode: number | string | null,
    public output: string,
    message: string
  ) {
    super(message)
  }

}


/*
stdio inspired from
https://stackoverflow.com/questions/14332721/node-js-spawn-child-process-and-get-terminal-output-live
*/
export function execLive(cmd: string[], cwd: string): Promise<void> {

  if (!cmd[0]) {
    throw new Error('Must supply a file to execute')
  }

  return new Promise((resolve, reject) => {
    let child = spawn(cmd[0], cmd.slice(1), {
      cwd,
      stdio: [ 'ignore', 1, 2 ] // TODO: will accept input?
    })
    child.on('error', (error) => {
      reject(new ExecError(null, error.toString(), error.message))
    })
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new ExecError(code, '', ''))
      } else {
        resolve()
      }
    })
  })
}


export function execBuffered(cmd: string[], cwd: string): Promise<string> {

  if (!cmd[0]) {
    throw new Error('Must supply a file to execute')
  }

  return new Promise((resolve, reject) => {
    execFile(cmd[0], cmd.slice(1), {
      encoding: 'utf8',
      cwd
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new ExecError((error as any).code, stderr, error.message))
      } else {
        resolve(stdout)
      }
    })
  })
}
