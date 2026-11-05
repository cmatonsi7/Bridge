import { DEFAULT_COACH_PRIVACY, type CoachPrivacy } from '@sportbridge/shared';
import { PrivacySwitches } from '../account/PrivacySwitches';
import { syncDirectory } from '../directory/directoryService';
import { saveCoachPrivacy } from './coachService';

export function CoachPrivacyForm({ uid, value }: { uid: string; value?: CoachPrivacy }) {
  return (
    <PrivacySwitches<CoachPrivacy>
      rows={[
        { key: 'discoverable', label: 'List me in the Talent Directory' },
        { key: 'showQualifications', label: 'Show my qualifications on my profile' },
        { key: 'allowEnquiries', label: 'Accept coaching enquiries' },
      ]}
      value={value ?? DEFAULT_COACH_PRIVACY}
      save={async (next) => {
        await saveCoachPrivacy(uid, next);
        // Rebuild the directory entry; the save itself has already succeeded.
        await syncDirectory().catch(() => {});
      }}
      note="Listed profiles show your name, sports, level and area — never your email or phone number."
    />
  );
}
