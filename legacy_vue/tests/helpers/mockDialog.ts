import { afterAll, beforeAll } from 'vitest'

// jsdom lacks native modal APIs; real top-layer and keyboard behavior is checked in a browser.
export const mockDialog = () => {
  const prototype = HTMLDialogElement.prototype
  const originalShow = Object.getOwnPropertyDescriptor(prototype, 'showModal')
  const originalClose = Object.getOwnPropertyDescriptor(prototype, 'close')

  beforeAll(() => {
    Object.defineProperty(prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true
        this.querySelector<HTMLButtonElement>('[autofocus]')?.focus()
      }
    })
    Object.defineProperty(prototype, 'close', {
      configurable: true,
      value(this: HTMLDialogElement) { this.open = false }
    })
  })

  afterAll(() => {
    if (originalShow) Object.defineProperty(prototype, 'showModal', originalShow)
    else Reflect.deleteProperty(prototype, 'showModal')
    if (originalClose) Object.defineProperty(prototype, 'close', originalClose)
    else Reflect.deleteProperty(prototype, 'close')
  })
}
