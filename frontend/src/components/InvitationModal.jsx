// src/components/InvitationModal.jsx – Modal to create and manage invitations

import { useState, useEffect } from 'react';
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
import { X, Mail, RefreshCw, Trash2, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function InvitationModal({ isOpen, onClose }) {
  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: { email: '', role: 'staff' }
  });

  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const email = watch('email');

  const [tab, setTab] = useState('create'); // create | manage

  // ── List invitations ──────────────────────────────────────────
  const { data: invitationData, isLoading: isLoadingInvitations } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const result = await listInvitations(null, accessToken);
      return result.data;
    },
    enabled: isOpen && tab === 'manage'
  });

  // ── Create invitation mutation ────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (formData) => {
      return await createInvitation(formData.email, formData.role, accessToken);
    },
    onSuccess: (res) => {
      toast.success(res.message);
      reset();
      queryClient.invalidateQueries(['invitations']);
      setTab('manage');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create invitation');
    }
  });

  // ── Resend invitation mutation ────────────────────────────────
  const resendMutation = useMutation({
    mutationFn: async (invitationId) => {
      return await resendInvitation(invitationId, accessToken);
    },
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries(['invitations']);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to resend invitation');
    }
  });

  // ── Delete invitation mutation ────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (invitationId) => {
      return await deleteInvitation(invitationId, accessToken);
    },
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries(['invitations']);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete invitation');
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Manage Invitations</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-3 px-4 font-medium transition ${
              tab === 'create'
                ? 'text-yellow-600 border-b-2 border-yellow-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Create New
          </button>
          <button
            onClick={() => setTab('manage')}
            className={`flex-1 py-3 px-4 font-medium transition ${
              tab === 'manage'
                ? 'text-yellow-600 border-b-2 border-yellow-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Manage
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {tab === 'create' ? (
            <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="staff@example.com"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  {...register('role')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={createMutation.isPending || !email}
                className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending ? 'Creating...' : '📧 Send Invitation'}
              </button>
            </form>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {isLoadingInvitations ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : !invitationData?.invitations?.length ? (
                <div className="text-center py-8 text-gray-500">No invitations yet</div>
              ) : (
                invitationData.invitations.map((inv) => (
                  <div
                    key={inv._id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-yellow-300 transition"
                  >
                    {/* Email & Role */}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{inv.email}</p>
                        <p className="text-xs text-gray-500 capitalize">Role: {inv.role}</p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          inv.status === 'pending'
                            ? 'bg-blue-100 text-blue-700'
                            : inv.status === 'accepted'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                    </div>

                    {/* Expires */}
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                      <Clock className="w-3 h-3" />
                      Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {inv.status === 'pending' && (
                        <>
                          <button
                            onClick={() => resendMutation.mutate(inv._id)}
                            disabled={resendMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium transition disabled:opacity-50"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Resend
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(inv._id)}
                            disabled={deleteMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded text-xs font-medium transition disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </>
                      )}
                      {inv.status === 'accepted' && (
                        <div className="w-full flex items-center justify-center gap-2 py-2 bg-green-50 text-green-700 rounded text-xs font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Accepted
                        </div>
                      )}
                      {inv.status === 'expired' && (
                        <>
                          <button
                            onClick={() => resendMutation.mutate(inv._id)}
                            disabled={resendMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium transition disabled:opacity-50"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Resend
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(inv._id)}
                            disabled={deleteMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded text-xs font-medium transition disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Stats */}
              {invitationData?.stats && (
                <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-blue-600">
                      {invitationData.stats.pending}
                    </p>
                    <p className="text-xs text-gray-500">Pending</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">
                      {invitationData.stats.accepted}
                    </p>
                    <p className="text-xs text-gray-500">Accepted</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-600">
                      {invitationData.stats.expired}
                    </p>
                    <p className="text-xs text-gray-500">Expired</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
