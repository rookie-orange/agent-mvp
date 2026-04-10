import { fileToolPromptLines } from './files'
import { gitToolPromptLines } from './git'

const generalToolPromptLines = [
  '当用户的问题需要获取当前时间、日期或星期时，调用可用工具，不要猜测。',
]

export const toolPromptLines = [
  ...generalToolPromptLines,
  ...fileToolPromptLines,
  ...gitToolPromptLines,
]
