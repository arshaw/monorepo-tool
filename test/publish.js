import { copyFileSync, mkdirSync } from 'fs'
import { join as joinPaths } from 'path'
import { buildProj } from './lib/proj'
import { bin } from './lib/exec'


describe('publish', () => {


  it('can publish the most recent version to a registry', () => {
    let proj = buildProj({
      'monorepo.json': { packages: [ 'packages/*' ] },
      'package.json': { version: '1.0.1' },
      'packages/': {
        'core/': {
          'package.json': { name: 'core', version: '1.0.1' },
          'index.js': 'alert("hello")'
        },
        'plug/': {
          'package.json': { name: 'plug', version: '1.0.0', dependencies: { core: '*' } },
          'index.js': 'alert("hello")'
        }
      }
    })

    let { success, output } = bin([ 'publish', '--yes', '--dry-run' ], proj.path, false, true) // logging=true
    expect(success).toBe(true)

    let corePath = joinPaths(proj.path, 'packages/core')
    let plugPath = joinPaths(proj.path, 'packages/plug')

    expect(output).toContain(`PUBLISH CMD npm publish --dry-run in ${corePath}`)
    expect(output).not.toContain(`PUBLISH CMD npm publish --dry-run in ${plugPath}`)
  })


  it('can publish from dist directories', () => {
    let proj = buildProj({
      'monorepo.json': {
        packages: [ 'packages/*' ],
        distDir: 'dist'
      },
      'package.json': { version: '1.0.1' },
      'packages/': {
        'core/': {
          'package.json': { name: 'core', version: '1.0.1' },
          'index.js': 'alert("hello")'
        },
        'plug/': {
          'package.json': { name: 'plug', version: '1.0.0', dependencies: { core: '*' } },
          'index.js': 'alert("hello")'
        }
      }
    })

    for (let pkgName of [ 'core', 'plug' ]) {
      let normalDir = joinPaths(proj.path, 'packages', pkgName)
      let distDir = joinPaths(proj.path, 'packages', pkgName, 'dist')

      mkdirSync(distDir)

      for (let fileName of [ 'package.json', 'index.js' ]) {
        copyFileSync(
          joinPaths(normalDir, fileName),
          joinPaths(distDir, fileName)
        )
      }
    }

    // do --dry-run so doesn't actually write anything
    // do logging=true and inspect the output instead
    let { success, output } = bin([ 'publish', '--yes', '--dry-run' ], proj.path, false, true)
    expect(success).toBe(true)

    let coreDistPath = joinPaths(proj.path, 'packages/core/dist')
    let plugDistPath = joinPaths(proj.path, 'packages/plug/dist')

    expect(output).toContain(`PUBLISH CMD npm publish --dry-run in ${coreDistPath}`)
    expect(output).not.toContain(`PUBLISH CMD npm publish --dry-run in ${plugDistPath}`)
  })

})
