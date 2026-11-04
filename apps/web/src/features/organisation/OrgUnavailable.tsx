/** Shown if an organisation account has no organisation record (should not happen for new sign-ups). */
export function OrgUnavailable() {
  return (
    <div className="sb-card sb-empty" role="alert">
      We couldn’t find your organisation. Contact SportBridge support so we can link it to your account.
    </div>
  );
}
