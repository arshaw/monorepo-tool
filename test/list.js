import { bin } from './lib/exec'
import { buildProj } from './lib/proj'

describe('list', () => {

  it('can list deps', () => {
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

    let { success, output } = bin([ 'list' ], proj.path)
    expect(success).toBe(true)
    expect(output).toBe('core\nplug\n')
  })

})
