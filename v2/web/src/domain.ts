export type Observation = 'camera' | 'receipt' | 'door' | 'rain'
export type EndingChoice = 'handoff' | 'separate' | 'correspondence'
export type PlayMode = 'live' | 'rehearsal'

export interface Message {
  id: string
  role: 'player' | 'character' | 'narrator'
  text: string
}

export interface Memory {
  id: string
  title: string
  text: string
  sourceTurn: number
}

export interface Ending {
  id: string
  title: string
  subtitle: string
  paragraphs: string[]
  echo: string
}

export interface Session {
  id: string
  revision: number
  mode: PlayMode
  turn: number
  status: 'active' | 'choosing' | 'ended'
  phase: 'arrival' | 'listening' | 'threshold' | 'dawn'
  messages: Message[]
  observations: string[]
  memories: Memory[]
  ending: Ending | null
  createdAt: string
  updatedAt: string
}

export interface Health {
  status: string
  version: string
  aiConfigured: boolean
}

export const observations: {
  id: Observation
  title: string
  mark: string
  text: string
  prompt: string
}[] = [
  {
    id: 'camera',
    title: '旧相机',
    mark: '01',
    text: '相机边角磨得发白。背带上有一道手缝的线，镜头盖扣着。',
    prompt: '留意她手边的相机',
  },
  {
    id: 'receipt',
    title: '湿掉的小票',
    mark: '02',
    text: '门边有一张湿掉的小票。字迹已经模糊，只剩便利店的标志。它是谁留下的，你还不知道。',
    prompt: '留意门边的小票',
  },
  {
    id: 'door',
    title: '消防门',
    mark: '03',
    text: '门没有关严。楼道里那盏普通的灯，照着一小块没有被雨打湿的地面。',
    prompt: '留意身后的灯光',
  },
  {
    id: 'rain',
    title: '雨声',
    mark: '04',
    text: '雨点落在不同的地方，发出不同的声音。远处有一辆夜班车经过，随后又安静下来。',
    prompt: '听一会儿雨声',
  },
]

export const phaseNames: Record<Session['phase'], string> = {
  arrival: '雨还在下',
  listening: '有人在听',
  threshold: '门里的光',
  dawn: '天亮之前',
}

export const rehearsalLines: [string, string][] = [
  ['我把门留着。就站这里。', '我也是来透口气的。会打扰你吗？'],
  ['相机淋湿了，会坏吗？', '这里的风比楼下大。'],
  ['那我不猜。你想说什么，我听。', '我确实不知道。刚才问得太急，可以不答。'],
  ['你愿意让我看那句话吗？', '你原来想怎么写？'],
  ['他那晚后来怎么回去的？', '你记得照片外面的事。'],
  ['那天的照片，对你也可以不止一个意思。', '你想把那张撤下来吗？还是暂时不决定？'],
  ['可以先不决定展览。你想去门里避会儿雨吗？', '今天已经够长了。下一件事可以很小。'],
  ['你愿意告诉他，今晚需要有人陪一会儿吗？', '我在这儿等。你可以先回他。'],
  ['可以。等有人来，再决定接下来。', '可以。要是你想自己走，我也不会追问。'],
  ['今晚先到这里。你可以自己决定下一步。', '谢谢你让我听到这些。明天的事，明天再说。'],
]

export const countCharacters = (text: string) => Array.from(text).length

export function makeMemento(session: Session): string {
  const ending = session.ending
  const lines = [
    '天台十句 · 未寄出的底片',
    '',
    ending?.title ?? '雨夜留存',
    ending?.subtitle ?? '',
    '',
    ...(ending?.paragraphs ?? []),
    '',
    '—— 我在那个雨夜说过 ——',
    ending?.echo ?? session.messages.find((message) => message.role === 'player')?.text ?? '',
    '',
    '—— 留下的底片 ——',
    ...session.memories.flatMap((memory) => [memory.title, memory.text, '']),
    '—— 当晚的完整对话 ——',
    ...session.messages.flatMap((message) => [
      `${message.role === 'player' ? '我' : message.role === 'character' ? '她' : '雨夜'}：${message.text}`,
      '',
    ]),
    `模式：${session.mode === 'live' ? 'AI 即时对话' : '剧本排演（固定剧本，不解读自由输入）'}`,
    '这是一部虚构作品。一次交谈不是治疗，一个人也不需要独自承担另一个人的一生。',
  ]
  return lines.join('\n')
}
