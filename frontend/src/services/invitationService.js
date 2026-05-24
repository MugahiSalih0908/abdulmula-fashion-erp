// src/services/invitationService.js – Invitation API calls

import axios from 'axios';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api';
// ── Validate invitation token ──────────────────────────────────────
export const validateInvitation = async (token) => {
  try {
    const response = await axios.post(`${API_URL}/invitations/validate/${token}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: 'Failed to validate invitation' };
  }
};

// ── Accept invitation and create account ────────────────────────────
export const acceptInvitation = async (token, { name, password, confirmPassword }) => {
  try {
    const response = await axios.post(`${API_URL}/invitations/accept/${token}`, {
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
    const response = await axios.post(
      `${API_URL}/invitations/create`,
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
    const response = await axios.get(
      `${API_URL}/invitations`,
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
    const response = await axios.post(
      `${API_URL}/invitations/resend`,
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
    const response = await axios.delete(
      `${API_URL}/invitations/${invitationId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: 'Failed to delete invitation' };
  }
};
