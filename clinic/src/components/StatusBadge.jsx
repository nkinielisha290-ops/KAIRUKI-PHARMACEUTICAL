import { STATUS_LABEL } from '../lib';

export default function StatusBadge({ status }) {
  return <span className={'badge status-' + status}>{STATUS_LABEL[status] ?? status}</span>;
}
