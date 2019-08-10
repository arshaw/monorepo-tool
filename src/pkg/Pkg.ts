import { promisify } from 'util'
import * as fs from 'fs'
import { join as joinPaths } from 'path'
import { log } from '../util/log'
import { execBuffered, execLive } from '../util/exec'
import { PkgNameCollisionError } from '../errors'
import AbstractNpmClient from '../npm/AbstractNpmClient'
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)


export type PkgHash = { [pkgName: string]: Pkg }

export default class Pkg {

  jsonPath: string // the package.json in the package root, not the distDir
  jsonText?: string
  jsonData?: any


  constructor(
    public dir: string,
    public npmClientArgs: string[]
  ) {
    this.jsonPath = joinPaths(this.dir, 'package.json')
  }


  /*
  Should always be called right after instantiation.
  TODO: write a factory function that does all this, but works with Pkg sublasses somehow.
  */
  loadJson(): Promise<any> {
    return readFile(this.jsonPath, { encoding: 'utf8' }).then((jsonText) => {
      this.jsonText = jsonText
      return (this.jsonData = JSON.parse(jsonText))
    })
  }


  async updateJson(newJsonData: any) {
    let oldJsonData = this.jsonData
    let oldJsonText = this.jsonText
    let newJsonText = JSON.stringify(newJsonData, null, '  ') + '\n' // TODO: use old text to determine end

    log('Writing mods to', this.jsonPath, newJsonData)
    await writeFile(this.jsonPath, newJsonText, { encoding: 'utf8' })

    this.jsonData = newJsonData
    this.jsonText = newJsonText

    return async () => {
      log('Undoing mods to', this.jsonPath)
      await writeFile(this.jsonPath, oldJsonText, { encoding: 'utf8' })
      this.jsonData = oldJsonData
      this.jsonText = oldJsonText
    }
  }


  runScript(npmClient: AbstractNpmClient, scriptName: string, buffer: boolean = false): Promise<string> {
    let cmd = this.buildScriptCmd(npmClient, scriptName)

    if (cmd) {
      log('runcmd', cmd, buffer, this.dir)

      if (buffer) {
        return execBuffered(cmd, this.dir)
      } else {
        return execLive(cmd, this.dir).then(() => '')
      }

    } else {
      return Promise.resolve('')
    }
  }


  hasScript(scriptName: string): boolean {
    return scriptName in (this.jsonData.scripts || {})
  }


  buildScriptCmd(npmClient: AbstractNpmClient, scriptName: string): string[] | null {
    let scriptCmdStr: string = (this.jsonData.scripts || {})[scriptName]

    if (scriptCmdStr) {
      return npmClient.buildExecCmd(scriptCmdStr)
    }

    return null
  }


  readableId() {
    return this.jsonData.name || 'root' // assuming root is a bad idea
  }

}


export function hashPkgsByName<T extends Pkg = Pkg>(pkgs: T[]) {
  let pkgsByName: { [pkgName: string]: T } = {}

  for (let pkg of pkgs) {
    let pkgName = pkg.jsonData.name

    if (pkgName) {
      if (pkgsByName[pkgName]) {
        throw new PkgNameCollisionError(pkgName)
      } else {
        pkgsByName[pkgName] = pkg
      }
    }
  }

  return pkgsByName
}


export function hashPkgsByDir<T extends Pkg = Pkg>(pkgs: T[]) {
  let pkgsByDir: { [pkgName: string]: T } = {}

  for (let pkg of pkgs) {
    pkgsByDir[pkg.dir] = pkg
  }

  return pkgsByDir
}
