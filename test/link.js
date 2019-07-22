import { bin } from './lib/exec'
import { buildProj } from './lib/proj'
import { queryInstalled } from './lib/npm'

// TODO: tests when same dep is in dependencies/devDependencies/peerDependencies
// TODO: links to distDir

describe('link', () => {

  it('symlinks dirs together without installing normal deps', () => {
    let proj = buildProj({
      'monorepo.json': {
        'packages': [ 'packages/*' ]
      },
      'package.json': {
        dependencies: {
          moment: '*'
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

    let { success } = bin([ 'link' ], proj.path)
    expect(success).toBe(true)

    expect(queryInstalled(proj.path)).toEqual({
      'packages/plug': {
        core: '../core'
      }
    })
  })

})
