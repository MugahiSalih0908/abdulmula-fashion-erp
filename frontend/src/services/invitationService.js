// src/services/invitationService.js – Invitation API calls

import api from './api';

// ── Validate invitation token ──────────────────────────────────────
export const validateInvitation = async (token) => {
  try {
    const response = await api.post(`/invitations/validate/${token}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: 'Failed to validate invitation' };
  }
};

// ── Accept invitation and create account ────────────────────────────
export const acceptInvitation = async (token, { name, password, confirmPassword }) => {
  try {
    const response = await api.post(`/invitations/accept/${token}`, {
      name,
      password,
      confirmPassword
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: 'Failed to accept invitation' };
  }
};

// ── Create invitation (admin only) ────────────────────────────────
export const createInvitation = async (email, role, accessToken) => {
  try {
    const response = await api.post(
      `/invitations/create`,
      { email, role },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: 'Failed to create invitation' };
  }
};

// ── List invitations (admin only) ──────────────────────────────────
export const listInvitations = async (status, accessToken) => {
  try {
    const params = status ? { status } : {};
    const response = await api.get(
      `/invitations`,
      {
        params,
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: 'Failed to list invitations' };
  }
};

// ── Resend invitation (admin only) ────────────────────────────────
export const resendInvitation = async (invitationId, accessToken) => {
  try {
    const response = await api.post(
      `/invitations/resend`,
      { invitationId },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: 'Failed to resend invitation' };
  }
};

// ── Delete invitation (admin only) ────────────────────────────────
export const deleteInvitation = async (invitationId, accessToken) => {
  try {
    const response = await api.delete(
      `/invitations/${invitationId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: 'Failed to delete invitation' };
  }
};
