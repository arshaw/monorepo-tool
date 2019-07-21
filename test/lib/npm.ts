import { exec } from './exec'
import { readFileSync, lstatSync, Stats, readlinkSync } from 'fs'
import { join as joinPaths, dirname } from 'path'


export function queryInstalled(dir: string) {
  let pkgJsonPaths = exec('find . -type d -name "node_modules" -prune -o -type f -name "package.json" -print', dir)
    .output.trim().split('\n')
  let pathRes: any = {}

  for (let pkgJsonPathRel of pkgJsonPaths) {
    let pkgJsonPathAbs = joinPaths(dir, pkgJsonPathRel)
    let pkgPathAbs = dirname(pkgJsonPathAbs)
    let pkgJsonStr = readFileSync(pkgJsonPathAbs, { encoding: 'utf8' })
    let pkgJsonData = JSON.parse(pkgJsonStr)
    let depMap = buildInstallableDepMap(pkgJsonData)
    let depRes: any = {}

    for (let depName in depMap) {
      let depPath = joinPaths(pkgPathAbs, 'node_modules', depName)
      let lstat: Stats | null = null

      try {
        lstat = lstatSync(depPath)
      } catch (error) {}

      if (lstat) {
        if (lstat.isSymbolicLink()) {
          depRes[depName] = readlinkSync(depPath, { encoding: 'utf8' })
            .replace(/^\.\.[\/\\]/, '') // remove leading ../ (want to be rel to pkg root)
        } else {
          depRes[depName] = true
        }
      }
    }

    let pkgPathShort = dirname(pkgJsonPathRel)
    pkgPathShort = pkgPathShort.replace(/^\.[\/\\]/, '') // remove leading ./
    pkgPathShort = pkgPathShort || '.' // root should still be .

    if (Object.keys(depRes).length) {
      pathRes[pkgPathShort] = depRes
    }
  }

  return pathRes
}


function buildInstallableDepMap(pkgJsonData: any) {
  return Object.assign(
    {},
    pkgJsonData.dependencies || {},
    pkgJsonData.devDependencies || {},
    pkgJsonData.optionalDependencies || {}
  )
}


export function queryInstalledVersion(dir: string, depName: string) {
  let depJsonPath = joinPaths(dir, 'node_modules', depName, 'package.json')

  try {
    let depJsonStr = readFileSync(depJsonPath, { encoding: 'utf8' })
    let depJsonData = JSON.parse(depJsonStr)
    return depJsonData.version

  } catch(error) {
    return false
  }
}
