import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  createInvitation,
  listInvitations,
  resendInvitation,
  deleteInvitation
} from '../services/invitationService';
import useAuthStore from '../store/authStore';
import {
  AlertCircle, CheckCircle2, Clock3, Mail, Plus, RefreshCw,
  ShieldCheck, Trash2, Users, X
} from 'lucide-react';
import Badge from './ui/Badge';
import './pages/staffWorkspace.css';

function statusVariant(status) {
  if (status === 'accepted') return 'success';
  if (status === 'expired') return 'danger';
  return 'warning';
}

function formatExpiry(value) {
  if (!value) return 'Expiry unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Expiry unavailable' : 'Expires ' + date.toLocaleDateString();
}

export default function InvitationModal({ isOpen, onClose }) {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: { email: '', role: 'staff' }
  });
  const accessToken = useAuthStore(state => state.accessToken);
  const queryClient = useQueryClient();
  const email = watch('email');
  const [tab, setTab] = useState('create');

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const invitationQuery = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const result = await listInvitations(null, accessToken);
      return result.data;
    },
    enabled: isOpen && tab === 'manage'
  });

  const createMutation = useMutation({
    mutationFn: formData => createInvitation(formData.email, formData.role, accessToken),
    onSuccess: response => {
      toast.success(response.message || 'Invitation created.');
      reset();
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setTab('manage');
    },
    onError: error => toast.error(error.message || 'Could not create invitation.')
  });

  const resendMutation = useMutation({
    mutationFn: invitationId => resendInvitation(invitationId, accessToken),
    onSuccess: response => {
      toast.success(response.message || 'Invitation email sent.');
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
    onError: error => toast.error(error.message || 'Could not resend invitation.')
  });

  const deleteMutation = useMutation({
    mutationFn: invitationId => deleteInvitation(invitationId, accessToken),
    onSuccess: response => {
      toast.success(response.message || 'Invitation deleted.');
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
    onError: error => toast.error(error.message || 'Could not delete invitation.')
  });

  if (!isOpen) return null;

  const invitations = invitationQuery.data?.invitations || [];
  const stats = invitationQuery.data?.stats || {};
  const isBusy = resendMutation.isPending || deleteMutation.isPending;

  return (
    <div
      className="staff-modal-overlay"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className="staff-modal-panel" role="dialog" aria-modal="true" aria-labelledby="staff-invitation-title" aria-describedby="staff-invitation-description">
        <header className="staff-modal-header">
          <div className="staff-modal-header-copy">
            <span>TEAM ACCESS</span>
            <h2 id="staff-invitation-title">Manage invitations</h2>
          </div>
          <button type="button" className="staff-modal-close" onClick={onClose} aria-label="Close invitation manager"><X size={19} aria-hidden="true" /></button>
        </header>

        <div className="staff-modal-tabs" role="tablist" aria-label="Invitation actions">
          <button type="button" role="tab" id="staff-invite-create-tab" aria-controls="staff-invite-create-panel" aria-selected={tab === 'create'} className="staff-modal-tab" onClick={() => setTab('create')}>Create invitation</button>
          <button type="button" role="tab" id="staff-invite-manage-tab" aria-controls="staff-invite-manage-panel" aria-selected={tab === 'manage'} className="staff-modal-tab" onClick={() => setTab('manage')}>Manage existing</button>
        </div>

        <div className="staff-modal-content">
          {tab === 'create' ? (
            <div id="staff-invite-create-panel" role="tabpanel" aria-labelledby="staff-invite-create-tab">
              <p id="staff-invitation-description" className="sr-only">Send a secure invitation to a new staff member.</p>
              <form onSubmit={handleSubmit(data => createMutation.mutate({
                ...data,
                email: data.email.trim()
              }))} className="staff-invitation-form" noValidate>
                <div className="staff-invitation-help">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <p>The invited person will receive a private link to verify their invitation and create a password.</p>
                </div>

                <div className="staff-invitation-field">
                  <label htmlFor="invitation-email">Email address</label>
                  <input
                    id="invitation-email"
                    type="email"
                    autoComplete="email"
                    placeholder="staff@example.com"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'invitation-email-error' : undefined}
                    {...register('email', {
                      required: 'Enter an email address.',
                      pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address.' }
                    })}
                  />
                  {errors.email && <p id="invitation-email-error" role="alert">{errors.email.message}</p>}
                </div>

                <div className="staff-invitation-field">
                  <label htmlFor="invitation-role">Workspace role</label>
                  <select id="invitation-role" {...register('role')}><option value="staff">Staff</option><option value="manager">Manager</option><option value="admin">Administrator</option></select>
                </div>

                <button type="submit" className="auth-submit" disabled={!email?.trim() || createMutation.isPending}>
                  {createMutation.isPending && <span className="auth-spinner" aria-hidden="true" />}
                  <Mail size={15} aria-hidden="true" /> {createMutation.isPending ? 'Sending invitation…' : 'Send invitation'}
                </button>
              </form>
            </div>
          ) : (
            <div id="staff-invite-manage-panel" role="tabpanel" aria-labelledby="staff-invite-manage-tab">
              {invitationQuery.isLoading ? (
                <div className="staff-modal-empty" role="status"><span className="auth-spinner" /><p>Loading invitations…</p></div>
              ) : invitationQuery.isError ? (
                <div className="staff-modal-empty" role="alert">
                  <AlertCircle size={22} />
                  <strong>Invitations could not be loaded</strong>
                  <p>{invitationQuery.error?.message || 'Check your connection and try again.'}</p>
                  <button type="button" className="staff-invitation-action" onClick={() => invitationQuery.refetch()}><RefreshCw size={14} /> Retry</button>
                </div>
              ) : invitations.length === 0 ? (
                <div className="staff-modal-empty">
                  <Users size={25} />
                  <strong>No invitations yet</strong>
                  <p>Create an invitation to give a new team member secure access.</p>
                  <button type="button" className="staff-invitation-action" onClick={() => setTab('create')}><Plus size={14} /> Create invitation</button>
                </div>
              ) : (
                <div className="staff-invitations-list">
                  {invitations.map(invitation => (
                    <article key={invitation._id} className="staff-invitation-card">
                      <div className="staff-invitation-card-top">
                        <div><strong>{invitation.email}</strong><p>Role: {invitation.role}</p></div>
                        <Badge variant={statusVariant(invitation.status)}>{invitation.status}</Badge>
                      </div>
                      <div className="staff-invitation-expires"><Clock3 size={13} aria-hidden="true" /> {formatExpiry(invitation.expiresAt)}</div>
                      <div className="staff-invitation-actions">
                        {invitation.status === 'pending' && (
                          <>
                            <button type="button" className="staff-invitation-action" onClick={() => resendMutation.mutate(invitation._id)} disabled={isBusy}>
                              <RefreshCw size={13} /> Resend
                            </button>
                            <button type="button" className="staff-invitation-action is-danger" onClick={() => {
                              if (window.confirm('Delete the invitation for ' + invitation.email + '?')) deleteMutation.mutate(invitation._id);
                            }} disabled={isBusy}>
                              <Trash2 size={13} /> Delete
                            </button>
                          </>
                        )}
                        {invitation.status === 'accepted' && <span className="staff-invitation-action"><CheckCircle2 size={13} /> Accepted</span>}
                        {invitation.status === 'expired' && (
                          <>
                            <button type="button" className="staff-invitation-action" onClick={() => resendMutation.mutate(invitation._id)} disabled={isBusy}>
                              <RefreshCw size={13} /> Resend
                            </button>
                            <button type="button" className="staff-invitation-action is-danger" onClick={() => {
                              if (window.confirm('Delete the expired invitation for ' + invitation.email + '?')) deleteMutation.mutate(invitation._id);
                            }} disabled={isBusy}>
                              <Trash2 size={13} /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}

                  {invitationQuery.data?.stats && (
                    <div className="staff-invitation-stats" aria-label="Invitation totals">
                      <div><strong>{Number(stats.pending) || 0}</strong><span>Pending</span></div>
                      <div><strong>{Number(stats.accepted) || 0}</strong><span>Accepted</span></div>
                      <div><strong>{Number(stats.expired) || 0}</strong><span>Expired</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="staff-modal-footer">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Close</Button>
        </footer>
      </section>
    </div>
  );
}
