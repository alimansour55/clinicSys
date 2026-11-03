import crypto from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import multer from 'multer'

export const MAX_PATIENT_UPLOAD_BYTES = 5 * 1024 * 1024

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }
const DOCUMENT_TYPES = { ...IMAGE_TYPES, 'application/pdf': '.pdf' }

/** The browser's Content-Type is only a claim, so check the first bytes as well. */
export const sniffFileType = (bytes) => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (bytes.length >= 12 && bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') return 'image/webp'
  if (bytes.length >= 5 && bytes.toString('latin1', 0, 5) === '%PDF-') return 'application/pdf'
  return ''
}

const removeFile = async (file) => {
  if (!file?.path) return
  await fs.unlink(file.path).catch(() => {})
}

const uploadError = (message) => Object.assign(new Error(message), { uploadRejected: true })

const buildUploader = (allowedTypes, invalidMessage) =>
  multer({
    storage: multer.diskStorage({
      destination: os.tmpdir(),
      // A random name: with the original name, two patients uploading "card.jpg" at once could get each other's file.
      filename: (req, file, callback) => callback(null, `clinivo-${crypto.randomUUID()}${allowedTypes[file.mimetype] || ''}`)
    }),
    limits: { fileSize: MAX_PATIENT_UPLOAD_BYTES, files: 1 },
    fileFilter: (req, file, callback) => {
      if (allowedTypes[file.mimetype]) return callback(null, true)
      callback(uploadError(invalidMessage))
    }
  })

/**
 * Accepts one optional file on `fieldName`, checks its real type, and always deletes the temporary
 * copy when the response ends, so insurance cards and photos do not stay on the server's disk.
 */
const patientUpload = (uploader, fieldName, invalidMessage, allowedTypes) => (req, res, next) => {
  if (!req.is('multipart/form-data')) return next()

  uploader.single(fieldName)(req, res, async (error) => {
    res.once('close', () => removeFile(req.file))

    if (error) {
      await removeFile(req.file)
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large. The limit is 5 MB.'
        : error.uploadRejected ? error.message : 'Could not read the uploaded file'
      return res.json({ success: false, message })
    }
    if (!req.file) return next()

    try {
      const handle = await fs.open(req.file.path, 'r')
      const { buffer, bytesRead } = await handle.read(Buffer.alloc(16), 0, 16, 0)
      await handle.close()
      if (!allowedTypes[sniffFileType(buffer.subarray(0, bytesRead))]) {
        await removeFile(req.file)
        return res.json({ success: false, message: invalidMessage })
      }
      next()
    } catch (readError) {
      console.error('Upload check failed:', readError.message)
      await removeFile(req.file)
      res.json({ success: false, message: 'Could not read the uploaded file' })
    }
  })
}

const IMAGE_MESSAGE = 'Please choose a JPG, PNG or WebP image'
const DOCUMENT_MESSAGE = 'Please attach a JPG, PNG, WebP or PDF file'

export const profilePhotoUpload = patientUpload(buildUploader(IMAGE_TYPES, IMAGE_MESSAGE), 'image', IMAGE_MESSAGE, IMAGE_TYPES)
export const insuranceCardUpload = patientUpload(buildUploader(DOCUMENT_TYPES, DOCUMENT_MESSAGE), 'insuranceCardPhoto', DOCUMENT_MESSAGE, DOCUMENT_TYPES)
