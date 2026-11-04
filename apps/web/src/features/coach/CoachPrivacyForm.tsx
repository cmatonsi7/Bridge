import { DEFAULT_COACH_PRIVACY, type CoachPrivacy } from '@sportbridge/shared';
import { PrivacySwitches } from '../account/PrivacySwitches';
import { saveCoachPrivacy } from './coachService';

export function CoachPrivacyForm({ uid, value }: { uid: string; value?: CoachPrivacy }) {
  return (
    <PrivacySwitches<CoachPrivacy>
      rows={[
        { key: 'discoverable', label: 'Make my profile discoverable to athletes and parents' },
        { key: 'showQualifications', label: 'Show my qualifications on my profile' },
        { key: 'allowEnquiries', label: 'Accept coaching enquiries' },
      ]}
      value={value ?? DEFAULT_COACH_PRIVACY}
      save={(next) => saveCoachPrivacy(uid, next)}
      note="These preferences take effect when athlete and coach discovery launches."
    />
  );
}
