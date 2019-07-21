
const noop = function() {}


export function runParallel(funcs: (() => PromiseLike<any>)[]): Promise<void> {
  return allSettledVoid(
    funcs.map((func) => func())
  )
}


export function allSettledVoid(promises: PromiseLike<any>[]): Promise<void> {
  return allSettled(promises).then(noop)
}


/*
like https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled
*/
export function allSettled<T>(promises: PromiseLike<T>[]): Promise<T[]> {
  let firstError: Error

  return Promise.all(
    promises.map((promise) =>
      Promise.resolve(promise).catch((error) => {
        if (!firstError) {
          firstError = error
        }
        return Promise.resolve()
      })
    )
  ).then((results: (void | T)[]) => {
    if (firstError) {
      return Promise.reject(firstError)
    } else {
      return Promise.resolve(results as T[])
    }
  })
}


export function collectResults<T>(promises: PromiseLike<T[]>[]): Promise<T[]> {
  return allSettled(promises).then((results) => {
    return [].concat(...(results as any))
  })
}
