import { promisify } from 'util'
import * as fs from 'fs'
import { join as joinPaths, isAbsolute, relative as relativizePath } from 'path'
import { MissingDistJsonError } from '../errors'
import Pkg from './Pkg'
import { BaseConfig, DistDirInput } from './parse'
const readFile = promisify(fs.readFile)


export interface InnerPkgConfig extends BaseConfig {
  path: string
}


/*
A package that lives within a monorepo that is NOT the root package
*/
export default class InnerPkg extends Pkg {

  relDir: string // same as `dir`, but relative to the monorepo root
  distDir: string // absolute. empty if no separate dist dir
  ignoreFiles: string[] // RELATIVE to package root


  constructor(config: InnerPkgConfig, baseDir: string) {
    super(
      joinPaths(baseDir, config.path),
      config.npmClientArgs
    )

    this.relDir = config.path
    this.distDir = this.computeDistDir(config.distDir, baseDir)
    this.ignoreFiles = config.ignoreFiles

    if (this.distDir) {
      this.ignoreFiles = this.ignoreFiles.concat([
        relativizePath(this.dir, this.distDir)
      ])
    }
  }


  readableId() {
    return this.jsonData.name || this.relDir
  }


  computeDistDir(s: DistDirInput, baseDir: string): string {

    if (typeof s === 'function') {
      s = s(this.relDir, this.dir, baseDir)
    }

    if (typeof s === 'string' && s) {
      s = isAbsolute(s) ? s : joinPaths(this.dir, s)

      if (s !== this.dir) {
        return s
      }
    }

    return ''
  }


  async queryPublishJsonData() {

    if (!this.distDir) {
      return this.jsonData
    }

    let pubJsonPath = joinPaths(this.distDir, 'package.json')

    let pubJsonStr = await readFile(pubJsonPath, { encoding: 'utf8' })
      .catch(() => {
        throw new MissingDistJsonError(this.readableId())
      })

    return JSON.parse(pubJsonStr)
  }

}
