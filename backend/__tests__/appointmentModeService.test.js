import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  normalizeAppointmentType,
  getDoctorAppointmentModeError,
  buildTeleconsultationLink,
  normalizeTeleconsultationLink,
  normalizeAppointmentTeleconsultationLink,
} from '../services/appointmentModeService.js'
import { doctorWithClinicSchedule } from './helpers/fixtures.js'

describe('appointmentModeService', () => {
  describe('normalizeAppointmentType', () => {
    it('keeps valid types and defaults unknown to Clinic', () => {
      expect(normalizeAppointmentType('Video Call')).toBe('Video Call')
      expect(normalizeAppointmentType('Invalid')).toBe('Clinic')
    })
  })

  describe('getDoctorAppointmentModeError', () => {
    it('blocks disabled teleconsultation modes', () => {
      const doctor = { acceptsVoiceCall: false, acceptsVideoCall: true }
      expect(getDoctorAppointmentModeError(doctor, 'Voice Call')).toMatch(/voice/)
      expect(getDoctorAppointmentModeError(doctor, 'Video Call')).toBe('')
    })

    it('blocks home visit when doctor does not offer it', () => {
      expect(getDoctorAppointmentModeError({}, 'Home Visit')).toMatch(/home visits/)
      expect(getDoctorAppointmentModeError(doctorWithClinicSchedule(), 'Home Visit')).toBe('')
    })
  })

  describe('buildTeleconsultationLink', () => {
    beforeEach(() => {
      vi.stubEnv('TELECONSULTATION_BASE_URL', 'https://meet.example.com')
    })
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('builds room URL from appointment parts', () => {
      const link = buildTeleconsultationLink({
        appointmentId: 'apt1',
        docId: 'doc1',
        userId: 'user1',
        slotDate: '21_5_2026',
        slotTime: '10:00',
      })
      expect(link).toMatch(/^https:\/\/meet\.example\.com\/clinicsys-/)
    })
  })

  describe('normalizeTeleconsultationLink', () => {
    beforeEach(() => {
      vi.stubEnv('TELECONSULTATION_BASE_URL', 'https://meet.example.com')
    })
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('rewrites meet.jit.si host to configured base', () => {
      const normalized = normalizeTeleconsultationLink('https://meet.jit.si/room-abc')
      expect(normalized).toContain('meet.example.com')
    })
  })

  describe('normalizeAppointmentTeleconsultationLink', () => {
    beforeEach(() => {
      vi.stubEnv('TELECONSULTATION_BASE_URL', 'https://meet.example.com')
    })
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('fills teleconsultation link for video appointments', () => {
      const apt = normalizeAppointmentTeleconsultationLink({
        appointmentType: 'Video Call',
        _id: 'a1',
        docId: 'd1',
        userId: 'u1',
        slotDate: '21_5_2026',
        slotTime: '11:00',
        teleconsultationLink: '',
      })
      expect(apt.teleconsultationLink).toContain('clinicsys-')
    })

    it('leaves clinic appointments unchanged', () => {
      const apt = normalizeAppointmentTeleconsultationLink({
        appointmentType: 'Clinic',
        teleconsultationLink: '',
      })
      expect(apt.teleconsultationLink).toBe('')
    })
  })
})
