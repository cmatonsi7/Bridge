import { DEFAULT_COACH_PRIVACY, type CoachPrivacy } from '@sportbridge/shared';
import { PrivacySwitches } from '../account/PrivacySwitches';
import { syncDirectory } from '../directory/directoryService';
import { SYNC_FAILED, listingFeedback } from '../directory/listingFeedback';
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
      save={async (next, changed) => {
        await saveCoachPrivacy(uid, next);
        if (changed !== 'discoverable') return;
        try {
          return listingFeedback(await syncDirectory(), next.discoverable);
        } catch {
          return SYNC_FAILED;
        }
      }}
      note="Listed profiles show your name, sports, level and area — never your email or phone number."
    />
  );
}
