import { describe, expect, it } from 'vitest'
import {
  characterLabel,
  countCharacters,
  makeMemento,
  memorySource,
  playerLines,
  storyArtwork,
  type Session,
} from './domain'

describe('personal memento', () => {
  it('reveals a name only from the server projection and keeps earlier transcript labels anonymous', () => {
    const session: Session = {
      id: 'night',
      revision: 2,
      mode: 'live',
      turn: 2,
      status: 'active',
      phase: 'arrival',
      identity: { name: '艾', sourceMessageId: '2-character' },
      messages: [
        { id: '1-player', role: 'player', text: '你叫艾吗？' },
        { id: '1-character', role: 'character', text: '我还没说。' },
        { id: '2-player', role: 'player', text: '我叫阿迟。' },
        { id: '2-character', role: 'character', text: '我叫艾，艾草的艾。' },
      ],
      observations: [],
      memories: [{ id: 'm', title: '名字', sourceTurn: 2, text: '我叫艾，艾草的艾。' }],
      ending: null,
      createdAt: '',
      updatedAt: '',
    }
    expect(characterLabel(session)).toBe('艾')
    expect(characterLabel(session, '1-character')).toBe('天台上的人')
    expect(characterLabel(session, '2-character')).toBe('艾')
    expect(characterLabel({ ...session, identity: undefined })).toBe('天台上的人')
    expect(memorySource(session, session.memories[0]!)).toBe('艾说')
    const file = makeMemento(session)
    expect(file).toContain('天台上的人：我还没说。')
    expect(file).toContain('艾：我叫艾，艾草的艾。')
    expect(file).not.toContain('艾：我还没说。')
  })

  it('uses confirmed space independently from turn pacing and respects an explicit return outside', () => {
    const session: Session = {
      id: 'night',
      revision: 8,
      mode: 'live',
      turn: 8,
      status: 'active',
      phase: 'threshold',
      messages: [],
      observations: [],
      memories: [],
      ending: null,
      createdAt: '',
      updatedAt: '',
    }
    for (const turn of [3, 6, 9]) {
      expect(storyArtwork({ ...session, turn })).toBe('/art/rooftop.webp')
    }
    expect(storyArtwork({ ...session, mode: 'rehearsal' })).toBe('/art/listening.webp')
    expect(
      storyArtwork({ ...session, scene: { location: 'threshold', sourceMessageId: '8-narrator' } }),
    ).toBe('/art/threshold.webp')
    expect(
      storyArtwork({ ...session, scene: { location: 'rooftop', sourceMessageId: '9-narrator' } }),
    ).toBe('/art/rooftop.webp')
    expect(storyArtwork({ ...session, status: 'ended' })).not.toBe('/art/dawn.webp')
    expect(
      storyArtwork({
        ...session,
        turn: 1,
        scene: { location: 'threshold', sourceMessageId: '1-narrator' },
      }),
    ).toBe('/art/threshold.webp')
    const stopped: Session = {
      ...session,
      mode: 'rehearsal',
      turn: 2,
      phase: 'arrival',
      status: 'ended',
      ending: { id: 'leave', title: '这一夜，先到这里', subtitle: '', paragraphs: [], echo: '' },
    }
    expect(storyArtwork(stopped)).toBe('/art/rooftop.webp')
    expect(makeMemento(stopped)).toContain('本次回应：2 次，最多十次。')
  })
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
    const withoutQuote = makeMemento({ ...session, ending: { ...session.ending!, echo: '' } })
    expect(withoutQuote).not.toContain('—— 这一夜留下的原话 ——')
    expect(withoutQuote).toContain(`我：${text}`)
  })

  it('keeps visible facts and deliberate silence separate from spoken words', () => {
    const session: Session = {
      id: 'night',
      revision: 3,
      mode: 'live',
      turn: 2,
      status: 'active',
      phase: 'arrival',
      messages: [
        { id: '1-player', role: 'player', text: '门还开着。' },
        { id: '1-character', role: 'character', text: '嗯，先留着。' },
        { id: '2-player', role: 'player', text: '让这一刻安静一会儿。', intent: 'silence' },
      ],
      observations: ['door'],
      memories: [],
      ending: null,
      createdAt: '',
      updatedAt: '',
    }
    expect(playerLines(session).map((message) => message.id)).toEqual(['1-player'])
    expect(memorySource(session, { id: 'm', title: '留门', sourceTurn: 1, text: '先留着。' })).toBe(
      '她说',
    )
    expect(
      memorySource(session, {
        id: 'n',
        title: '停顿',
        sourceTurn: 2,
        text: '让这一刻安静一会儿。',
      }),
    ).toBe('你留下的停顿')
    const file = makeMemento(session)
    expect(file).toContain('—— 我看见的现场 ——')
    expect(file).toContain('消防门')
    expect(file).toContain('我的停顿：让这一刻安静一会儿。')
    expect(file).not.toContain('我：让这一刻安静一会儿。')
    expect(file).not.toContain('—— 这一夜留下的原话 ——')
  })

  it('counts Unicode code points instead of UTF-16 units to match the server limit', () => {
    expect(countCharacters('雨🌧')).toBe(2)
    expect(countCharacters('🙂'.repeat(120))).toBe(120)
  })
})
