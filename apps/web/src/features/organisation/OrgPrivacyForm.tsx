import { DEFAULT_ORG_PRIVACY, type OrgPrivacy } from '@sportbridge/shared';
import { PrivacySwitches } from '../account/PrivacySwitches';
import { syncDirectory } from '../directory/directoryService';
import { saveOrgPrivacy } from './orgService';

export function OrgPrivacyForm({ orgId, value }: { orgId: string; value?: OrgPrivacy }) {
  return (
    <PrivacySwitches<OrgPrivacy>
      rows={[
        { key: 'listed', label: 'List my organisation in the Talent Directory' },
        { key: 'showContactDetails', label: 'Show contact email, phone and website publicly' },
        { key: 'acceptEnquiries', label: 'Accept enquiries from athletes, parents and coaches' },
      ]}
      value={value ?? DEFAULT_ORG_PRIVACY}
      save={async (next) => {
        await saveOrgPrivacy(orgId, next);
        await syncDirectory().catch(() => {});
      }}
      note="Listed organisations show their name, sports, area and what they offer."
    />
  );
}
