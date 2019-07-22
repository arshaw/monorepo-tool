import { join as joinPaths } from 'path'
import { readJsonSync, writeFileSync } from 'fs-extra'
import { buildProj } from './lib/proj'
import { bin, exec } from './lib/exec'
import { isGitTreeDirty } from './lib/git'
import { NoRepoRootError } from '../src/errors'


describe('version', () => {

  // TODO: test different version prefix for tag
  // TODO: test customizable message
  // TODO: check clean working tree, even after failure
  // TODO: test literal version nums
  // TODO: test submodules, when those packages have no changes, nothing gets committed
  // TODO: more tests with devDependencies/peerDependencies


  it('fails when no git', () => {
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

    let { success, output } = bin([ 'version', '--yes' ], proj.path)
    expect(success).toBe(false)
    expect(output).toContain(new NoRepoRootError(proj.path).message)
  })


  it('bumps all packages when no previous versions', () => {
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

    let { success } = bin([ 'version', '--yes' ], proj.path)
    expect(success).toBe(true)

    expect(
      readJsonSync(joinPaths(proj.path, 'packages/core/package.json'))
    ).toEqual(
      { name: 'core', version: '0.0.1', dependencies: { moment: '*' } }
    )

    expect(
      readJsonSync(joinPaths(proj.path, 'packages/plug/package.json'))
    ).toEqual(
      { name: 'plug', version: '0.0.1', dependencies: { core: '*' } }
    )

    expect(isGitTreeDirty(proj.path)).toBe(false)
  })


  it('uses root package version as starting point', () => {
    let proj = buildProj({
      'monorepo.json': { packages: [ 'packages/*' ] },
      'package.json': { version: '2.0.0', dependencies: {
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

    // TODO: rethink --all-pkgs (done to avoid needed to write a previous tag)
    let { success } = bin([ 'version', '--yes', '--all-pkgs', '--no-git-tag-version' ], proj.path)
    expect(success).toBe(true)

    expect(
      readJsonSync(joinPaths(proj.path, 'package.json'))
    ).toEqual(
      { version: '2.0.1', dependencies: { moment: '*' } }
    )

    expect(
      readJsonSync(joinPaths(proj.path, 'packages/core/package.json'))
    ).toEqual(
      { name: 'core', version: '2.0.1', dependencies: { moment: '*' } }
    )

    expect(
      readJsonSync(joinPaths(proj.path, 'packages/plug/package.json'))
    ).toEqual(
      { name: 'plug', version: '2.0.1', dependencies: { core: '*' } }
    )
  })


  it('bumps from a previous version when changed', () => {
    let proj = buildProj({
      'monorepo.json': { packages: [ 'packages/*' ] },
      'package.json': { dependencies: {
        moment: '*'
      } },
      'packages/': {
        'core/': {
          'package.json': { name: 'core', version: '1.0.0', dependencies: {
            moment: '*'
          } }
        },
        'plug/': {
          'package.json': { name: 'plug', version: '1.0.0', dependencies: {
            core: '^1.0.0'
          } }
        }
      }
    }, {
      git: true
    })

    exec('git commit --allow-empty -m "some base features"', proj.path)
    exec('git tag -a v1.0.0 -m "1.0.0"', proj.path)

    writeFileSync(
      joinPaths(proj.path, 'packages/core/file.js'),
      'alert("nice")',
      { encoding: 'utf8' }
    )

    exec('git add packages/core/file.js', proj.path) // the "new change" since v1.0.0
    exec('git commit -m "some newer features"', proj.path)

    let { success } = bin([ 'version', '--yes' ], proj.path)
    expect(success).toBe(true)

    expect(
      readJsonSync(joinPaths(proj.path, 'packages/core/package.json'))
    ).toEqual(
      { name: 'core', version: '1.0.1', dependencies: { moment: '*' } }
    )

    expect(
      readJsonSync(joinPaths(proj.path, 'packages/plug/package.json'))
    ).toEqual(
      { name: 'plug', version: '1.0.0', dependencies: { core: '^1.0.0' } }
    )

    let tagNames = exec('git tag', proj.path).output.trim().split('\n')

    expect(tagNames).toEqual([ 'v1.0.0', 'v1.0.1' ])

    expect(isGitTreeDirty(proj.path)).toBe(false)
  })


  it('will bump a package that depends on another that goes out of range', () => {
    let proj = buildProj({
      'monorepo.json': { packages: [ 'packages/*' ] },
      'package.json': { dependencies: {
        moment: '*'
      } },
      'packages/': {
        'core/': {
          'package.json': { name: 'core', version: '1.0.0', dependencies: {
            moment: '*'
          } }
        },
        'plug/': {
          'package.json': { name: 'plug', version: '1.0.0', dependencies: {
            core: '^1.0.0'
          } }
        }
      }
    }, {
      git: true
    })

    exec('git commit --allow-empty -m "some base features"', proj.path)
    exec('git tag -a v1.0.0 -m "1.0.0"', proj.path)

    writeFileSync(
      joinPaths(proj.path, 'packages/core/file.js'),
      'alert("nice")',
      { encoding: 'utf8' }
    )

    exec('git add packages/core/file.js', proj.path) // the "new change" since v1.0.0
    exec('git commit -m "some newer features"', proj.path)

    let { success } = bin([ 'version', '--yes', 'major' ], proj.path)
    expect(success).toBe(true)

    expect(
      readJsonSync(joinPaths(proj.path, 'packages/core/package.json'))
    ).toEqual(
      { name: 'core', version: '2.0.0', dependencies: { moment: '*' } }
    )

    expect(
      readJsonSync(joinPaths(proj.path, 'packages/plug/package.json'))
    ).toEqual(
      { name: 'plug', version: '2.0.0', dependencies: { core: '^2.0.0' } }
    )
  })

})
