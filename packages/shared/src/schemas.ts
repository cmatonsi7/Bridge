import { z } from 'zod';
import { GUARDIAN_RELATIONSHIPS, ORGANISATION_TYPES, SELF_SERVICE_ROLES } from './roles.js';
import { MINIMUM_SELF_REGISTRATION_AGE, ageOn, parseIsoDate } from './age.js';

const name = z.string().trim().min(1, 'Required').max(60, 'Keep this under 60 characters');

/** South African and international mobile numbers: digits, optional leading +, 9–15 digits. */
const mobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ''))
  .refine((v) => /^\+?\d{9,15}$/.test(v), 'Enter a valid mobile number');

const dob = z
  .string()
  .refine((v) => parseIsoDate(v) !== null, 'Enter a valid date of birth')
  .refine((v) => {
    const d = parseIsoDate(v);
    return d !== null && d.getTime() <= Date.now();
  }, 'Date of birth cannot be in the future');

/**
 * Onboarding payload sent to POST /api/onboarding after Firebase Auth account creation.
 * Age, minor status and role claims are computed on the server from this data.
 */
export const onboardingSchema = z
  .object({
    firstName: name,
    surname: name,
    mobile,
    /** Not asked of organisation accounts: they confirm they are 18 or over instead. */
    dateOfBirth: dob.optional(),
    role: z.enum(SELF_SERVICE_ROLES),
    organisationName: z.string().trim().max(120).optional(),
    organisationType: z.enum(ORGANISATION_TYPES).optional(),
    /** Organisation accounts only: the person confirms they are an adult acting for the organisation. */
    adultConfirmed: z.boolean().optional(),
    guardianEmail: z.string().trim().toLowerCase().email('Enter a valid email address').optional(),
    guardianRelationship: z.enum(GUARDIAN_RELATIONSHIPS).optional(),
    guardianConsentAcknowledged: z.boolean().optional(),
    termsAccepted: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the terms to continue' }),
    }),
  })
  .superRefine((v, ctx) => {
    // An organisation gives no date of birth: it confirms an adult is setting it up instead.
    if (v.role === 'organisation') {
      if (!v.organisationName)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['organisationName'],
          message: 'Organisation name is required',
        });
      if (!v.organisationType)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['organisationType'],
          message: 'Select an organisation type',
        });
      if (v.adultConfirmed !== true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['adultConfirmed'],
          message: 'Confirm you are 18 or over and authorised to act for this organisation',
        });
      }
    } else if (!v.dateOfBirth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dateOfBirth'],
        message: 'Enter a valid date of birth',
      });
    }

    // Age rules never apply to an organisation: the adult confirmation above is what counts, and an
    // organisation that still sends a date of birth (an older client) is accepted without one.
    if (v.role === 'organisation') return;
    const d = v.dateOfBirth ? parseIsoDate(v.dateOfBirth) : null;
    if (!d) return;
    const age = ageOn(d, new Date());
    if (age < MINIMUM_SELF_REGISTRATION_AGE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dateOfBirth'],
        message: `Children under ${MINIMUM_SELF_REGISTRATION_AGE} must be added by a parent or guardian`,
      });
    }
    if (age < 18) {
      if (v.role !== 'athlete') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['role'],
          message: 'Under-18 accounts can only be athlete accounts',
        });
      }
      if (!v.guardianEmail)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guardianEmail'],
          message: 'Parent / guardian email is required',
        });
      if (!v.guardianRelationship)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guardianRelationship'],
          message: 'Select a relationship',
        });
      if (v.guardianConsentAcknowledged !== true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guardianConsentAcknowledged'],
          message: 'Confirm the guardian consent process',
        });
      }
    }
  });

export type OnboardingInput = z.input<typeof onboardingSchema>;
export type OnboardingData = z.output<typeof onboardingSchema>;

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use at least one letter and one number');
