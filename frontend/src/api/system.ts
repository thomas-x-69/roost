import client from './client'

export const pauseAll = async () => {
  const { data } = await client.post('/system/pause-all')
  return data
}

export const resumeAll = async () => {
  const { data } = await client.post('/system/resume-all')
  return data
}

export const systemInfo = async () => {
  const { data } = await client.get('/system/info')
  return data
}
