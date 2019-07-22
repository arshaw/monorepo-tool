import { bin } from './lib/exec'
import { buildProj } from './lib/proj'
import { queryInstalled } from './lib/npm'
import { RootInnerRefError, PkgNameCollisionError, InnerInnerRefError } from '../src/errors'

// TODO: symlink clearing

describe('install', () => {

  it('installs external and inner packages', () => {
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

    let { success } = bin([ 'install' ], proj.path)
    expect(success).toBe(true)

    expect(queryInstalled(proj.path)).toEqual({
      '.': {
        moment: true
      },
      'packages/core': {
        moment: true
      },
      'packages/plug': {
        core: '../core'
      }
    })
  })


  it('can\'t let root reference inner packages', () => {
    let proj = buildProj({
      'monorepo.json': {
        'packages': [ 'packages/*' ]
      },
      'package.json': {
        dependencies: {
          moment: '*',
          core: '*'
        }
      },
      'packages/': {
        'core/': {
          'package.json': {
            name: 'core',
            dependencies: {
              moment: '*'
            }
          }
        },
        'plug/': {
          'package.json': {
            name: 'plug',
            dependencies: {
              'core': '*'
            }
          }
        }
      }
    })

    let { success, output } = bin([ 'install' ], proj.path)

    expect(success).toBe(false)
    expect(output).toContain(new RootInnerRefError('dependencies', 'core').message)
  })


  it('can\'t let inner packages reference other inner packages with no version number', () => {
    let proj = buildProj({
      'monorepo.json': {
        'packages': [ 'packages/*' ]
      },
      'packages/': {
        'core/': {
          'package.json': { name: 'core' }
        },
        'plug/': {
          'package.json': { name: 'plug', dependencies: {
            core: '^2.0.0'
          } }
        }
      }
    })

    let { success, output } = bin([ 'install' ], proj.path)

    expect(success).toBe(false)
    expect(output).toContain(new InnerInnerRefError('plug', 'core').message)
  })


  it('can\'t let inner packages reference other inner packages with incompatible version number', () => {
    let proj = buildProj({
      'monorepo.json': { 'packages': [ 'packages/*' ] },
      'packages/': {
        'core/': {
          'package.json': { name: 'core', version: '1.0.0' }
        },
        'plug/': {
          'package.json': { name: 'plug', dependencies: {
            core: '^2.0.0'
          } }
        }
      }
    })

    let { success, output } = bin([ 'install' ], proj.path)

    expect(success).toBe(false)
    expect(output).toContain(new InnerInnerRefError('plug', 'core', '^2.0.0', '1.0.0').message)
  })


  it('can\'t have multi inner packages with same name', () => {
    let proj = buildProj({
      'monorepo.json': {
        'packages': [ 'packages/*' ]
      },
      'packages/': {
        'core/': {
          'package.json': { name: 'core' }
        },
        'plug/': {
          'package.json': { name: 'core' }
        }
      }
    })

    let { success, output } = bin([ 'install' ], proj.path)

    expect(success).toBe(false)
    expect(output).toContain(new PkgNameCollisionError('core').message)
  })

})
