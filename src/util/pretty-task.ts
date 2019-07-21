import chalk from 'chalk'
import * as ProgressBar from 'progress'
import { indentLines } from './string'


export interface PrettyTask {
  label: string
  func: (isSerial: boolean) => Promise<any>
}


export function runPrettySerial(tasks: PrettyTask[]) {
  let wrappers = tasks.map((task) => () => {
    console.log()
    console.log(chalk.magenta('+ ' + task.label))
    return task.func(true)
  })

  return wrappers.reduce(
    (p, fn) => p.then(fn),
    Promise.resolve()
  )
}


export function runPrettyParallel(tasks: PrettyTask[]): Promise<void> {

  if (!tasks.length) {
    return Promise.resolve()
  }

  let progressBar = new ProgressBar('[:bar]', { width: 50, total: tasks.length })
  let successes: boolean[] = []
  let outputs: string[] = []
  let firstError: Error

  function showOutput() {
    for (let i = 0; i < tasks.length; i++) {
      if (outputs[i]) {
        console.log()
        console.log(chalk.magenta('+ ' + tasks[i].label))
        console.log(indentLines(outputs[i].trimEnd(), chalk.magenta('| ')))

        if (!successes[i]) {
          console.log(chalk.red('+ Failed'))
        }
      }
    }
  }

  return Promise.all(
    tasks.map(async (task, i) => {
      return task.func(false).then((output) => {
        progressBar.tick()
        outputs[i] = output
        successes[i] = true
      }, (error) => {
        progressBar.tick()
        if (!firstError) {
          firstError = error
        }
        outputs[i] = error.output || error.toString()
      })
    })
  ).then(() => {
    showOutput()

    if (firstError) {
      return Promise.reject(firstError)
    } else {
      return Promise.resolve()
    }
  })
}
