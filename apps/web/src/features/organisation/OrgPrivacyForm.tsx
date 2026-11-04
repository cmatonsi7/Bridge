import { DEFAULT_ORG_PRIVACY, type OrgPrivacy } from '@sportbridge/shared';
import { PrivacySwitches } from '../account/PrivacySwitches';
import { saveOrgPrivacy } from './orgService';

export function OrgPrivacyForm({ orgId, value }: { orgId: string; value?: OrgPrivacy }) {
  return (
    <PrivacySwitches<OrgPrivacy>
      rows={[
        { key: 'listed', label: 'List my organisation in the SportBridge directory' },
        { key: 'showContactDetails', label: 'Show contact email, phone and website publicly' },
        { key: 'acceptEnquiries', label: 'Accept enquiries from athletes, parents and coaches' },
      ]}
      value={value ?? DEFAULT_ORG_PRIVACY}
      save={(next) => saveOrgPrivacy(orgId, next)}
      note="These preferences take effect when the organisation directory launches."
    />
  );
}
