import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from '@sportbridge/shared';

const CLASS: Record<ApplicationStatus, string> = {
  submitted: 'pending',
  shortlisted: 'pending',
  accepted: 'ok',
  declined: 'pending',
  withdrawn: 'pending',
};

export const StatusBadge = ({ status }: { status: ApplicationStatus }) => (
  <span className={`v-badge ${CLASS[status]}`}>{APPLICATION_STATUS_LABELS[status]}</span>
);
