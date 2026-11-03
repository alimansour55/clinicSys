/** True only for a database on this machine. Anything unparseable counts as remote. */
export const isLocalMongoUri = (uri) => {
  const match = /^mongodb:\/\/(?:[^@/]*@)?([^/?]+)/.exec(String(uri || '').trim())
  if (!match) return false
  return match[1].split(',').every((host) => /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host))
}
