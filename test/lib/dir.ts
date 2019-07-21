import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join as joinPaths, isAbsolute } from 'path'
import * as mkdirp from 'mkdirp'
import * as rimraf from 'rimraf'
import * as tmp from 'tmp'


export interface BuildDirConfig {
  dest?: string
  tmpDir?: string
}


const DIR_RE = /\/$/
const JSON_RE = /\.json$/
// TODO: bash, add exec flag


export function buildDirStruct(struct: any, config: BuildDirConfig = {}) {
  let dest: string

  if (config.dest) {
    dest = config.dest
    mkdirp.sync(dest)
  } else {
    let tmpDir = config.tmpDir

    if (tmpDir) {
      if (!isAbsolute(tmpDir)) {
        tmpDir = joinPaths(process.cwd(), tmpDir)
      }
      mkdirp.sync(tmpDir)
    }

    dest = tmp.dirSync({ dir: tmpDir }).name
  }

  buildDirStructAtDest(struct, dest)

  return {
    path: dest,
    delete: () => rimraf.sync(dest!)
  }
}


function buildDirStructAtDest(struct: any, dest: string) {

  for (let entry in struct) {
    let entryContent = struct[entry]
    let entryPath = joinPaths(dest, entry)

    if (DIR_RE.test(entry)) {

      if (!existsSync(entryPath)) {
        mkdirSync(entryPath)
      }

      buildDirStructAtDest(entryContent, entryPath)

    } else if (JSON_RE.test(entry)) {
      writeFileSync(
        entryPath,
        JSON.stringify(entryContent, null, '  ') + '\n',
        { encoding: 'utf8' }
      )

    } else {
      writeFileSync(
        entryPath,
        entryContent,
        { encoding: 'utf8' }
      )
    }
  }
}
