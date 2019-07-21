import { writeFileSync } from 'fs'
import { join as joinPaths } from 'path'
import { buildProj } from './lib/proj'
import { bin, exec } from './lib/exec'


describe('changed', () => {

  // TODO: when no git repo, check NoRepoRootError
  // TODO: when nothing changed, reports nothing
  // TODO: ignoreFiles-per-package
  // TODO: ignoreFiles as a single string?


  it('reports all changed when no previous versions', () => {
    let proj = buildProj({
      'monorepo.json': { packages: [ 'packages/*' ] },
      'package.json': { dependencies: {
        moment: '*'
      } },
      'packages/': {
        'core/': {
          'package.json': { name: 'core', dependencies: {
            moment: '*'
          } }
        },
        'plug/': {
          'package.json': { name: 'plug', dependencies: {
            core: '*'
          } }
        }
      }
    })

    let { success, output } = bin([ 'changed' ], proj.path)
    expect(success).toBe(true)
    expect(output).toBe('core\nplug\n')
  })


  it('reports changes since last version', () => {
    let proj = buildProj({
      'monorepo.json': { packages: [ 'packages/*' ] },
      'package.json': { dependencies: {
        moment: '*'
      } },
      'packages/': {
        'core/': {
          'package.json': { name: 'core', dependencies: {
            moment: '*'
          } }
        },
        'plug/': {
          'package.json': { name: 'plug', dependencies: {
            core: '*'
          } }
        }
      }
    }, {
      git: true
    })

    let verionSuccess = bin([ 'version', '--yes', '--all-pkgs', '1.0.0' ], proj.path).success
    expect(verionSuccess).toBe(true)

    writeFileSync(
      joinPaths(proj.path, 'packages/core/file.js'),
      'alert("nice")',
      { encoding: 'utf8' }
    )

    exec('git add packages/core/file.js', proj.path) // the "new change" since v1.0.0
    exec('git commit -m "some newer features"', proj.path)

    let { success, output } = bin([ 'changed' ], proj.path)
    expect(success).toBe(true)
    expect(output).toBe('core\n') // ONLY the core
  })


  it('will ignore changes in ignoreFiles', () => {
    let proj = buildProj({
      'monorepo.json': {
        packages: [ 'packages/*' ],
        ignoreFiles: [ 'README.txt' ]
      },
      'package.json': { dependencies: {
        moment: '*'
      } },
      'packages/': {
        'core/': {
          'package.json': { name: 'core', dependencies: {
            moment: '*'
          } }
        },
        'plug/': {
          'package.json': { name: 'plug', dependencies: {
            core: '*'
          } }
        }
      }
    }, {
      git: true
    })

    let verionSuccess = bin([ 'version', '--yes', '--all-pkgs', '1.0.0' ], proj.path).success
    expect(verionSuccess).toBe(true)

    writeFileSync(joinPaths(proj.path, 'packages/core/README.txt'), 'please read me', { encoding: 'utf8' })
    writeFileSync(joinPaths(proj.path, 'packages/plug/README.txt'), 'please read me', { encoding: 'utf8' })
    writeFileSync(joinPaths(proj.path, 'packages/plug/file.js'), 'alert("nice")', { encoding: 'utf8' })

    exec('git add packages/core/README.txt', proj.path)
    exec('git add packages/plug/README.txt', proj.path)
    exec('git add packages/plug/file.js', proj.path)
    exec('git commit -m "some newer features"', proj.path)

    let { success, output } = bin([ 'changed' ], proj.path)
    expect(success).toBe(true)
    expect(output).toBe('plug\n') // ONLY plug
  })


  it('will ignore changes in distDir', () => {
    let proj = buildProj({
      'monorepo.json': {
        packages: [ 'packages/*' ],
        distDir: 'dist'
      },
      'package.json': { dependencies: {
        moment: '*'
      } },
      'packages/': {
        'core/': {
          'package.json': { name: 'core', dependencies: {
            moment: '*'
          } },
          'dist/': {}
        },
        'plug/': {
          'package.json': { name: 'plug', dependencies: {
            core: '*'
          } },
          'dist/': {}
        }
      }
    }, {
      git: true
    })

    let linkSuccess = bin([ 'link' ], proj.path).success // for building dist/package.json's
    expect(linkSuccess).toBe(true)

    let verionSuccess = bin([ 'version', '--yes', '--all-pkgs', '1.0.0' ], proj.path).success
    expect(verionSuccess).toBe(true)

    writeFileSync(joinPaths(proj.path, 'packages/core/README.txt'), 'please read me', { encoding: 'utf8' })
    writeFileSync(joinPaths(proj.path, 'packages/core/dist/file.js'), 'alert("nice")', { encoding: 'utf8' })
    writeFileSync(joinPaths(proj.path, 'packages/plug/dist/file.js'), 'alert("nice")', { encoding: 'utf8' })

    exec('git add packages/core/README.txt', proj.path)
    exec('git add packages/core/dist/file.js', proj.path)
    exec('git add packages/plug/dist/file.js', proj.path)
    exec('git commit -m "some newer features"', proj.path)

    let { success, output } = bin([ 'changed' ], proj.path)
    expect(success).toBe(true)
    expect(output).toBe('core\n') // ONLY core
  })

})
