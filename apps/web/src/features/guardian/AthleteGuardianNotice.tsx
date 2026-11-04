import { useMyGuardianLinks } from './guardianService';

/**
 * For a restricted (under-18) athlete: tells them exactly what their parent needs to do,
 * since SportBridge doesn't email parents (match-on-sign-up).
 */
export function AthleteGuardianNotice({ uid }: { uid: string }) {
  const links = useMyGuardianLinks(uid);
  const list = links.status === 'ready' ? links.data : [];
  const pending = list.find((l) => l.status === 'pending');
  const declined = !pending && list.some((l) => l.status === 'declined');
  const revoked = !pending && !declined && list.some((l) => l.status === 'revoked');

  return (
    <div className="sb-member-notice" style={{ marginTop: 18 }} role="status">
      <div>
        <strong>Waiting for your parent or guardian</strong>
        <span>
          Because you are under 18, a parent or guardian must confirm your account before your profile can be
          seen by others or you can connect with coaches and organisations. You can still explore
          opportunities.
        </span>
        {pending && (
          <span style={{ display: 'block', marginTop: 8 }}>
            <b>What to do:</b> ask your parent or guardian to create a SportBridge <b>Parent / Guardian</b>{' '}
            account using <b>{pending.guardianEmail}</b>. Your request will appear on their dashboard for them
            to confirm.
          </span>
        )}
        {declined && (
          <span style={{ display: 'block', marginTop: 8 }}>
            The parent or guardian you listed said they are not your guardian. Contact SportBridge support to
            update your guardian details.
          </span>
        )}
        {revoked && (
          <span style={{ display: 'block', marginTop: 8 }}>
            Your parent or guardian withdrew their consent. Speak to them, or contact SportBridge support.
          </span>
        )}
      </div>
    </div>
  );
}
