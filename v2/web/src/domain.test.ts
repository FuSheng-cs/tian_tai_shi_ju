import { describe, expect, it } from 'vitest'
import { countCharacters, makeMemento, type Session } from './domain'

describe('personal memento', () => {
  it('exports the verbatim player echo and transcript as text, including HTML-like input safely', () => {
    const text = '我说的是 <script>这不是旁白</script>。'
    const session: Session = {
      id: 'night',
      revision: 11,
      mode: 'rehearsal',
      turn: 10,
      status: 'ended',
      phase: 'dawn',
      messages: [{ id: 'mine', role: 'player', text }],
      observations: [],
      memories: [{ id: 'memory', title: '门里的光', text: '她说：门别关。', sourceTurn: 1 }],
      ending: {
        id: 'night-over',
        title: '各自回家',
        subtitle: '雨小了',
        paragraphs: ['你们道了晚安。'],
        echo: text,
      },
      createdAt: '',
      updatedAt: '',
    }
    const file = makeMemento(session)
    expect(file).toContain(text)
    expect(file).toContain(`我：${text}`)
    expect(file).toContain('她说：门别关。')
    expect(file).toContain('固定剧本，不解读自由输入')
    expect(file).not.toContain('night-over')
  })

  it('counts Unicode code points instead of UTF-16 units to match the server limit', () => {
    expect(countCharacters('雨🌧')).toBe(2)
    expect(countCharacters('🙂'.repeat(120))).toBe(120)
  })
})
