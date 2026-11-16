import { useState } from 'react';
import {
  PLANS,
  PLAN_LABELS,
  STATUS_LABELS,
  TRIAL_DAYS,
  type BillingPeriod,
  type PlanId,
} from '@sportbridge/shared';
import { useSignedInUser } from '../../../features/account/useSignedInUser';
import { BootScreen } from '../../../app/guards';
import {
  registerUpgradeInterest,
  useMembership,
  type MembershipView,
} from '../../../features/membership/membershipService';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-ZA', { dateStyle: 'medium' });

/** Which badge colour fits the state: a running trial or a paid plan reads as good, a lapsed one as neutral. */
const STATUS_CLASS: Record<string, string> = {
  free: 'closed',
  trialing: 'review',
  active: 'live',
  lapsed: 'closed',
};

/**
 * Membership (Phase 4). SportBridge takes no payments yet — the client has confirmed the prices but not a
 * payment provider — so this page is honest about that: it shows the plan, the trial, and what is actually
 * in force, and "I'm interested" only tells SportBridge, it never charges.
 */
export default function MembershipPage() {
  const me = useSignedInUser();
  const { state, reload } = useMembership(me?.uid);
  if (!me) return <BootScreen label="Loading…" />;
  const isOrg = me.user.role === 'organisation';
  return (
    <section className="sb-page active" id="sb-page-membership">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">MEMBERSHIP</div>
          <h1>My Membership</h1>
          <p>
            {isOrg
              ? 'Your plan, your free trial, and what SportBridge costs when you are ready.'
              : 'Your plan and what it includes.'}
          </p>
        </div>
      </div>
      {state.status === 'loading' && <BootScreen label="Loading your membership…" />}
      {state.status === 'error' && (
        <div className="sb-card sb-empty" role="alert">
          {state.message}
        </div>
      )}
      {state.status === 'ready' && state.data && <Body view={state.data} isOrg={isOrg} onChanged={reload} />}
    </section>
  );
}

function Body({ view, isOrg, onChanged }: { view: MembershipView; isOrg: boolean; onChanged: () => void }) {
  const { membership, status, limits, trialDaysLeft } = view;
  const paidPlan: PlanId = isOrg ? 'organisation' : 'pro';
  const alreadyPaid = status === 'active';
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="sb-card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>{PLAN_LABELS[membership.plan]}</h2>
          <span className={`sb-status ${STATUS_CLASS[status] ?? 'closed'}`}>{STATUS_LABELS[status]}</span>
        </div>

        {status === 'trialing' && (
          <p className="sb-meta" style={{ marginTop: 8 }}>
            {trialDaysLeft === 0
              ? 'Your free trial ends today.'
              : `${trialDaysLeft} ${trialDaysLeft === 1 ? 'day' : 'days'} left of your ${TRIAL_DAYS}-day free trial`}
            {membership.trialEndsAt ? ` — it ends on ${fmtDate(membership.trialEndsAt)}.` : '.'}
          </p>
        )}
        {status === 'lapsed' && (
          <p className="sb-meta" style={{ marginTop: 8 }}>
            Your free trial has ended. <strong>You have not been charged</strong> — SportBridge cannot take
            payments yet, and nothing will ever start charging you without you choosing it.
          </p>
        )}

        <h3 style={{ marginTop: 16, marginBottom: 6 }}>What your plan allows</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>
            {limits.activeApplications === null
              ? 'As many applications at a time as you like'
              : `${limits.activeApplications} applications waiting for an answer at a time`}
          </li>
          <li>Browse and save every opportunity and programme on SportBridge</li>
          {isOrg && <li>Publish opportunities and programmes, and review who applies</li>}
        </ul>
        <p className="sb-field-hint" style={{ marginTop: 10 }}>
          An application that has been answered or withdrawn is finished, so it never counts against this.
        </p>
      </div>

      {!alreadyPaid && <UpgradeCard plan={paidPlan} interest={membership.interest} onDone={onChanged} />}
    </div>
  );
}

function UpgradeCard({
  plan,
  interest,
  onDone,
}: {
  plan: PlanId;
  interest: MembershipView['membership']['interest'];
  onDone: () => void;
}) {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const price = PLANS[plan];
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await registerUpgradeInterest(plan, period);
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sb-card sb-form-card">
      <h3>{PLAN_LABELS[plan]}</h3>
      <div className="sb-tabs" style={{ margin: '10px 0' }}>
        {(['monthly', 'annual'] as const).map((p) => (
          <button
            key={p}
            type="button"
            className={`sb-btn${period === p ? ' primary' : ''}`}
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
          >
            {p === 'monthly' ? 'Monthly' : 'Annual'}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 28, fontWeight: 800, margin: '4px 0' }}>
        {price[period]} <span className="sb-meta">{period === 'monthly' ? '/ month' : '/ year'}</span>
      </p>
      <p className="sb-meta">
        {period === 'annual' ? 'Two months free compared with paying monthly.' : 'Billed monthly.'}
      </p>

      <p style={{ marginTop: 12 }}>
        <strong>SportBridge is not taking payments yet.</strong> Tell us you are interested and we will let
        you know as soon as it opens. Nothing is charged and nothing changes on your account today.
      </p>

      {interest && (
        <p className="sb-form-status" role="status">
          Noted — you asked about {PLAN_LABELS[interest.plan]}{' '}
          {interest.billingPeriod === 'annual' ? 'yearly' : 'monthly'} on {fmtDate(interest.at)}. You can
          change that below.
        </p>
      )}
      {error && (
        <p className="sb-form-status err" role="alert">
          {error}
        </p>
      )}
      <div className="sb-form-actions">
        <button type="button" className="sb-btn primary" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Saving…' : interest ? 'Update what I asked for' : 'I’m interested'}
        </button>
      </div>
    </div>
  );
}
