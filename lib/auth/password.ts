import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto'
const cost = 16_384
const blockSize = 8
const parallelization = 1
const keyLength = 64
const maxMemory = 32 * 1024 * 1024

function scrypt(password: string, salt: Buffer, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      length,
      { N: cost, r: blockSize, p: parallelization, maxmem: maxMemory },
      (error, derivedKey) => (error ? reject(error) : resolve(derivedKey)),
    )
  })
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 256) {
    throw new Error('Password must be between 12 and 256 characters')
  }
  const salt = randomBytes(16)
  const derivedKey = await scrypt(password, salt, keyLength)
  return [
    'scrypt',
    cost,
    blockSize,
    parallelization,
    salt.toString('base64'),
    derivedKey.toString('base64'),
  ].join('$')
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, costValue, blockSizeValue, parallelizationValue, saltValue, hashValue] =
    encodedHash.split('$')
  if (
    algorithm !== 'scrypt' ||
    !costValue ||
    !blockSizeValue ||
    !parallelizationValue ||
    !saltValue ||
    !hashValue
  ) {
    return false
  }
  const parsedCost = Number(costValue)
  const parsedBlockSize = Number(blockSizeValue)
  const parsedParallelization = Number(parallelizationValue)
  if (
    parsedCost !== cost ||
    parsedBlockSize !== blockSize ||
    parsedParallelization !== parallelization
  ) {
    return false
  }
  try {
    const salt = Buffer.from(saltValue, 'base64')
    const expected = Buffer.from(hashValue, 'base64')
    if (salt.length !== 16 || expected.length !== keyLength) return false
    const actual = await scrypt(password, salt, expected.length)
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
