import React from 'react';
import Input from '../ui/Input';

/**
 * Form Field Wrapper Component
 * Consistent form field with label, error, and hint support
 */
export default function FormField({
  name,
  label,
  type = 'text',
  error,
  hint,
  required = false,
  register,
  className = '',
  ...props
}) {
  const inputProps = register ? register(name) : {};

  return (
    <div className={`mb-4 ${className}`}>
      <Input
        type={type}
        label={label}
        error={error}
        hint={hint}
        required={required}
        {...inputProps}
        {...props}
      />
    </div>
  );
}

/**
 * Form Field Group - for grouping related fields
 */
export function FormFieldGroup({ children, title, subtitle }) {
  return (
    <fieldset className="mb-6">
      {title && (
        <legend className="text-sm font-semibold text-gray-900 mb-3 block">
          {title}
        </legend>
      )}
      {subtitle && (
        <p className="text-xs text-gray-500 mb-4 block">{subtitle}</p>
      )}
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}
