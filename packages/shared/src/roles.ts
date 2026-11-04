/** Roles a person can choose at registration. Administrators are never self-registered. */
export const SELF_SERVICE_ROLES = ['athlete', 'guardian', 'coach', 'organisation'] as const;
export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];
export type Role = SelfServiceRole | 'admin';

export const ROLE_LABELS: Record<Role, string> = {
  athlete: 'Athlete',
  guardian: 'Parent / Guardian',
  coach: 'Coach / Mentor',
  organisation: 'Organisation',
  admin: 'Administrator',
};

/** Club and service provider from the prototype's account-type modal are organisation types. */
export const ORGANISATION_TYPES = [
  'club',
  'school',
  'academy',
  'sports_facility',
  'programme_provider',
  'tertiary',
  'service_provider',
  'federation',
  'other',
] as const;
export type OrganisationType = (typeof ORGANISATION_TYPES)[number];

export const ORGANISATION_TYPE_LABELS: Record<OrganisationType, string> = {
  club: 'Club',
  school: 'School',
  academy: 'Academy',
  sports_facility: 'Sports facility',
  programme_provider: 'Programme provider',
  tertiary: 'University / tertiary institution',
  service_provider: 'Service provider',
  federation: 'Federation / association',
  other: 'Other',
};

export const GUARDIAN_RELATIONSHIPS = ['parent', 'legal_guardian', 'caregiver'] as const;
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number];

export const GUARDIAN_RELATIONSHIP_LABELS: Record<GuardianRelationship, string> = {
  parent: 'Parent',
  legal_guardian: 'Legal guardian',
  caregiver: 'Caregiver with appropriate authority',
};

export const ACCOUNT_STATUSES = ['active', 'restricted', 'suspended'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Version of the terms/consent text the person accepted. Bump when the client supplies new legal documents. */
export const CURRENT_TERMS_VERSION = '2026-11-draft';
